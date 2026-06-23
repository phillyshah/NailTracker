import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { parseGS1, isParseError } from '../utils/parseGS1.js';
import { getItemNumber, getProductLabel } from '../utils/gtin-map.js';
import { pickFifo } from '../utils/usageMatch.js';

/**
 * Usage Tickets — record daily inventory consumption.
 *
 * Two-phase flow (mirrors reassign/Transfer):
 *  - preview: parse each scanned sticker, FIFO-match against ONE distributor's
 *    available stock, return per-line status. No mutation.
 *  - commit: re-validate the matched units and consume them (set usedAt) inside
 *    one transaction, writing per-item audit history and one UsageTicket record.
 */

/** Generate the next USE-YYYYMMDD-NNNN id (sequential per day). */
async function nextUsageId(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `USE-${dateStr}`;
  const last = await prisma.usageTicket.findFirst({
    where: { ticketId: { startsWith: prefix } },
    orderBy: { ticketId: 'desc' },
  });
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.ticketId.split('-').pop() || '0', 10);
    seq = lastSeq + 1;
  }
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

type LineStatus = 'available' | 'not_in_stock' | 'error';

interface UsageLine {
  barcode: string;
  status: LineStatus;
  matchedItemId?: string;
  productLabel?: string;
  itemNumber?: string | null;
  lot?: string;
  expDate?: string | null;
  availableCount?: number;
  errorMessage?: string;
}

/**
 * POST /api/usage/preview
 * Body: { distributorId, barcodes: string[] }
 * Read-only — resolves each barcode to an available unit in the distributor's
 * stock (gtinShort + lot, FIFO), without consuming anything.
 */
export async function preview(req: Request, res: Response) {
  try {
    const { distributorId, barcodes } = req.body as {
      distributorId: string;
      barcodes: string[];
    };

    // A distributor account may only act on its own distributor.
    if (req.user?.role === 'distributor' && distributorId !== req.user.distributorId) {
      return error(res, 'You can only record usage for your own distributor', 403);
    }

    const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
    if (!distributor) {
      return error(res, 'Distributor not found', 404);
    }
    if (!distributor.active) {
      return error(res, 'Distributor is inactive — its stock cannot be consumed', 400);
    }

    // Track units already claimed earlier in THIS ticket so two identical
    // stickers each consume a distinct physical unit.
    const claimed = new Set<string>();
    const lines: UsageLine[] = [];

    for (const barcode of barcodes) {
      const parsed = parseGS1(barcode);
      if (isParseError(parsed)) {
        lines.push({ barcode, status: 'error', errorMessage: parsed.error });
        continue;
      }

      const candidates = await prisma.inventoryItem.findMany({
        where: {
          gtinShort: parsed.gtinShort,
          lot: parsed.lot,
          distributorId,
          usedAt: null,
          deletedAt: null,
        },
      });

      const unclaimed = candidates.filter((c) => !claimed.has(c.id));
      const pick = pickFifo(unclaimed);

      const itemNumber = getItemNumber(parsed.gtinShort, parsed.rawBarcode);
      const productLabel = parsed.productLabel || getProductLabel(parsed.gtinShort, parsed.rawBarcode);

      if (!pick) {
        lines.push({
          barcode,
          status: 'not_in_stock',
          productLabel,
          itemNumber,
          lot: parsed.lot,
          expDate: parsed.expDate?.toISOString() ?? null,
          availableCount: 0,
        });
        continue;
      }

      claimed.add(pick.id);
      lines.push({
        barcode,
        status: 'available',
        matchedItemId: pick.id,
        productLabel: pick.productLabel || productLabel,
        itemNumber: getItemNumber(pick.gtinShort, pick.rawBarcode) ?? itemNumber,
        lot: pick.lot,
        expDate: pick.expDate?.toISOString() ?? null,
        availableCount: unclaimed.length,
      });
    }

    return success(res, { distributorId, distributorName: distributor.name, lines });
  } catch (err) {
    return error(res, 'Failed to preview usage', 500);
  }
}

