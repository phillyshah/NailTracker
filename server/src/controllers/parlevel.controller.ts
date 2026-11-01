import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { success, error } from '../utils/response.js';
import { getItemNumber, getParGroup, productCatalog } from '../utils/gtin-map.js';
import { buildReorderRows, type ParLevelRow } from '../utils/parLevels.js';
import { windowStart } from '../utils/usageReport.js';
import { usageRates as computeRates } from '../utils/usageRate.js';

const REORDER_WINDOW_MONTHS = 3;

/** GET /api/par-levels — every par row (for the editor to hydrate). */
export async function list(_req: Request, res: Response) {
  try {
    const levels = await prisma.parLevel.findMany({ orderBy: { createdAt: 'asc' } });
    return success(res, levels);
  } catch (err) {
    return error(res, 'Failed to fetch par levels', 500);
  }
}

/**
 * PUT /api/par-levels — set (or clear) a par.
 *
 * Two shapes, distinguished by `scope`:
 *   - scope 'category': { scope, category, minStock } — a group default that
 *     applies to every SKU in the group.
 *   - scope 'item' (default): { itemNumber, gtinShort, distributorId?, minStock }
 *     — a per-SKU par; with a distributorId it's a per-distributor override.
 *
 * Either shape may send `coverMonths` INSTEAD of `minStock` to express the par
 * as months of stock to hold. The quantity is then computed per item and per
 * distributor at report time from that row's own usage rate, so one entry sizes
 * itself to demand (see utils/parLevels.ts).
 *
 * Sending 0 (or omitting both) clears the row so it falls back to the next level.
 */
export async function upsert(req: Request, res: Response) {
  try {
    const { scope, category, itemNumber, gtinShort, distributorId, minStock, coverMonths } =
      req.body as {
        scope?: 'item' | 'category';
        category?: string;
        itemNumber?: string;
        gtinShort?: string;
        distributorId?: string | null;
        minStock?: number;
        coverMonths?: number | null;
      };

    // A row is expressed as EITHER a quantity or months of cover, never both.
    const usingCover = coverMonths != null && coverMonths !== 0;
    const cover = usingCover ? Number(coverMonths) : null;
    if (usingCover && (!Number.isFinite(cover) || cover! < 0 || cover! > 120)) {
      return error(res, 'coverMonths must be between 0 and 120');
    }

    const min = usingCover ? 0 : Number(minStock ?? 0);
    if (!Number.isFinite(min) || min < 0) return error(res, 'minStock must be 0 or greater');

    // Whichever basis was used, a zero value means "clear this row".
    const clearing = usingCover ? false : min === 0;
    // Persisted on every write so switching basis overwrites the other field.
    const parData = { minStock: min, coverMonths: cover };

    // ── Group (category) par — always global ──────────────────────────────
    if (scope === 'category') {
      if (!category || !category.trim()) return error(res, 'category is required');
      const existing = await prisma.parLevel.findFirst({
        where: { scope: 'category', category, distributorId: null },
      });
      if (clearing) {
        if (existing) await prisma.parLevel.delete({ where: { id: existing.id } });
        return success(res, { scope: 'category', category, minStock: 0, cleared: true });
      }
      const saved = existing
        ? await prisma.parLevel.update({ where: { id: existing.id }, data: parData })
        : await prisma.parLevel.create({
            data: { scope: 'category', category, distributorId: null, ...parData },
          });
      return success(res, saved);
    }

    // ── Item (SKU) par — global or per-distributor override ───────────────
    if (!itemNumber || !itemNumber.trim()) return error(res, 'itemNumber is required');
    if (!gtinShort || !gtinShort.trim()) return error(res, 'gtinShort is required');

    const distId = distributorId || null;
    const itemCategory = getParGroup(gtinShort);
    const existing = await prisma.parLevel.findFirst({
      where: { scope: 'item', itemNumber, distributorId: distId },
    });

    if (clearing) {
      if (existing) await prisma.parLevel.delete({ where: { id: existing.id } });
      return success(res, { itemNumber, distributorId: distId, minStock: 0, cleared: true });
    }

    const saved = existing
      ? await prisma.parLevel.update({
          where: { id: existing.id },
          data: { ...parData, gtinShort, category: itemCategory },
        })
      : await prisma.parLevel.create({
          data: {
            scope: 'item',
            itemNumber,
            gtinShort,
            category: itemCategory,
            distributorId: distId,
            ...parData,
          },
        });
    return success(res, saved);
  } catch (err) {
    return error(res, 'Failed to save par level', 500);
  }
}

