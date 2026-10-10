import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { getItemNumber } from '../utils/gtin-map.js';
import { buildStockRows, HOME, type StockGroup } from '../utils/stockReport.js';

/**
 * Safety ceiling for the two reports that return an unbounded array. Neither is
 * paginated, so without a cap `?days=3650` returns the entire live inventory.
 * Both are ordered most-relevant-first, so a truncated result is still the part
 * that matters. Deliberately NOT applied to holdings: that report derives
 * point-in-time placement from the full set, so truncating it would yield wrong
 * totals rather than partial ones.
 */
const REPORT_ROW_CAP = 5000;
import {
  buildTrends,
  buildMatrix,
  buildMonthlyUsage,
  windowStart,
  lastNMonths,
  monthBounds,
  monthKey,
  type UsedRow,
  buildItemTotals,
  yearBounds,
} from '../utils/usageReport.js';

export async function summary(_req: Request, res: Response) {
  try {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const in180 = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const baseWhere = { deletedAt: null, usedAt: null };

    const [totalUnits, activeDistributors, expiring90, expiring180, expired, unassigned] =
      await Promise.all([
        prisma.inventoryItem.count({ where: baseWhere }),
        prisma.distributor.count({ where: { active: true } }),
        prisma.inventoryItem.count({
          where: { ...baseWhere, expDate: { gt: now, lte: in90 } },
        }),
        prisma.inventoryItem.count({
          where: { ...baseWhere, expDate: { gt: now, lte: in180 } },
        }),
        prisma.inventoryItem.count({
          where: { ...baseWhere, expDate: { lt: now } },
        }),
        prisma.inventoryItem.count({
          where: { ...baseWhere, distributorId: null },
        }),
      ]);

    return success(res, {
      totalUnits,
      activeDistributors,
      expiring90,
      expiring180,
      expired,
      unassigned,
    });
  } catch (err) {
    return error(res, 'Failed to generate summary', 500);
  }
}

