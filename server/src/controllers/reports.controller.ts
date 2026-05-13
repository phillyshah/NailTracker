import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { getItemNumber } from '../utils/gtin-map.js';

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
      include: { distributor: { select: { name: true } } },
      orderBy: { expDate: 'asc' },
    });

    const enriched = items.map((item) => ({
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
      orderBy: { createdAt: 'desc' },
    });

    const enrichedItems = items.map((it: { gtinShort: string; rawBarcode: string }) => ({
      ...it,
      itemNumber: getItemNumber(it.gtinShort, it.rawBarcode),
    }));

    return success(res, { distributor, items: enrichedItems });
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
 * GET /api/reports/stock-by-item
 * Pivot table: rows = item number, columns = Home Office + each active distributor + Total.
 */
export async function stockByItem(_req: Request, res: Response) {
  try {
    const [items, distributors] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { deletedAt: null, usedAt: null },
        select: { gtinShort: true, rawBarcode: true, productLabel: true, distributorId: true },
      }),
      prisma.distributor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);

    type Row = {
      gtinShort: string;
      itemNumber: string;
      productLabel: string;
      counts: Record<string, number>;
      total: number;
    };

    const HOME = 'home';
    const rowsMap = new Map<string, Row>();
    for (const it of items) {
      let row = rowsMap.get(it.gtinShort);
      if (!row) {
        row = {
          gtinShort: it.gtinShort,
          itemNumber: getItemNumber(it.gtinShort, it.rawBarcode) || '',
          productLabel: it.productLabel || 'Unknown',
          counts: { [HOME]: 0 },
          total: 0,
        };
        for (const d of distributors) row.counts[d.id] = 0;
        rowsMap.set(it.gtinShort, row);
      }
      const key = it.distributorId ?? HOME;
      row.counts[key] = (row.counts[key] ?? 0) + 1;
      row.total += 1;
    }

    const rows = Array.from(rowsMap.values()).sort((a, b) =>
      (a.itemNumber || a.gtinShort).localeCompare(b.itemNumber || b.gtinShort),
    );

    return success(res, {
      locations: [
        { id: HOME, name: 'Home Office' },
        ...distributors.map((d) => ({ id: d.id, name: d.name })),
      ],
      rows,
    });
  } catch (err) {
    return error(res, 'Failed to generate stock report', 500);
  }
}

/**
 * GET /api/reports/stock-by-item/export
 * Same data as stockByItem, but rendered to .xlsx.
 */
export async function exportStockByItem(_req: Request, res: Response) {
  try {
    const [items, distributors] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { deletedAt: null, usedAt: null },
        select: { gtinShort: true, rawBarcode: true, productLabel: true, distributorId: true },
      }),
      prisma.distributor.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    ]);

    type Row = {
      itemNumber: string;
      productLabel: string;
      counts: Record<string, number>;
      total: number;
    };
    const HOME = 'home';
    const rowsMap = new Map<string, Row>();
    for (const it of items) {
      let row = rowsMap.get(it.gtinShort);
      if (!row) {
        row = {
          itemNumber: getItemNumber(it.gtinShort, it.rawBarcode) || it.gtinShort,
          productLabel: it.productLabel || 'Unknown',
          counts: { [HOME]: 0 },
          total: 0,
        };
        for (const d of distributors) row.counts[d.id] = 0;
        rowsMap.set(it.gtinShort, row);
      }
      const key = it.distributorId ?? HOME;
      row.counts[key] = (row.counts[key] ?? 0) + 1;
      row.total += 1;
    }
    const rows = Array.from(rowsMap.values()).sort((a, b) =>
      a.itemNumber.localeCompare(b.itemNumber),
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Stock by Item');

    const columns = [
      { header: 'Item Number', key: 'itemNumber', width: 24 },
      { header: 'Description', key: 'productLabel', width: 36 },
      { header: 'Home Office', key: HOME, width: 14 },
      ...distributors.map((d) => ({ header: d.name, key: d.id, width: 18 })),
      { header: 'Total', key: 'total', width: 10 },
    ];
    sheet.columns = columns;

    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 2 }];

    for (const row of rows) {
      const data: Record<string, string | number> = {
        itemNumber: row.itemNumber,
        productLabel: row.productLabel,
        [HOME]: row.counts[HOME] ?? 0,
        total: row.total,
      };
      for (const d of distributors) data[d.id] = row.counts[d.id] ?? 0;
      sheet.addRow(data);
    }

    // Bold the Total column.
    const totalCol = sheet.getColumn('total');
    totalCol.font = { bold: true };

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `stock-by-item-${dateStr}.xlsx`;
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
