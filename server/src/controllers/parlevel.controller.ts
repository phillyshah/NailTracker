import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { success, error } from '../utils/response.js';
import { getItemNumber, getParGroup, productCatalog } from '../utils/gtin-map.js';
import { buildReorderRows, type ParLevelRow } from '../utils/parLevels.js';
import { windowStart } from '../utils/usageReport.js';

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
 * A non-positive minStock clears the row so it falls back to the next level.
 */
export async function upsert(req: Request, res: Response) {
  try {
    const { scope, category, itemNumber, gtinShort, distributorId, minStock } = req.body as {
      scope?: 'item' | 'category';
      category?: string;
      itemNumber?: string;
      gtinShort?: string;
      distributorId?: string | null;
      minStock?: number;
    };
    const min = Number(minStock);
    if (!Number.isFinite(min) || min < 0) return error(res, 'minStock must be 0 or greater');

    // ── Group (category) par — always global ──────────────────────────────
    if (scope === 'category') {
      if (!category || !category.trim()) return error(res, 'category is required');
      const existing = await prisma.parLevel.findFirst({
        where: { scope: 'category', category, distributorId: null },
      });
      if (min === 0) {
        if (existing) await prisma.parLevel.delete({ where: { id: existing.id } });
        return success(res, { scope: 'category', category, minStock: 0, cleared: true });
      }
      const saved = existing
        ? await prisma.parLevel.update({ where: { id: existing.id }, data: { minStock: min } })
        : await prisma.parLevel.create({
            data: { scope: 'category', category, distributorId: null, minStock: min },
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

    if (min === 0) {
      if (existing) await prisma.parLevel.delete({ where: { id: existing.id } });
      return success(res, { itemNumber, distributorId: distId, minStock: 0, cleared: true });
    }

    const saved = existing
      ? await prisma.parLevel.update({
          where: { id: existing.id },
          data: { minStock: min, gtinShort, category: itemCategory },
        })
      : await prisma.parLevel.create({
          data: {
            scope: 'item',
            itemNumber,
            gtinShort,
            category: itemCategory,
            distributorId: distId,
            minStock: min,
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
      select: { gtinShort: true, rawBarcode: true, distributorId: true },
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

  // Per-month usage average over the window (context column).
  const usage: Record<string, number> = {};
  for (const it of used) {
    const itemNumber = getItemNumber(it.gtinShort, it.rawBarcode) || it.gtinShort;
    const k = `${itemNumber}|${it.distributorId}`;
    usage[k] = (usage[k] ?? 0) + 1;
  }
  for (const k of Object.keys(usage)) usage[k] = +(usage[k] / REORDER_WINDOW_MONTHS).toFixed(1);

  const levels: ParLevelRow[] = levelRows.map((l) => ({
    scope: l.scope === 'category' ? 'category' : 'item',
    itemNumber: l.itemNumber,
    category: l.category,
    gtinShort: l.gtinShort,
    distributorId: l.distributorId,
    minStock: l.minStock,
  }));

  const rows = buildReorderRows({
    distributors: distributors.map((d) => ({ id: d.id, name: d.name })),
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
      { header: 'Suggested Order', key: 'shortage', width: 16 },
      { header: 'Usage / mo', key: 'usagePerMonth', width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    for (const r of rows) sheet.addRow(r);
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
