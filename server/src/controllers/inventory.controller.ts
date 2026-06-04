import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { parseGS1, isParseError } from '../utils/parseGS1.js';
import { parseDateOnly, formatDateOnly, normalizeToUtcMidnight } from '../utils/date.js';
import { extractBarcodes } from '../utils/spreadsheet.js';
import {
  getProductLabel,
  getItemNumber,
  refToGtinShort,
  gtinShortToFullGtin,
  findGtinShortsByItemNumber,
} from '../utils/gtin-map.js';

/**
 * POST /api/inventory/scan
 * Parse a single barcode. Each physical unit is its own inventory row,
 * so we never block on "this UDI already exists" — multiple units can
 * legitimately share GTIN + Lot.
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

    return success(res, {
      parsed: {
        ...parsed,
        expDate: parsed.expDate?.toISOString() ?? null,
        status: 'new' as const,
      },
      existing: null,
    });
  } catch (err) {
    return error(res, 'Scan failed', 500);
  }
}

/**
 * POST /api/inventory/scan-manual
 * Build a parsed item from individually-entered fields (Item Number / Lot /
 * Expiration) instead of a scanned barcode. The Item Number is a Summa REF
 * code, resolved to a GTIN via the product map (same resolution edit() uses),
 * so the result is processed exactly as if it had come from a scan.
 */
export async function scanManual(req: Request, res: Response) {
  try {
    const { itemNumber, lot, expDate } = req.body as {
      itemNumber: string;
      lot: string;
      expDate?: string | null;
    };

    const ref = itemNumber.trim().toUpperCase();
    let gtin = '';
    let gtinShort = '';

    const canonicalShort = refToGtinShort[ref];
    if (canonicalShort) {
      gtinShort = canonicalShort;
      gtin = gtinShortToFullGtin(canonicalShort);
    } else if (/^\d{1,14}$/.test(itemNumber.trim())) {
      // Graceful fallback: a numeric barcode value was typed instead of a REF.
      gtin = itemNumber.trim().padStart(14, '0');
      gtinShort = gtin.replace(/^0+/, '').slice(-7);
    } else {
      return error(res, `Unknown item number "${itemNumber.trim()}" — not found in product catalog`, 400);
    }

    const trimmedLot = lot.trim();
    // Interpret a bare "YYYY-MM-DD" at local midnight (same as the scan path),
    // not UTC midnight — otherwise it renders one day early when displayed.
    const parsedExp = parseDateOnly(expDate);

    return success(res, {
      parsed: {
        gtin,
        gtinShort,
        lot: trimmedLot,
        expDate: parsedExp ? parsedExp.toISOString() : null,
        udi: `${gtinShort}-${trimmedLot}`,
        rawBarcode: ref,
        productLabel: getProductLabel(gtinShort, ref),
        status: 'new' as const,
      },
      existing: null,
    });
  } catch (err) {
    return error(res, 'Manual entry failed', 500);
  }
}

/**
 * POST /api/inventory/parse
 * Parse multiple barcodes. Same per-unit semantics as scan() —
 * matching UDIs are not duplicates.
 */
export async function parse(req: Request, res: Response) {
  try {
    const { barcodes } = req.body as { barcodes: string[] };
    const results = barcodes.map((b: string) => parseGS1(b));

    const enriched = results.map((r) => {
      if (isParseError(r)) {
        return { ...r, status: 'error' as const };
      }
      return {
        ...r,
        expDate: r.expDate?.toISOString() ?? null,
        status: 'new' as const,
      };
    });

    return success(res, enriched);
  } catch (err) {
    return error(res, 'Parse failed', 500);
  }
}

/**
 * POST /api/inventory/parse-spreadsheet
 * Extract barcode strings from an uploaded CSV/TXT or Excel (.xlsx) file. The
 * file arrives base64-encoded; parsing happens here (via exceljs) so .xlsx
 * uploads work identically on desktop and mobile — the browser only reads the
 * raw bytes. Returns the barcode strings; the client then runs them through the
 * normal scan/parse flow.
 */
