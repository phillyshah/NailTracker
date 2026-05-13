import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { parseGS1, isParseError } from '../utils/parseGS1.js';
import {
  getProductLabel,
  getItemNumber,
  refToGtinShort,
  gtinShortToFullGtin,
} from '../utils/gtin-map.js';

/**
 * POST /api/inventory/scan
 * Scan a single barcode — parse it and check if it already exists in the DB.
 */
export async function scan(req: Request, res: Response) {
  try {
    const { barcode } = req.body as { barcode: string };
    const parsed = parseGS1(barcode);

    if (isParseError(parsed)) {
      return success(res, {
        parsed: { ...parsed, status: 'error' as const, errorMessage: parsed.error },
        existing: null,
      });
    }

    // Check if this UDI already exists
    const existing = await prisma.inventoryItem.findUnique({
      where: { udi: parsed.udi },
      include: { distributor: { select: { id: true, name: true } } },
    });

    // Exclude soft-deleted or used items from "existing" match
    const activeExisting = existing && !existing.deletedAt && !existing.usedAt ? existing : null;

    return success(res, {
      parsed: {
        ...parsed,
        expDate: parsed.expDate?.toISOString() ?? null,
        status: activeExisting ? ('duplicate' as const) : ('new' as const),
      },
      existing: activeExisting,
    });
  } catch (err) {
    return error(res, 'Scan failed', 500);
  }
}

/**
 * POST /api/inventory/parse
 * Parse multiple barcodes and check for duplicates.
 */
export async function parse(req: Request, res: Response) {
  try {
    const { barcodes } = req.body as { barcodes: string[] };
    const results = barcodes.map((b: string) => parseGS1(b));

    // Check for duplicates in DB
    const udis = results
      .filter((r) => !isParseError(r))
      .map((r) => (r as { udi: string }).udi);

    const existing = await prisma.inventoryItem.findMany({
      where: { udi: { in: udis }, deletedAt: null, usedAt: null },
      select: { udi: true },
    });
    const existingSet = new Set(existing.map((e: { udi: string }) => e.udi));

    const enriched = results.map((r) => {
      if (isParseError(r)) {
        return { ...r, status: 'error' as const };
      }
      const isDuplicate = existingSet.has(r.udi);
      return {
        ...r,
        expDate: r.expDate?.toISOString() ?? null,
        status: isDuplicate ? ('duplicate' as const) : ('new' as const),
      };
    });

    return success(res, enriched);
  } catch (err) {
    return error(res, 'Parse failed', 500);
  }
}

/**
 * POST /api/inventory/assign
 * Assign one or more parsed items to a distributor. Optionally stores image.
 */
export async function assign(req: Request, res: Response) {
  try {
    const { items, distributorId, imageData } = req.body;

    let distributor = null;
    if (distributorId) {
      distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
      if (!distributor) {
        return error(res, 'Distributor not found', 404);
      }
    }

    let created = 0;
    let skipped = 0;

    for (const item of items) {
      const existing = await prisma.inventoryItem.findUnique({ where: { udi: item.udi } });

      if (existing && !existing.deletedAt && !existing.usedAt) {
        // Active item already exists — skip
        skipped++;
        continue;
      }

      if (existing && (existing.deletedAt || existing.usedAt)) {
        // Previously deleted or used — restore with updated data
        await prisma.inventoryItem.update({
          where: { udi: item.udi },
          data: {
            gtin: item.gtin,
            gtinShort: item.gtinShort,
            lot: item.lot,
            expDate: item.expDate ? new Date(item.expDate) : null,
            rawBarcode: item.rawBarcode,
            productLabel: item.productLabel,
            imageData: item.imageData || imageData || null,
            distributorId: distributorId || null,
            assignedAt: distributorId ? new Date() : null,
            assignedBy: req.user?.username || null,
            deletedAt: null,
            usedAt: null,
          },
        });

        if (distributorId) {
          await prisma.assignmentHistory.create({
            data: {
              itemId: existing.id,
              toDistributorId: distributorId,
              toDistributorName: distributor?.name || null,
              changedBy: req.user?.username || null,
              note: 'Re-added to inventory',
            },
          });
        }

        created++;
        continue;
      }

      const newItem = await prisma.inventoryItem.create({
        data: {
          udi: item.udi,
          gtin: item.gtin,
          gtinShort: item.gtinShort,
          lot: item.lot,
          expDate: item.expDate ? new Date(item.expDate) : null,
          rawBarcode: item.rawBarcode,
          productLabel: item.productLabel,
          imageData: item.imageData || imageData || null,
          distributorId: distributorId || null,
          assignedAt: distributorId ? new Date() : null,
          assignedBy: req.user?.username || null,
        },
      });

      if (distributorId) {
        await prisma.assignmentHistory.create({
          data: {
            itemId: newItem.id,
            toDistributorId: distributorId,
            toDistributorName: distributor?.name || null,
            changedBy: req.user?.username || null,
            note: 'Initial assignment',
          },
        });
      }

      created++;
    }

    return success(res, { created, skipped });
  } catch (err) {
    return error(res, 'Assignment failed', 500);
  }
}

