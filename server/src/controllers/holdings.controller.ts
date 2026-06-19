import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { getItemNumber } from '../utils/gtin-map.js';
import {
  holdingsAsOf,
  groupHoldings,
  HOME,
  type HoldingItem,
  type HoldingHistory,
  type ResolvedHolding,
} from '../utils/holdings.js';

// "Who has what" — who currently holds each item (grouped by distributor), with
// an optional point-in-time mode that reconstructs holdings as of a past date
// from assignment history.

// Usage / removal history rows carry only a `from` side; they are not placements
// and must not be read as a move. They're identifiable by their note text.
const NON_PLACEMENT_NOTE = /Consumed via usage|Marked as used|Removed via cycle count/i;

const ITEM_SELECT = {
  id: true,
  gtinShort: true,
  rawBarcode: true,
  productLabel: true,
  lot: true,
  expDate: true,
  distributorId: true,
  createdAt: true,
  usedAt: true,
  deletedAt: true,
} as const;

function parseAsOf(val: unknown): Date | null {
  const s = str(val);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  // A bare date means "as of the end of that day".
  if (s.length <= 10) d.setUTCHours(23, 59, 59, 999);
  return d;
}

/** Shape each group's items for the API / sheet. */
function slimItem(item: HoldingItem) {
  return {
    id: item.id,
    itemNumber: getItemNumber(item.gtinShort, item.rawBarcode),
    productLabel: item.productLabel,
    lot: item.lot,
    expDate: item.expDate,
  };
}

/**
 * Resolve the report data for both modes. Returns the grouped buckets plus the
 * effective asOf (null = current/live).
 */
async function gatherHoldings(asOf: Date | null) {
  const distributors = await prisma.distributor.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  let resolved: ResolvedHolding[];

  if (!asOf) {
    // Live: everything currently in stock, at its current location.
    const items = await prisma.inventoryItem.findMany({
      where: { deletedAt: null, usedAt: null },
      select: ITEM_SELECT,
    });
    resolved = items.map((item) => ({ distributorId: item.distributorId, item }));
  } else {
    // Point-in-time: anything created on/before asOf, plus its placement history.
    const items = await prisma.inventoryItem.findMany({
      where: { createdAt: { lte: asOf } },
      select: ITEM_SELECT,
    });
    const rawHistory = await prisma.assignmentHistory.findMany({
      where: { itemId: { in: items.map((i) => i.id) } },
      select: {
        itemId: true,
        toDistributorId: true,
        fromDistributorId: true,
        changedAt: true,
        note: true,
      },
    });
    const history: HoldingHistory[] = rawHistory.map((h) => ({
      itemId: h.itemId,
      toDistributorId: h.toDistributorId,
      fromDistributorId: h.fromDistributorId,
      changedAt: h.changedAt,
      isPlacement: !(h.note && NON_PLACEMENT_NOTE.test(h.note)),
    }));
    resolved = holdingsAsOf(items, history, asOf);
  }

  const groups = groupHoldings(resolved, distributors);
  return { groups, distributors };
}

/** GET /api/holdings?asOf=YYYY-MM-DD */
export async function holdingsReport(req: Request, res: Response) {
  try {
    const asOf = parseAsOf(req.query.asOf);
    const { groups } = await gatherHoldings(asOf);
    return success(res, {
      asOf: asOf ? asOf.toISOString() : null,
      total: groups.reduce((s, g) => s + g.count, 0),
      groups: groups.map((g) => ({
        locationId: g.locationId,
        locationName: g.locationName,
        count: g.count,
        items: g.items
          .map(slimItem)
          .sort((a, b) => (a.itemNumber || '').localeCompare(b.itemNumber || '')),
      })),
    });
  } catch (err) {
    return error(res, 'Failed to build holdings report', 500);
  }
}

/** GET /api/holdings/export?asOf=YYYY-MM-DD */
export async function exportHoldings(req: Request, res: Response) {
  try {
    const asOf = parseAsOf(req.query.asOf);
    const { groups } = await gatherHoldings(asOf);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Who Has What');
    sheet.columns = [
      { header: 'Location', key: 'location', width: 24 },
      { header: 'Item Number', key: 'itemNumber', width: 22 },
      { header: 'Product', key: 'product', width: 36 },
      { header: 'Lot', key: 'lot', width: 18 },
      { header: 'Expiry', key: 'expiry', width: 12 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const day = (d: Date | null) => (d ? d.toISOString().split('T')[0] : '');
    let grand = 0;
    for (const g of groups) {
      const items = g.items
        .map(slimItem)
        .sort((a, b) => (a.itemNumber || '').localeCompare(b.itemNumber || ''));
      for (const it of items) {
        sheet.addRow({
          location: g.locationName,
          itemNumber: it.itemNumber || '',
          product: it.productLabel || '',
          lot: it.lot,
          expiry: day(it.expDate),
        });
      }
      sheet.addRow({ location: `${g.locationName} subtotal`, lot: '', expiry: g.count }).font = {
        bold: true,
      };
      grand += g.count;
    }
    sheet.addRow({ location: 'Grand total', expiry: grand }).font = { bold: true };

    const label = asOf ? asOf.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const filename = `who-has-what-${label}.xlsx`;
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

// HOME is re-exported for any consumer that needs the sentinel id.
export { HOME };
