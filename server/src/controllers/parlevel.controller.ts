import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { success, error } from '../utils/response.js';
import { getItemNumber, getProductLabel } from '../utils/gtin-map.js';
import { buildReorderRows, type ParLevelRow } from '../utils/parLevels.js';
import { windowStart } from '../utils/usageReport.js';

const REORDER_WINDOW_MONTHS = 3;

/** GET /api/par-levels — every par row (for the editor to hydrate). */
export async function list(_req: Request, res: Response) {
  try {
    const levels = await prisma.parLevel.findMany({ orderBy: { itemNumber: 'asc' } });
    return success(res, levels);
  } catch (err) {
    return error(res, 'Failed to fetch par levels', 500);
  }
}

/**
 * PUT /api/par-levels — set (or clear) the par for an item.
 * Body: { itemNumber, gtinShort, distributorId?, minStock }. A non-positive
 * minStock clears the row (no par). distributorId omitted/null = global default.
 */
export async function upsert(req: Request, res: Response) {
  try {
    const { itemNumber, gtinShort, distributorId, minStock } = req.body as {
      itemNumber?: string;
      gtinShort?: string;
      distributorId?: string | null;
      minStock?: number;
    };
    if (!itemNumber || !itemNumber.trim()) return error(res, 'itemNumber is required');
    if (!gtinShort || !gtinShort.trim()) return error(res, 'gtinShort is required');
    const min = Number(minStock);
    if (!Number.isFinite(min) || min < 0) return error(res, 'minStock must be 0 or greater');

    const distId = distributorId || null;
    const existing = await prisma.parLevel.findFirst({
      where: { itemNumber, distributorId: distId },
    });

    // Clearing: a 0/blank par removes any existing row so it falls back to global.
    if (min === 0) {
      if (existing) await prisma.parLevel.delete({ where: { id: existing.id } });
      return success(res, { itemNumber, distributorId: distId, minStock: 0, cleared: true });
    }

    const saved = existing
      ? await prisma.parLevel.update({ where: { id: existing.id }, data: { minStock: min, gtinShort } })
      : await prisma.parLevel.create({
          data: { itemNumber, gtinShort, distributorId: distId, minStock: min },
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
  const labels: Record<string, { gtinShort: string; productLabel: string }> = {};
  for (const it of stock) {
    const itemNumber = getItemNumber(it.gtinShort, it.rawBarcode) || it.gtinShort;
    if (!labels[itemNumber]) {
      labels[itemNumber] = {
        gtinShort: it.gtinShort,
        productLabel: getProductLabel(it.gtinShort, it.rawBarcode),
      };
    }
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
    itemNumber: l.itemNumber,
    gtinShort: l.gtinShort,
    distributorId: l.distributorId,
    minStock: l.minStock,
  }));

  // Items with a par but no current stock still need labels for the report.
  for (const l of levels) {
    if (!labels[l.itemNumber]) {
      labels[l.itemNumber] = {
        gtinShort: l.gtinShort,
        productLabel: getProductLabel(l.gtinShort) || 'Unknown',
      };
    }
  }

  const rows = buildReorderRows({
    distributors: distributors.map((d) => ({ id: d.id, name: d.name })),
    levels,
    current,
    labels,
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