export async function list(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(str(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(str(req.query.limit)) || 25));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null, usedAt: null };

    const distributorId = str(req.query.distributorId);
    if (distributorId) {
      where.distributorId = distributorId;
    }

    if (str(req.query.unassigned) === 'true') {
      where.distributorId = null;
    }

    const search = str(req.query.search);
    if (search) {
      where.OR = [
        { udi: { contains: search, mode: 'insensitive' } },
        { lot: { contains: search, mode: 'insensitive' } },
        { productLabel: { contains: search, mode: 'insensitive' } },
      ];
    }

    const expBefore = str(req.query.expBefore);
    if (expBefore) {
      where.expDate = { lte: new Date(expBefore) };
    }

    if (str(req.query.expired) === 'true') {
      where.expDate = { lt: new Date() };
    }

    const expiringInDays = parseInt(str(req.query.expiringInDays), 10);
    if (expiringInDays > 0) {
      const now = new Date();
      const cutoff = new Date(now.getTime() + expiringInDays * 24 * 60 * 60 * 1000);
      where.expDate = { gt: now, lte: cutoff };
    }

    // Sortable columns -> Prisma orderBy spec. Anything else falls back to createdAt desc.
    const sortBy = str(req.query.sortBy);
    const sortDir: 'asc' | 'desc' = str(req.query.sortDir) === 'asc' ? 'asc' : 'desc';
    const sortMap: Record<string, Record<string, unknown>> = {
      productLabel: { productLabel: sortDir },
      lot: { lot: sortDir },
      expDate: { expDate: sortDir },
      distributor: { distributor: { name: sortDir } },
      createdAt: { createdAt: sortDir },
      assignedAt: { assignedAt: sortDir },
      gtinShort: { gtinShort: sortDir },
      itemNumber: { gtinShort: sortDir },
    };
    const orderBy = sortMap[sortBy] || { gtinShort: 'asc' };

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: { distributor: { select: { id: true, name: true } } },
        orderBy,
        skip,
        take: limit,
        // Don't return imageData in list view (too large)
        omit: { imageData: true },
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    const enriched = items.map((it: { gtinShort: string; rawBarcode: string }) => ({
      ...it,
      itemNumber: getItemNumber(it.gtinShort, it.rawBarcode),
    }));

    return success(res, enriched, { page, limit, total });
  } catch (err) {
    return error(res, 'Failed to fetch inventory', 500);
  }
}

export async function getOne(req: Request, res: Response) {
  try {
    const udi = str(req.params.udi);
    const item = await prisma.inventoryItem.findUnique({
      where: { udi },
      include: {
        distributor: true,
        history: { orderBy: { changedAt: 'desc' } },
      },
    });

    if (!item || item.deletedAt) {
      return error(res, 'Item not found', 404);
    }

    return success(res, { ...item, itemNumber: getItemNumber(item.gtinShort, item.rawBarcode) });
  } catch (err) {
    return error(res, 'Failed to fetch item', 500);
  }
}