/** Aggregate current stock + recent usage for the reorder calculation. */
async function gatherReorderData() {
  const since = windowStart(REORDER_WINDOW_MONTHS);
  const [stock, used, distributors, levelRows] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { deletedAt: null, usedAt: null, distributorId: { not: null } },
      select: { gtinShort: true, rawBarcode: true, distributorId: true },
    }),
    prisma.inventoryItem.findMany({
      where: { deletedAt: null, usedAt: { gte: since }, distributorId: { not: null } },
      select: { gtinShort: true, rawBarcode: true, distributorId: true, usedAt: true },
    }),
    prisma.distributor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.parLevel.findMany(),
  ]);

  const current: Record<string, number> = {};
  for (const it of stock) {
    const itemNumber = getItemNumber(it.gtinShort, it.rawBarcode) || it.gtinShort;
    const k = `${itemNumber}|${it.distributorId}`;
    current[k] = (current[k] ?? 0) + 1;
  }

  // Per-month usage rate. Divided by the months each item has ACTUALLY been
  // observed, not by the nominal window — see utils/usageRate.ts. Dividing by
  // the window understated a ramping product, which then under-ordered via
  // cover-months pars.
  const rates = computeRates(
    used.flatMap((it) =>
      it.usedAt
        ? [
            {
              key: `${getItemNumber(it.gtinShort, it.rawBarcode) || it.gtinShort}|${it.distributorId}`,
              usedAt: it.usedAt,
            },
          ]
        : [],
    ),
    REORDER_WINDOW_MONTHS,
  );
  const usage: Record<string, number> = {};
  for (const k of Object.keys(rates)) usage[k] = rates[k].perMonth;

  const levels: ParLevelRow[] = levelRows.map((l) => ({
    scope: l.scope === 'category' ? 'category' : 'item',
    itemNumber: l.itemNumber,
    category: l.category,
    gtinShort: l.gtinShort,
    distributorId: l.distributorId,
    minStock: l.minStock,
    coverMonths: l.coverMonths,
  }));

  const rows = buildReorderRows({
    // Par levels apply to field distributors only — Home Office is the warehouse
    // you replenish FROM, so it must never appear on the reorder report.
    distributors: distributors
      .filter((d) => d.name.trim().toLowerCase() !== 'home office')
      .map((d) => ({ id: d.id, name: d.name })),
    levels,
    current,
    items: productCatalog.map((c) => ({
      itemNumber: c.itemNumber,
      gtinShort: c.gtinShort,
      productLabel: c.productLabel,
      group: c.group,
    })),
    usage,
  });
  return { rows, windowMonths: REORDER_WINDOW_MONTHS };
}

/**
 * GET /api/par-levels/usage — average units consumed per month, so the Par
 * Levels screen can show what "N months of cover" works out to before you save.
 *
 * Returns the same `itemNumber|distributorId` keys the reorder calculation
 * uses, plus a per-item average across distributors for the global and category
 * inputs, where no single distributor is in play.
 */
export async function usageRates(_req: Request, res: Response) {
  try {
    const since = windowStart(REORDER_WINDOW_MONTHS);
    const [used, distributors] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { deletedAt: null, usedAt: { gte: since }, distributorId: { not: null } },
        select: { gtinShort: true, rawBarcode: true, distributorId: true, usedAt: true },
      }),
      prisma.distributor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);

    // Home Office is the warehouse you replenish from and never carries a par,
    // so it must not dilute the per-item average either.
    const fieldIds = new Set(
      distributors
        .filter((d: { name: string }) => d.name.trim().toLowerCase() !== 'home office')
        .map((d: { id: string }) => d.id),
    );

    // Rates divide by months actually observed, not the nominal window — see
    // utils/usageRate.ts for why that distinction matters on a new product line.
    // `usedAt` is non-null by the query's own filter, but narrow it here rather
    // than asserting it so the compiler keeps checking.
    const fieldRows = used.flatMap((it) =>
      it.usedAt && it.distributorId && fieldIds.has(it.distributorId)
        ? [{ ...it, usedAt: it.usedAt }]
        : [],
    );

    const pairRates = computeRates(
      fieldRows.map((it) => ({
        key: `${getItemNumber(it.gtinShort, it.rawBarcode) || it.gtinShort}|${it.distributorId}`,
        usedAt: it.usedAt,
      })),
      REORDER_WINDOW_MONTHS,
    );
    const byPair: Record<string, number> = {};
    for (const k of Object.keys(pairRates)) byPair[k] = pairRates[k].perMonth;

    // Per item across all field distributors, then divided by how many there
    // are — the preview is "what would ONE distributor hold", not the network.
    const itemRates = computeRates(
      fieldRows.map((it) => ({
        key: getItemNumber(it.gtinShort, it.rawBarcode) || it.gtinShort,
        usedAt: it.usedAt,
      })),
      REORDER_WINDOW_MONTHS,
    );
    const divisor = Math.max(1, fieldIds.size);
    const byItem: Record<string, number> = {};
    for (const k of Object.keys(itemRates)) {
      byItem[k] = +(itemRates[k].perMonth / divisor).toFixed(2);
    }

    return success(res, { byPair, byItem, windowMonths: REORDER_WINDOW_MONTHS });
  } catch (err) {
    return error(res, 'Failed to compute usage rates', 500);
  }
}

/** GET /api/par-levels/reorder — items below par, with suggested order qty. */
export async function reorderReport(_req: Request, res: Response) {
  try {
    const { rows, windowMonths } = await gatherReorderData();
    return success(res, { rows, windowMonths });
  } catch (err) {
    return error(res, 'Failed to build reorder report', 500);
  }
}

/** GET /api/par-levels/reorder/export — same data as .xlsx. */
export async function exportReorder(_req: Request, res: Response) {
  try {
    const { rows } = await gatherReorderData();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Reorder');
    sheet.columns = [
      { header: 'Distributor', key: 'distributorName', width: 22 },
      { header: 'Item Number', key: 'itemNumber', width: 24 },
      { header: 'Description', key: 'productLabel', width: 36 },
      { header: 'On Hand', key: 'current', width: 10 },
      { header: 'Par', key: 'par', width: 8 },
      // Says whether the par was typed in or derived from months of cover, so
      // the sheet is self-explanatory away from the app.
      { header: 'Par Basis', key: 'parBasisLabel', width: 16 },
      { header: 'Suggested Order', key: 'shortage', width: 16 },
      { header: 'Usage / mo', key: 'usagePerMonth', width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    for (const r of rows) {
      sheet.addRow({
        ...r,
        parBasisLabel:
          r.parBasis === 'cover' ? `${r.parCoverMonths} months cover` : 'Fixed quantity',
      });
    }
    sheet.getColumn('shortage').font = { bold: true };

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="reorder-${dateStr}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return error(res, 'Export failed', 500);
  }
}