export async function expiring(req: Request, res: Response) {
  try {
    const days = parseInt(str(req.query.days)) || 90;
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const items = await prisma.inventoryItem.findMany({
      where: {
        deletedAt: null,
        usedAt: null,
        expDate: { lte: cutoff },
      },
      omit: { imageData: true },
      include: { distributor: { select: { name: true } } },
      orderBy: { expDate: 'asc' },
      take: REPORT_ROW_CAP,
    });

    if (items.length === REPORT_ROW_CAP) {
      console.warn(
        `[reports] expiring hit the ${REPORT_ROW_CAP}-row cap; result truncated to the soonest-expiring.`,
      );
    }

    const enriched = items.map((item) => ({
      id: item.id,
      udi: item.udi,
      itemNumber: getItemNumber(item.gtinShort, item.rawBarcode),
      productLabel: item.productLabel,
      lot: item.lot,
      expDate: item.expDate?.toISOString() ?? null,
      distributorName: item.distributor?.name || 'Unassigned',
      daysUntilExpiry: item.expDate
        ? Math.ceil((item.expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));

    return success(res, enriched);
  } catch (err) {
    return error(res, 'Failed to fetch expiring items', 500);
  }
}

export async function distributorReport(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const distributor = await prisma.distributor.findUnique({
      where: { id },
    });

    if (!distributor) {
      return error(res, 'Distributor not found', 404);
    }

    const items = await prisma.inventoryItem.findMany({
      where: { distributorId: id, deletedAt: null, usedAt: null },
      omit: { imageData: true },
      orderBy: { createdAt: 'desc' },
      take: REPORT_ROW_CAP,
    });

    const enrichedItems = items.map((it: { gtinShort: string; rawBarcode: string }) => ({
      ...it,
      itemNumber: getItemNumber(it.gtinShort, it.rawBarcode),
    }));

    return success(res, {
      distributor,
      items: enrichedItems,
      truncated: enrichedItems.length === REPORT_ROW_CAP,
    });
  } catch (err) {
    return error(res, 'Failed to generate distributor report', 500);
  }
}

export async function exportExcel(req: Request, res: Response) {
  try {
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
    const orderBy = sortMap[sortBy] || { createdAt: 'desc' };

    const items = await prisma.inventoryItem.findMany({
      where,
      omit: { imageData: true },
      include: { distributor: { select: { name: true } } },
      orderBy,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Inventory');

    sheet.columns = [
      { header: 'Item Number', key: 'itemNumber', width: 22 },
      { header: 'Product', key: 'product', width: 36 },
      { header: 'GTIN', key: 'gtin', width: 18 },
      { header: 'Lot', key: 'lot', width: 18 },
      { header: 'Expiry Date', key: 'expDate', width: 14 },
      { header: 'Distributor', key: 'distributor', width: 22 },
      { header: 'Assigned Date', key: 'assignedDate', width: 14 },
    ];

    // Bold header row + frozen pane so it stays visible while scrolling.
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const now = Date.now();
    for (const item of items) {
      const expMs = item.expDate?.getTime();
      const expired = !!expMs && expMs < now;
      const row = sheet.addRow({
        itemNumber: getItemNumber(item.gtinShort, item.rawBarcode) || '',
        product: item.productLabel || '',
        gtin: item.gtin,
        lot: item.lot,
        expDate: item.expDate ? item.expDate.toISOString().split('T')[0] : '',
        distributor: item.distributor?.name || 'Unassigned',
        assignedDate: item.assignedAt ? item.assignedAt.toISOString().split('T')[0] : '',
      });
      if (expired) {
        row.getCell('expDate').font = { color: { argb: 'FFB00020' }, bold: true };
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `inventory-export-${dateStr}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return error(res, 'Export failed', 500);
  }
}


/**
 * Shared data gather for the stock-by-item pivot (JSON + xlsx variants).
 *
 * Aggregates in SQL rather than fetching one row per physical unit: the answer
 * is at most (#SKUs x #locations) rows, so grouping server-side avoids pulling
 * the entire live inventory across the network on every dashboard load.
 */
async function gatherStockByItem(locationId?: string) {
  // `locationId` narrows the report to one location: HOME for unassigned stock
  // at Home Office, or a distributor id. Applied in the WHERE rather than
  // filtered afterwards, so a single-location report also scans fewer rows.
  const locationWhere =
    locationId === HOME
      ? { distributorId: null }
      : locationId
        ? { distributorId: locationId }
        : {};

  const [grouped, allDistributors] = await Promise.all([
    prisma.inventoryItem.groupBy({
      by: ['gtinShort', 'rawBarcode', 'productLabel', 'distributorId'],
      where: { deletedAt: null, usedAt: null, ...locationWhere },
      _count: { _all: true },
    }),
    prisma.distributor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  // When one location is selected only its column is emitted. HOME is a
  // pseudo-location (distributorId IS NULL) and has no Distributor row, so it
  // is represented by an empty column list and handled by buildStockRows.
  const distributors =
    locationId && locationId !== HOME
      ? allDistributors.filter((d: { id: string }) => d.id === locationId)
      : locationId === HOME
        ? []
        : allDistributors;

  const groups: StockGroup[] = [];
  for (const g of grouped) {
    groups.push({
      gtinShort: g.gtinShort,
      rawBarcode: g.rawBarcode,
      productLabel: g.productLabel,
      distributorId: g.distributorId,
      count: g._count._all,
    });
  }

  // Sort explicitly: which group is seen first decides the row's itemNumber and
  // label, and groupBy ordering is not guaranteed.
  groups.sort(
    (a, b) => a.gtinShort.localeCompare(b.gtinShort) || a.rawBarcode.localeCompare(b.rawBarcode),
  );

  return { groups, distributors };
}

/**
 * GET /api/reports/stock-by-item
 * Pivot table: rows = item number, columns = Home Office + each active distributor + Total.
 */
/**
 * Columns for the stock pivot, honouring a single-location filter. Home Office
 * is a pseudo-location (distributorId IS NULL), so it is included only when no
 * filter is set or the filter IS Home Office.
 */
function stockLocations(
  distributors: { id: string; name: string }[],
  locationId?: string,
): { id: string; name: string }[] {
  const home = { id: HOME, name: 'Home Office' };
  if (!locationId) return [home, ...distributors.map((d) => ({ id: d.id, name: d.name }))];
  if (locationId === HOME) return [home];
  return distributors.map((d) => ({ id: d.id, name: d.name }));
}

export async function stockByItem(req: Request, res: Response) {
  try {
    const locationId = str(req.query.locationId) || undefined;
    const { groups, distributors } = await gatherStockByItem(locationId);
    const rows = buildStockRows(groups, distributors.map((d: { id: string }) => d.id), 'empty');

    return success(res, { locations: stockLocations(distributors, locationId), rows });
  } catch (err) {
    return error(res, 'Failed to generate stock report', 500);
  }
}

/**
 * GET /api/reports/stock-by-item/export
 * Same data as stockByItem, but rendered to .xlsx.
 */
export async function exportStockByItem(req: Request, res: Response) {
  try {
    const locationId = str(req.query.locationId) || undefined;
    const { groups, distributors } = await gatherStockByItem(locationId);
    const rows = buildStockRows(groups, distributors.map((d: { id: string }) => d.id), 'gtinShort');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Stock by Item');

    // Same column set the JSON endpoint reports, so the sheet matches the screen.
    const locations = stockLocations(distributors, locationId);
    const columns = [
      { header: 'Item Number', key: 'itemNumber', width: 24 },
      { header: 'Description', key: 'productLabel', width: 36 },
      ...locations.map((l) => ({ header: l.name, key: l.id, width: 18 })),
      // With a single location selected the Total merely repeats that column.
      ...(locations.length > 1 ? [{ header: 'Total', key: 'total', width: 10 }] : []),
    ];
    sheet.columns = columns;

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }];

    for (const row of rows) {
      const data: Record<string, string | number> = {
        itemNumber: row.itemNumber,
        productLabel: row.productLabel,
        total: row.total,
      };
      for (const l of locations) data[l.id] = row.counts[l.id] ?? 0;
      sheet.addRow(data);
    }

    // Bold the Total column — absent when a single location is selected.
    if (locations.length > 1) sheet.getColumn('total').font = { bold: true };

    const dateStr = new Date().toISOString().slice(0, 10);
    // Name the file after the location so several exports don't collide.
    const locPart =
      locations.length === 1 ? `-${locations[0].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : '';
    const filename = `stock-by-item${locPart}-${dateStr}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return error(res, 'Export failed', 500);
  }
}

// ---- Usage analytics ------------------------------------------------------

const USED_SELECT = {
  gtinShort: true,
  rawBarcode: true,
  distributorId: true,
  usedAt: true,
} as const;

/** Window size in months — 3, 6, or 12 (default 3). */
function parseMonths(q: unknown): number {
  const n = parseInt(str(q), 10);
  return n === 6 ? 6 : n === 12 ? 12 : 3;
}

/** 'YYYY-MM' from the query, or the current UTC month if missing/invalid. */
function parseMonth(q: unknown): string {
  const m = str(q);
  return /^\d{4}-\d{2}$/.test(m) ? m : monthKey(new Date());
}

/**
 * GET /api/reports/usage-trends?months=3|6|12&distributorId=
 * Units consumed per product category per month.
 */
export async function usageTrends(req: Request, res: Response) {
  try {
    const months = parseMonths(req.query.months);
    const where: Record<string, unknown> = {
      usedAt: { gte: windowStart(months) },
      deletedAt: null,
    };
    const distributorId = str(req.query.distributorId);
    if (distributorId) where.distributorId = distributorId;

    const rows = await prisma.inventoryItem.findMany({ where, select: USED_SELECT });
    const data = buildTrends(rows as unknown as UsedRow[], lastNMonths(months));
    return success(res, { window: months, ...data });
  } catch (err) {
    return error(res, 'Failed to build usage trends', 500);
  }
}

/**
 * GET /api/reports/usage-matrix?months=3|6|12
 * Category (rows) × distributor (columns) units consumed in the window.
 */
export async function usageMatrix(req: Request, res: Response) {
  try {
    const months = parseMonths(req.query.months);
    const [rows, distributors] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { usedAt: { gte: windowStart(months) }, deletedAt: null },
        select: USED_SELECT,
      }),
      prisma.distributor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);
    const data = buildMatrix(
      rows as unknown as UsedRow[],
      distributors.map((d) => ({ id: d.id, name: d.name })),
    );
    return success(res, { window: months, ...data });
  } catch (err) {
    return error(res, 'Failed to build usage matrix', 500);
  }
}


/**
 * Resolve the reporting period from the query.
 *
 * `?year=2026` pins a calendar year; otherwise the rolling 3/6/12-month window
 * the other usage reports use. A year outside a sane range is ignored rather
 * than erroring, falling back to the months window.
 */
function parsePeriod(q: Request['query']) {
  const rawYear = parseInt(str(q.year), 10);
  const maxYear = new Date().getUTCFullYear() + 1;
  if (Number.isFinite(rawYear) && rawYear >= 2020 && rawYear <= maxYear) {
    const { start, end } = yearBounds(rawYear);
    return { where: { gte: start, lt: end }, meta: { kind: 'year' as const, year: rawYear } };
  }
  const months = parseMonths(q.months);
  return { where: { gte: windowStart(months) }, meta: { kind: 'months' as const, months } };
}

/**
 * Shared gather for usage-by-item (JSON + xlsx variants).
 *
 * No distributor query: this report pools usage across every distributor, so
 * the only grouping is item number within product category. An optional
 * `?category=` narrows the result to one category.
 */
async function gatherUsageByItem(req: Request) {
  const period = parsePeriod(req.query);
  const rows = await prisma.inventoryItem.findMany({
    where: { usedAt: period.where, deletedAt: null },
    select: USED_SELECT,
  });
  const all = buildItemTotals(rows as unknown as UsedRow[]);

  const category = str(req.query.category);
  if (!category) return { period: period.meta, data: all };

  // Filter after aggregating: category is derived in Node from the catalogue,
  // so it cannot be pushed into the SQL WHERE.
  const categories = all.categories.filter((c) => c.category === category);
  return {
    period: period.meta,
    data: { categories, grandTotal: categories.reduce((sum, c) => sum + c.subtotal, 0) },
  };
}

/**
 * GET /api/reports/usage-by-item
 * Units consumed per item number (rows) x distributor (columns), with a
 * company-wide Total per item. Answers both "how many of this SKU did we use"
 * and "who used them".
 */
export async function usageByItem(req: Request, res: Response) {
  try {
    const { period, data } = await gatherUsageByItem(req);
    return success(res, { period, ...data });
  } catch (err) {
    return error(res, 'Failed to build usage by item report', 500);
  }
}

/** GET /api/reports/usage-by-item/export — same data as xlsx. */
export async function exportUsageByItem(req: Request, res: Response) {
  try {
    const { period, data } = await gatherUsageByItem(req);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Usage by Item');
    sheet.columns = [
      { header: 'Category', key: 'category', width: 22 },
      { header: 'Item Number', key: 'itemNumber', width: 24 },
      { header: 'Description', key: 'productLabel', width: 36 },
      { header: 'Qty Used', key: 'qty', width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Flat rows with a bold subtotal after each category, then a grand total —
    // the same shape as the Monthly Usage export.
    for (const c of data.categories) {
      for (const it of c.items) {
        sheet.addRow({
          category: c.category,
          itemNumber: it.itemNumber,
          productLabel: it.productLabel,
          qty: it.qty,
        });
      }
      sheet.addRow({ category: `${c.category} subtotal`, qty: c.subtotal }).font = { bold: true };
    }
    sheet.addRow({ category: 'TOTAL', qty: data.grandTotal }).font = { bold: true };

    const label = period.kind === 'year' ? String(period.year) : `${period.months}mo`;
    return sendXlsx(res, workbook, `usage-by-item-${label}.xlsx`);
  } catch (err) {
    return error(res, 'Export failed', 500);
  }
}

/**
 * GET /api/reports/monthly-usage?month=YYYY-MM&distributorId=
 * Itemized usage for a single month, grouped by distributor.
 */
export async function monthlyUsage(req: Request, res: Response) {
  try {
    const month = parseMonth(req.query.month);
    const { start, end } = monthBounds(month);
    const where: Record<string, unknown> = { usedAt: { gte: start, lt: end }, deletedAt: null };
    const distributorId = str(req.query.distributorId);
    if (distributorId) where.distributorId = distributorId;

    const [rows, distributors] = await Promise.all([
      prisma.inventoryItem.findMany({ where, select: USED_SELECT }),
      prisma.distributor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);
    const data = buildMonthlyUsage(
      rows as unknown as UsedRow[],
      distributors.map((d) => ({ id: d.id, name: d.name })),
    );
    return success(res, { month, ...data });
  } catch (err) {
    return error(res, 'Failed to build monthly usage report', 500);
  }
}

function sendXlsx(res: Response, workbook: ExcelJS.Workbook, filename: string) {
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return workbook.xlsx.write(res).then(() => res.end());
}

/** GET /api/reports/usage-trends/export */
export async function exportUsageTrends(req: Request, res: Response) {
  try {
    const months = parseMonths(req.query.months);
    const monthList = lastNMonths(months);
    const where: Record<string, unknown> = {
      usedAt: { gte: windowStart(months) },
      deletedAt: null,
    };
    const distributorId = str(req.query.distributorId);
    if (distributorId) where.distributorId = distributorId;

    const rows = await prisma.inventoryItem.findMany({ where, select: USED_SELECT });
    const data = buildTrends(rows as unknown as UsedRow[], monthList);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Usage Trends');
    sheet.columns = [
      { header: 'Product Category', key: 'category', width: 22 },
      ...monthList.map((m) => ({ header: m, key: m, width: 12 })),
      { header: 'Total', key: 'total', width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];

    for (const s of data.series) {
      const row: Record<string, string | number> = { category: s.category, total: s.total };
      for (const m of monthList) row[m] = s.byMonth[m] ?? 0;
      sheet.addRow(row);
    }
    const totalsRow: Record<string, string | number> = { category: 'Total', total: data.total };
    for (const m of monthList) totalsRow[m] = data.totalsByMonth[m] ?? 0;
    sheet.addRow(totalsRow).font = { bold: true };
    sheet.getColumn('total').font = { bold: true };

    return sendXlsx(res, workbook, `usage-trends-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err) {
    return error(res, 'Export failed', 500);
  }
}

/** GET /api/reports/usage-matrix/export */
export async function exportUsageMatrix(req: Request, res: Response) {
  try {
    const months = parseMonths(req.query.months);
    const [rows, distributors] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { usedAt: { gte: windowStart(months) }, deletedAt: null },
        select: USED_SELECT,
      }),
      prisma.distributor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);
    const data = buildMatrix(
      rows as unknown as UsedRow[],
      distributors.map((d) => ({ id: d.id, name: d.name })),
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Usage by Distributor');
    sheet.columns = [
      { header: 'Product Category', key: 'category', width: 22 },
      ...data.columns.map((c) => ({ header: c.name, key: c.id, width: 18 })),
      { header: 'Total', key: 'total', width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 1 }];

    for (const r of data.rows) {
      const row: Record<string, string | number> = { category: r.category, total: r.total };
      for (const c of data.columns) row[c.id] = r.counts[c.id] ?? 0;
      sheet.addRow(row);
    }
    const totalsRow: Record<string, string | number> = { category: 'Total', total: data.grandTotal };
    for (const c of data.columns) totalsRow[c.id] = data.totalsByColumn[c.id] ?? 0;
    sheet.addRow(totalsRow).font = { bold: true };
    sheet.getColumn('total').font = { bold: true };

    return sendXlsx(res, workbook, `usage-by-distributor-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err) {
    return error(res, 'Export failed', 500);
  }
}

/** GET /api/reports/monthly-usage/export */
export async function exportMonthlyUsage(req: Request, res: Response) {
  try {
    const month = parseMonth(req.query.month);
    const { start, end } = monthBounds(month);
    const where: Record<string, unknown> = { usedAt: { gte: start, lt: end }, deletedAt: null };
    const distributorId = str(req.query.distributorId);
    if (distributorId) where.distributorId = distributorId;

    const [rows, distributors] = await Promise.all([
      prisma.inventoryItem.findMany({ where, select: USED_SELECT }),
      prisma.distributor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);
    const data = buildMonthlyUsage(
      rows as unknown as UsedRow[],
      distributors.map((d) => ({ id: d.id, name: d.name })),
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(`Usage ${month}`);
    sheet.columns = [
      { header: 'Distributor', key: 'distributor', width: 24 },
      { header: 'Item Number', key: 'itemNumber', width: 22 },
      { header: 'Product', key: 'product', width: 36 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Qty Used', key: 'qty', width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const g of data.groups) {
      for (const it of g.items) {
        sheet.addRow({
          distributor: g.distributorName,
          itemNumber: it.itemNumber || it.gtinShort,
          product: it.productLabel,
          category: it.category,
          qty: it.qty,
        });
      }
      sheet.addRow({ distributor: `${g.distributorName} subtotal`, qty: g.subtotal }).font = {
        bold: true,
      };
    }
    sheet.addRow({ distributor: 'Grand total', qty: data.grandTotal }).font = { bold: true };

    return sendXlsx(res, workbook, `monthly-usage-${month}.xlsx`);
  } catch (err) {
    return error(res, 'Export failed', 500);
  }
}

export async function distributorCounts(_req: Request, res: Response) {
  try {
    const distributors = await prisma.distributor.findMany({
      where: { active: true },
      include: {
        _count: {
          select: { items: { where: { deletedAt: null, usedAt: null } } },
        },
      },
      orderBy: { name: 'asc' },
    });

    const counts = distributors.map((d) => ({
      distributorId: d.id,
      distributorName: d.name,
      count: d._count.items,
    }));

    // Add unassigned count
    const unassigned = await prisma.inventoryItem.count({
      where: { distributorId: null, deletedAt: null, usedAt: null },
    });

    if (unassigned > 0) {
      counts.push({ distributorId: null as any, distributorName: 'Unassigned', count: unassigned });
    }

    return success(res, counts);
  } catch (err) {
    return error(res, 'Failed to fetch distributor counts', 500);
  }
}