/**
 * Generate the next TRF-YYYYMMDD-NNNN id.
 * (Duplicated from transfer.controller — kept here to avoid a circular import.)
 */
async function nextTransferId(): Promise<string> {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRF-${dateStr}`;
  const last = await prisma.transfer.findFirst({
    where: { transferId: { startsWith: prefix } },
    orderBy: { transferId: 'desc' },
  });
  let seq = 1;
  if (last) {
    const lastSeq = parseInt(last.transferId.split('-').pop() || '0', 10);
    seq = lastSeq + 1;
  }
  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

export async function reassign(req: Request, res: Response) {
  try {
    const { distributorId, note, skipTransferRecord } = req.body as {
      distributorId?: string | null;
      note?: string;
      skipTransferRecord?: boolean;
    };
    const udi = str(req.params.udi);

    const item = await prisma.inventoryItem.findUnique({
      where: { udi },
      include: { distributor: true },
    });

    if (!item || item.deletedAt) {
      return error(res, 'Item not found', 404);
    }

    let newDistributor = null;
    if (distributorId) {
      newDistributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
      if (!newDistributor) {
        return error(res, 'Distributor not found', 404);
      }
    }

    const oldDistId = item.distributorId;
    const newDistId = distributorId || null;
    const distributorChanged = oldDistId !== newDistId;

    // Generate a Transfer id up front so we can include it inline in the
    // $transaction call (avoiding TS issues with array-typed ops).
    let transferId: string | null = null;
    if (distributorChanged && !skipTransferRecord) {
      transferId = await nextTransferId();
    }

    await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { udi },
        data: {
          distributorId: newDistId,
          assignedAt: newDistId ? new Date() : null,
          assignedBy: req.user?.username || null,
        },
      }),
      prisma.assignmentHistory.create({
        data: {
          itemId: item.id,
          fromDistributorId: oldDistId,
          fromDistributorName: item.distributor?.name || null,
          toDistributorId: newDistId,
          toDistributorName: newDistributor?.name || null,
          changedBy: req.user?.username || null,
          note: note || null,
        },
      }),
      ...(transferId
        ? [
            prisma.transfer.create({
              data: {
                transferId,
                fromDistributorId: oldDistId,
                fromDistributorName: item.distributor?.name || 'Unassigned',
                toDistributorId: newDistId,
                toDistributorName: newDistributor?.name || 'Unassigned',
                note: note || null,
                itemCount: 1,
                items: [
                  {
                    udi: item.udi,
                    itemNumber: getItemNumber(item.gtinShort, item.rawBarcode),
                    productLabel: item.productLabel,
                    lot: item.lot,
                    gtin: item.gtin,
                    expDate: item.expDate?.toISOString() || null,
                  },
                ],
                transferredBy: req.user?.username || null,
              },
            }),
          ]
        : []),
    ]);

    return success(res, { message: 'Item reassigned', transferId });
  } catch (err) {
    return error(res, 'Reassignment failed', 500);
  }
}

/**
 * PATCH /api/inventory/:udi/edit
 * Edit item fields (GTIN, item number, lot, expiry, product label).
 * Recomputes derived fields (gtinShort, udi, productLabel) and writes
 * a row to AssignmentHistory describing exactly what changed.
 *
 * If an item number (REF) is provided that matches the Summa catalog,
 * the canonical GTIN/gtinShort for that REF wins (REF is master).
 */
export async function edit(req: Request, res: Response) {
  try {
    const udi = str(req.params.udi);
    const { gtin, lot, expDate, itemNumber, productLabel, mergeIfConflict } = req.body as {
      gtin?: string;
      lot?: string;
      expDate?: string | null;
      itemNumber?: string;
      productLabel?: string;
      mergeIfConflict?: boolean;
    };

    const item = await prisma.inventoryItem.findUnique({
      where: { udi },
      include: { distributor: true },
    });
    if (!item || item.deletedAt) {
      return error(res, 'Item not found', 404);
    }

    let newGtin = item.gtin;
    let newGtinShort = item.gtinShort;
    let newLot = item.lot;
    let newExpDate: Date | null = item.expDate;
    let newProductLabel = item.productLabel;

    // If REF is provided AND matches a known catalog entry, REF is master.
    if (typeof itemNumber === 'string' && itemNumber.trim()) {
      const ref = itemNumber.trim().toUpperCase();
      const canonicalShort = refToGtinShort[ref];
      if (canonicalShort) {
        newGtinShort = canonicalShort;
        newGtin = gtinShortToFullGtin(canonicalShort);
      }
      // If REF isn't in the catalog, we ignore it for GTIN purposes;
      // it can still surface via getItemNumber from rawBarcode.
    }

    if (typeof gtin === 'string' && gtin.trim()) {
      const g = gtin.trim();
      if (!/^\d{14}$/.test(g)) {
        return error(res, 'GTIN must be exactly 14 digits', 400);
      }
      newGtin = g;
      newGtinShort = g.replace(/^0+/, '').slice(-7);
    }

    if (typeof lot === 'string' && lot.trim()) {
      newLot = lot.trim();
    }

    if (expDate !== undefined) {
      newExpDate = expDate ? new Date(expDate) : null;
    }

    // Decide productLabel:
    //   - explicit override wins
    //   - otherwise auto-derive only if gtinShort actually changed
    //   - otherwise keep the existing label
    if (typeof productLabel === 'string' && productLabel.trim()) {
      newProductLabel = productLabel.trim();
    } else if (newGtinShort !== item.gtinShort) {
      newProductLabel = getProductLabel(newGtinShort, item.rawBarcode);
    }

    const newUdi = `${newGtinShort}-${newLot}`;

    if (newUdi !== item.udi) {
      const conflict = await prisma.inventoryItem.findUnique({
        where: { udi: newUdi },
        include: { distributor: true },
      });
      if (conflict && conflict.id !== item.id && !conflict.deletedAt && !conflict.usedAt) {
        if (mergeIfConflict) {
          // Soft-delete the current (duplicate) item and log on both records.
          await prisma.$transaction([
            prisma.inventoryItem.update({
              where: { id: item.id },
              data: { deletedAt: new Date() },
            }),
            prisma.assignmentHistory.create({
              data: {
                itemId: item.id,
                fromDistributorId: item.distributorId,
                fromDistributorName: item.distributor?.name || null,
                toDistributorId: item.distributorId,
                toDistributorName: item.distributor?.name || null,
                changedBy: req.user?.username || null,
                note: `Merged into ${conflict.udi} (duplicate scan deleted)`,
              },
            }),
            prisma.assignmentHistory.create({
              data: {
                itemId: conflict.id,
                fromDistributorId: conflict.distributorId,
                fromDistributorName: conflict.distributor?.name || null,
                toDistributorId: conflict.distributorId,
                toDistributorName: conflict.distributor?.name || null,
                changedBy: req.user?.username || null,
                note: `Duplicate scan merged from ${item.udi}`,
              },
            }),
          ]);
          return success(res, { udi: conflict.udi, merged: true, message: 'Duplicate merged' });
        }
        return error(
          res,
          `Another active item already exists with UDI ${newUdi}`,
          409,
          { conflictUdi: newUdi },
        );
      }
    }

    const changes: string[] = [];
    if (item.gtin !== newGtin) changes.push(`GTIN: ${item.gtin} → ${newGtin}`);
    if (item.gtinShort !== newGtinShort) changes.push(`GTIN Short: ${item.gtinShort} → ${newGtinShort}`);
    if (item.lot !== newLot) changes.push(`Lot: ${item.lot} → ${newLot}`);
    if (item.udi !== newUdi) changes.push(`UDI: ${item.udi} → ${newUdi}`);
    const oldExp = item.expDate ? item.expDate.toISOString().slice(0, 10) : 'none';
    const nextExp = newExpDate ? newExpDate.toISOString().slice(0, 10) : 'none';
    if (oldExp !== nextExp) changes.push(`Expiry: ${oldExp} → ${nextExp}`);
    if (item.productLabel !== newProductLabel) {
      changes.push(`Label: ${item.productLabel ?? 'none'} → ${newProductLabel ?? 'none'}`);
    }

    if (changes.length === 0) {
      return success(res, { udi: item.udi, message: 'No changes' });
    }

    await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          gtin: newGtin,
          gtinShort: newGtinShort,
          lot: newLot,
          udi: newUdi,
          expDate: newExpDate,
          productLabel: newProductLabel,
        },
      }),
      prisma.assignmentHistory.create({
        data: {
          itemId: item.id,
          fromDistributorId: item.distributorId,
          fromDistributorName: item.distributor?.name || null,
          toDistributorId: item.distributorId,
          toDistributorName: item.distributor?.name || null,
          changedBy: req.user?.username || null,
          note: `Edited — ${changes.join('; ')}`,
        },
      }),
    ]);

    return success(res, { udi: newUdi, message: 'Item updated' });
  } catch (err) {
    return error(res, 'Edit failed', 500);
  }
}

/**
 * PATCH /api/inventory/:udi/use
 * Mark an item as used (implanted).
 */
export async function markUsed(req: Request, res: Response) {
  try {
    const udi = str(req.params.udi);

    const item = await prisma.inventoryItem.findUnique({
      where: { udi },
      include: { distributor: true },
    });

    if (!item || item.deletedAt) {
      return error(res, 'Item not found', 404);
    }

    if (item.usedAt) {
      return error(res, 'Item already marked as used', 400);
    }

    await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { udi },
        data: { usedAt: new Date() },
      }),
      prisma.assignmentHistory.create({
        data: {
          itemId: item.id,
          fromDistributorId: item.distributorId,
          fromDistributorName: item.distributor?.name || null,
          changedBy: req.user?.username || null,
          note: 'Marked as used (implanted)',
        },
      }),
    ]);

    return success(res, { message: 'Item marked as used' });
  } catch (err) {
    return error(res, 'Failed to mark item as used', 500);
  }
}

/**
 * POST /api/inventory/backfill-expiry
 * Re-parse rawBarcodes on items with missing expDate and fill them in.
 */
export async function backfillExpiry(_req: Request, res: Response) {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { expDate: null, deletedAt: null },
      select: { id: true, rawBarcode: true },
    });

    let updated = 0;
    for (const item of items) {
      const parsed = parseGS1(item.rawBarcode);
      if (!isParseError(parsed) && parsed.expDate) {
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { expDate: parsed.expDate },
        });
        updated++;
      }
    }

    return success(res, { total: items.length, updated });
  } catch (err) {
    return error(res, 'Backfill failed', 500);
  }
}

/**
 * POST /api/inventory/backfill-labels
 * Re-resolve productLabel for all items using the current GTIN map.
 * Fixes items showing "Unknown" or outdated labels after map updates.
 */
export async function backfillLabels(_req: Request, res: Response) {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { deletedAt: null },
      select: { id: true, gtinShort: true, rawBarcode: true, productLabel: true },
    });

    let updated = 0;
    for (const item of items) {
      const newLabel = getProductLabel(item.gtinShort, item.rawBarcode);
      if (newLabel !== item.productLabel) {
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { productLabel: newLabel },
        });
        updated++;
      }
    }

    return success(res, { total: items.length, updated });
  } catch (err) {
    return error(res, 'Label backfill failed', 500);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const udi = str(req.params.udi);
    const item = await prisma.inventoryItem.findUnique({
      where: { udi },
    });

    if (!item || item.deletedAt) {
      return error(res, 'Item not found', 404);
    }

    await prisma.inventoryItem.update({
      where: { udi },
      data: { deletedAt: new Date() },
    });

    return success(res, { message: 'Item deleted' });
  } catch (err) {
    return error(res, 'Delete failed', 500);
  }
}
