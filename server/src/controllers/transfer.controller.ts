import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { parseGS1, isParseError } from '../utils/parseGS1.js';
import { getItemNumber, getProductLabel } from '../utils/gtin-map.js';
import { pickFifo } from '../utils/usageMatch.js';

/**
 * Generate a transfer ID: TRF-YYYYMMDD-XXXX (sequential per day).
 * Exported for reuse by bank moves so they get the same audit trail.
 */
export async function generateTransferId(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRF-${dateStr}`;

  const lastToday = await prisma.transfer.findFirst({
    where: { transferId: { startsWith: prefix } },
    orderBy: { transferId: 'desc' },
  });

  let seq = 1;
  if (lastToday) {
    const lastSeq = parseInt(lastToday.transferId.split('-').pop() || '0', 10);
    seq = lastSeq + 1;
  }

  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/**
 * POST /api/transfers
 * Create a transfer record after items have been reassigned.
 */
export async function create(req: Request, res: Response) {
  try {
    const { fromDistributorId, fromDistributorName, toDistributorId, toDistributorName, note, items } = req.body;

    const transferId = await generateTransferId();

    const transfer = await prisma.transfer.create({
      data: {
        transferId,
        fromDistributorId: fromDistributorId || null,
        fromDistributorName,
        toDistributorId: toDistributorId || null,
        toDistributorName,
        note: note || null,
        itemCount: items.length,
        items,
        transferredBy: req.user?.username || null,
      },
    });

    return success(res, transfer, undefined, 201);
  } catch (err) {
    return error(res, 'Failed to create transfer record', 500);
  }
}

/**
 * Per-line shape returned by previewBatch. Mirrors UsageLine — the client
 * displays a status badge per row and uses the `parsed` payload to offer
 * "Add to source & include" for not_in_stock rows without re-parsing.
 */
type BatchLineStatus = 'available' | 'not_in_stock' | 'error';

interface BatchLine {
  barcode: string;
  status: BatchLineStatus;
  matchedItemId?: string;
  productLabel?: string;
  itemNumber?: string | null;
  lot?: string;
  expDate?: string | null;
  availableCount?: number;
  errorMessage?: string;
  // Present for 'available' and 'not_in_stock' so the client can add a missing
  // item to the source distributor without parsing the barcode again.
  parsed?: {
    gtin: string;
    gtinShort: string;
    lot: string;
    expDate: string | null;
    udi: string;
    rawBarcode: string;
    productLabel: string;
  };
}

/** Already-parsed item supplied by the client (Manual Entry "fields" submode),
 *  which can't go through parseGS1 because its rawBarcode is a REF code. */
interface ParsedItemInput {
  gtin?: string;
  gtinShort?: string;
  lot?: string;
  expDate?: string | null;
  udi?: string;
  rawBarcode?: string;
  productLabel?: string;
}

type ParsedPayload = NonNullable<BatchLine['parsed']>;

/**
 * Resolve one parsed item to an available unit at the source distributor
 * (gtinShort + lot, FIFO), honouring the per-request `claimed` set so identical
 * inputs each take a distinct physical unit. Shared by the barcode and the
 * already-parsed (manual fields) inputs so both dedup against the same set.
 */
async function matchAtSource(
  identifier: string,
  parsed: ParsedPayload,
  fromDistributorId: string,
  claimed: Set<string>,
): Promise<BatchLine> {
  const candidates = await prisma.inventoryItem.findMany({
    where: {
      gtinShort: parsed.gtinShort,
      lot: parsed.lot,
      distributorId: fromDistributorId,
      usedAt: null,
      deletedAt: null,
    },
  });

  const unclaimed = candidates.filter((c) => !claimed.has(c.id));
  const pick = pickFifo(unclaimed);
  const itemNumber = getItemNumber(parsed.gtinShort, parsed.rawBarcode);

  if (!pick) {
    return {
      barcode: identifier,
      status: 'not_in_stock',
      productLabel: parsed.productLabel,
      itemNumber,
      lot: parsed.lot,
      expDate: parsed.expDate,
      availableCount: 0,
      parsed,
    };
  }

  claimed.add(pick.id);
  return {
    barcode: identifier,
    status: 'available',
    matchedItemId: pick.id,
    productLabel: pick.productLabel || parsed.productLabel,
    itemNumber: getItemNumber(pick.gtinShort, pick.rawBarcode) ?? itemNumber,
    lot: pick.lot,
    expDate: pick.expDate?.toISOString() ?? null,
    availableCount: unclaimed.length,
    parsed,
  };
}

/**
 * POST /api/transfers/preview-batch
 * Body: { fromDistributorId, barcodes?: string[], items?: ParsedItemInput[] }
 * Read-only — resolves each barcode (and each already-parsed manual item) to an
 * available unit at the SOURCE distributor (gtinShort + lot, FIFO), with
 * within-batch dedup so two identical stickers each claim a distinct physical
 * unit. The matching pattern mirrors the Usage Tickets preview; the commit
 * happens client-side via reassignItem.
 */
export async function previewBatch(req: Request, res: Response) {
  try {
    const { fromDistributorId } = req.body as { fromDistributorId: string };
    const barcodes: string[] = Array.isArray(req.body.barcodes) ? req.body.barcodes : [];
    const items: ParsedItemInput[] = Array.isArray(req.body.items) ? req.body.items : [];

    if (!fromDistributorId) {
      return error(res, 'fromDistributorId is required', 400);
    }
    if (barcodes.length === 0 && items.length === 0) {
      return error(res, 'barcodes or items is required and must be non-empty', 400);
    }

    const distributor = await prisma.distributor.findUnique({ where: { id: fromDistributorId } });
    if (!distributor) {
      return error(res, 'Source distributor not found', 404);
    }
    if (!distributor.active) {
      return error(res, 'Source distributor is inactive — its stock cannot be transferred', 400);
    }

    // A single claimed set spans BOTH input kinds so a barcode and a manual
    // item for the same lot can't both grab the same source unit.
    const claimed = new Set<string>();
    const lines: BatchLine[] = [];

    for (const barcode of barcodes) {
      const parsed = parseGS1(barcode);
      if (isParseError(parsed)) {
        lines.push({ barcode, status: 'error', errorMessage: parsed.error });
        continue;
      }
      const parsedPayload: ParsedPayload = {
        gtin: parsed.gtin,
        gtinShort: parsed.gtinShort,
        lot: parsed.lot,
        expDate: parsed.expDate?.toISOString() ?? null,
        udi: parsed.udi,
        rawBarcode: parsed.rawBarcode,
        productLabel: parsed.productLabel || getProductLabel(parsed.gtinShort, parsed.rawBarcode),
      };
      lines.push(await matchAtSource(barcode, parsedPayload, fromDistributorId, claimed));
    }

    for (const item of items) {
      const gtinShort = String(item.gtinShort || '');
      const lot = String(item.lot || '');
      const identifier = item.udi || item.rawBarcode || `${gtinShort}-${lot}`;
      if (!gtinShort || !lot) {
        lines.push({ barcode: identifier, status: 'error', errorMessage: 'Manual item is missing its GTIN or lot' });
        continue;
      }
      const rawBarcode = item.rawBarcode || '';
      const parsedPayload: ParsedPayload = {
        gtin: item.gtin || '',
        gtinShort,
        lot,
        expDate: item.expDate ?? null,
        udi: item.udi || `${gtinShort}-${lot}`,
        rawBarcode,
        // Re-derive the label server-side rather than trusting the client.
        productLabel: getProductLabel(gtinShort, rawBarcode),
      };
      lines.push(await matchAtSource(parsedPayload.udi, parsedPayload, fromDistributorId, claimed));
    }

    return success(res, {
      fromDistributorId,
      fromDistributorName: distributor.name,
      lines,
    });
  } catch (err) {
    return error(res, 'Failed to preview batch transfer', 500);
  }
}

/**
 * GET /api/transfers
 * List all transfers, newest first.
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
        { transferId: { contains: search, mode: 'insensitive' } },
        { fromDistributorName: { contains: search, mode: 'insensitive' } },
        { toDistributorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transfer.count({ where }),
    ]);

    return success(res, transfers, { page, limit, total });
  } catch (err) {
    return error(res, 'Failed to fetch transfers', 500);
  }
}

/**
 * GET /api/transfers/:transferId
 * Get a single transfer by its transferId.
 */
export async function getOne(req: Request, res: Response) {
  try {
    const transferId = str(req.params.transferId);
    const transfer = await prisma.transfer.findUnique({
      where: { transferId },
    });

    if (!transfer) {
      return error(res, 'Transfer not found', 404);
    }

    return success(res, transfer);
  } catch (err) {
    return error(res, 'Failed to fetch transfer', 500);
  }
}