/**
 * POST /api/usage/commit
 * Body: { distributorId, itemIds: string[], note? }
 * Consumes the confirmed units: sets usedAt + writes audit history + creates one
 * UsageTicket, all in a single transaction. Items that were used / moved between
 * preview and commit are reported in `blocked` rather than double-consumed.
 */
export async function commit(req: Request, res: Response) {
  try {
    const { distributorId, itemIds, note } = req.body as {
      distributorId: string;
      itemIds: string[];
      note?: string;
    };

    // A distributor account may only act on its own distributor.
    if (req.user?.role === 'distributor' && distributorId !== req.user.distributorId) {
      return error(res, 'You can only record usage for your own distributor', 403);
    }

    const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
    if (!distributor) {
      return error(res, 'Distributor not found', 404);
    }

    const uniqueIds = [...new Set(itemIds)];
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: uniqueIds } },
    });
    const byId = new Map(items.map((i) => [i.id, i]));

    const consumable: typeof items = [];
    const blocked: { id: string; reason: string }[] = [];

    for (const id of uniqueIds) {
      const item = byId.get(id);
      if (!item || item.deletedAt) {
        blocked.push({ id, reason: 'not_found' });
      } else if (item.usedAt) {
        blocked.push({ id, reason: 'already_used' });
      } else if (item.distributorId !== distributorId) {
        blocked.push({ id, reason: 'wrong_distributor' });
      } else {
        consumable.push(item);
      }
    }

    if (consumable.length === 0) {
      return error(res, 'No items available to consume', 409, { blocked });
    }

    const ticketId = await nextUsageId();
    const usedAt = new Date();
    const username = req.user?.username || null;

    const itemsSnapshot = consumable.map((item) => ({
      id: item.id,
      udi: item.udi,
      itemNumber: getItemNumber(item.gtinShort, item.rawBarcode),
      productLabel: item.productLabel,
      lot: item.lot,
      gtin: item.gtin,
      expDate: item.expDate?.toISOString() ?? null,
    }));

    await prisma.$transaction([
      // Guarded updates: only flip units still available for this distributor,
      // so a unit used between preview and commit simply won't match (0 rows).
      ...consumable.map((item) =>
        prisma.inventoryItem.updateMany({
          where: { id: item.id, usedAt: null, deletedAt: null, distributorId },
          data: { usedAt, usageTicketId: ticketId },
        }),
      ),
      ...consumable.map((item) =>
        prisma.assignmentHistory.create({
          data: {
            itemId: item.id,
            fromDistributorId: item.distributorId,
            fromDistributorName: distributor.name,
            changedBy: username,
            note: `Consumed via usage ticket ${ticketId} (${distributor.name})`,
          },
        }),
      ),
      prisma.usageTicket.create({
        data: {
          ticketId,
          distributorId,
          distributorName: distributor.name,
          note: note || null,
          itemCount: consumable.length,
          items: itemsSnapshot,
          recordedBy: username,
        },
      }),
    ]);

    return success(res, {
      ticketId,
      consumed: consumable.length,
      blocked,
      items: itemsSnapshot,
    });
  } catch (err) {
    return error(res, 'Failed to record usage', 500);
  }
}

/**
 * GET /api/usage
 * List usage tickets, newest first.
 */
export async function list(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(str(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(str(req.query.limit)) || 25));
    const skip = (page - 1) * limit;
    const search = str(req.query.search);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { ticketId: { contains: search, mode: 'insensitive' } },
        { distributorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.usageTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.usageTicket.count({ where }),
    ]);

    return success(res, tickets, { page, limit, total });
  } catch (err) {
    return error(res, 'Failed to fetch usage tickets', 500);
  }
}

/**
 * GET /api/usage/:ticketId
 * Get a single usage ticket by its ticketId.
 */
export async function getOne(req: Request, res: Response) {
  try {
    const ticketId = str(req.params.ticketId);
    const ticket = await prisma.usageTicket.findUnique({ where: { ticketId } });
    if (!ticket) {
      return error(res, 'Usage ticket not found', 404);
    }
    return success(res, ticket);
  } catch (err) {
    return error(res, 'Failed to fetch usage ticket', 500);
  }
}