export async function parseSpreadsheet(req: Request, res: Response) {
  try {
    const { dataBase64 } = req.body as { fileName?: string; dataBase64: string };
    const buf = Buffer.from(dataBase64, 'base64');
    if (buf.length === 0) return error(res, 'The uploaded file is empty', 400);

    const barcodes = await extractBarcodes(buf);
    if (barcodes.length === 0) {
      return error(
        res,
        'No barcode data found. Put one barcode per row in the first column.',
        400,
      );
    }
    return success(res, { barcodes });
  } catch (err) {
    return error(
      res,
      err instanceof Error ? err.message : 'Could not read the spreadsheet',
      400,
    );
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

    for (const item of items) {
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

    return success(res, { created, skipped: 0 });
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

    const gtinShort = str(req.query.gtinShort);
    if (gtinShort) {
      where.gtinShort = gtinShort;
    }

    const search = str(req.query.search);
    if (search) {
      const or: Record<string, unknown>[] = [
        { udi: { contains: search, mode: 'insensitive' } },
        { lot: { contains: search, mode: 'insensitive' } },
        { productLabel: { contains: search, mode: 'insensitive' } },
        { gtinShort: { contains: search, mode: 'insensitive' } },
        // Manual entries store the REF in rawBarcode; this also matches raw GS1.
        { rawBarcode: { contains: search, mode: 'insensitive' } },
      ];
      // Item number (REF) search: scanned items store only the gtinShort, so
      // translate the REF back through the catalog to the matching gtinShorts.
      const refGtins = findGtinShortsByItemNumber(search);
      if (refGtins.length > 0) {
        or.push({ gtinShort: { in: refGtins } });
      }
      where.OR = or;
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
    const id = str(req.params.id);
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
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
    const { distributorId, note, skipTransferRecord, expectedFromDistributorId } = req.body as {
      distributorId?: string | null;
      note?: string;
      skipTransferRecord?: boolean;
      expectedFromDistributorId?: string | null;
    };
    const id = str(req.params.id);

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: { distributor: true },
    });

    if (!item || item.deletedAt) {
      return error(res, 'Item not found', 404);
    }

    // Optional source guard for batch transfer: bail (409) if the item has
    // moved since the user previewed it, rather than silently relocating it.
    if (
      expectedFromDistributorId !== undefined &&
      item.distributorId !== expectedFromDistributorId
    ) {
      return error(res, 'Item is no longer at the expected source distributor', 409);
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

    let transferId: string | null = null;
    if (distributorChanged && !skipTransferRecord) {
      transferId = await nextTransferId();
    }

    await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id },
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
                    id: item.id,
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
 * PATCH /api/inventory/:id/edit
 * Edit item fields. Recomputes derived fields (gtinShort, udi, productLabel)
 * and writes a row to AssignmentHistory describing exactly what changed.
 *
 * UDI is no longer unique (multiple physical units can share GTIN+Lot),
 * so editing never has a "conflict" — it just updates the row.
 */
export async function edit(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const { gtin, lot, expDate, itemNumber, productLabel } = req.body as {
      gtin?: string;
      lot?: string;
      expDate?: string | null;
      itemNumber?: string;
      productLabel?: string;
    };

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
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

    if (typeof itemNumber === 'string' && itemNumber.trim()) {
      const ref = itemNumber.trim().toUpperCase();
      const canonicalShort = refToGtinShort[ref];
      if (canonicalShort) {
        newGtinShort = canonicalShort;
        newGtin = gtinShortToFullGtin(canonicalShort);
      }
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
      newExpDate = parseDateOnly(expDate);
    }

    if (typeof productLabel === 'string' && productLabel.trim()) {
      newProductLabel = productLabel.trim();
    } else if (newGtinShort !== item.gtinShort) {
      newProductLabel = getProductLabel(newGtinShort, item.rawBarcode);
    }

    const newUdi = `${newGtinShort}-${newLot}`;

    const changes: string[] = [];
    if (item.gtin !== newGtin) changes.push(`GTIN: ${item.gtin} → ${newGtin}`);
    if (item.gtinShort !== newGtinShort) changes.push(`GTIN Short: ${item.gtinShort} → ${newGtinShort}`);
    if (item.lot !== newLot) changes.push(`Lot: ${item.lot} → ${newLot}`);
    if (item.udi !== newUdi) changes.push(`UDI: ${item.udi} → ${newUdi}`);
    const oldExp = item.expDate ? formatDateOnly(item.expDate) : 'none';
    const nextExp = newExpDate ? formatDateOnly(newExpDate) : 'none';
    if (oldExp !== nextExp) changes.push(`Expiry: ${oldExp} → ${nextExp}`);
    if (item.productLabel !== newProductLabel) {
      changes.push(`Label: ${item.productLabel ?? 'none'} → ${newProductLabel ?? 'none'}`);
    }

    if (changes.length === 0) {
      return success(res, { id: item.id, udi: item.udi, message: 'No changes' });
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

    return success(res, { id: item.id, udi: newUdi, message: 'Item updated' });
  } catch (err) {
    return error(res, 'Edit failed', 500);
  }
}

/**
 * PATCH /api/inventory/:id/use
 * Mark an item as used (implanted).
 */
export async function markUsed(req: Request, res: Response) {
  try {
    const id = str(req.params.id);

    const item = await prisma.inventoryItem.findUnique({
      where: { id },
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
        where: { id },
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

/**
 * POST /api/inventory/backfill-manual-expiry
 * Normalizes every stored expiry to the canonical representation: UTC midnight
 * of its UTC calendar day (see utils/date.ts). This flattens any time-of-day a
 * scan baked in (e.g. local-midnight-plus-offset) to a clean "T00:00:00.000Z"
 * without shifting the calendar day, so the UTC display renders the intended
 * date everywhere. Idempotent — only rows not already at UTC midnight change.
 */
export async function backfillManualExpiry(_req: Request, res: Response) {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { deletedAt: null, expDate: { not: null } },
      select: { id: true, expDate: true },
    });

    let updated = 0;
    for (const item of items) {
      const exp = item.expDate;
      if (!exp) continue;
      const corrected = normalizeToUtcMidnight(exp);
      if (corrected.getTime() !== exp.getTime()) {
        await prisma.inventoryItem.update({
          where: { id: item.id },
          data: { expDate: corrected },
        });
        updated++;
      }
    }

    return success(res, { total: items.length, updated });
  } catch (err) {
    return error(res, 'Manual expiry backfill failed', 500);
  }
}

/**
 * POST /api/inventory/backfill-reparse
 * Re-derives lot / expiry / GTIN / label from each item's stored rawBarcode
 * using the current parser, repairing rows imported before the GS1 lot-vs-AI
 * disambiguation fix (e.g. lots truncated like "J260225-L" with a bogus 2007
 * expiry). The rawBarcode is the source of truth, so this is safe and
 * idempotent — only rows whose stored values disagree with a fresh parse change.
 * Rows whose rawBarcode isn't a parseable GS1 string (e.g. manual REF entries)
 * are left untouched.
 */
export async function backfillReparse(_req: Request, res: Response) {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        rawBarcode: true,
        lot: true,
        udi: true,
        gtinShort: true,
        expDate: true,
        productLabel: true,
      },
    });

    let updated = 0;
    for (const item of items) {
      const parsed = parseGS1(item.rawBarcode);
      if (isParseError(parsed) || !parsed.lot) continue;

      const data: Record<string, unknown> = {};
      if (parsed.lot !== item.lot) data.lot = parsed.lot;
      if (parsed.udi !== item.udi) data.udi = parsed.udi;
      if (parsed.gtinShort !== item.gtinShort) data.gtinShort = parsed.gtinShort;
      if (parsed.productLabel !== item.productLabel) data.productLabel = parsed.productLabel;
      const newExp = parsed.expDate ? parsed.expDate.getTime() : null;
      const oldExp = item.expDate ? item.expDate.getTime() : null;
      if (newExp !== oldExp) data.expDate = parsed.expDate;

      if (Object.keys(data).length > 0) {
        await prisma.inventoryItem.update({ where: { id: item.id }, data });
        updated++;
      }
    }

    return success(res, { total: items.length, updated });
  } catch (err) {
    return error(res, 'Re-parse backfill failed', 500);
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item || item.deletedAt) {
      return error(res, 'Item not found', 404);
    }

    await prisma.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return success(res, { message: 'Item deleted' });
  } catch (err) {
    return error(res, 'Delete failed', 500);
  }
}
