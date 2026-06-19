import type { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import { error, str } from '../utils/response.js';
import { getItemNumber, getProductLabel } from '../utils/gtin-map.js';

// A point-in-time inventory backup over an arbitrary window: every item whose
// createdAt falls in [from, to] — INCLUDING ones since used, transferred, or
// removed — so the export is a faithful record of what was received in the
// period and where each unit ended up. Two formats: human-readable Excel and a
// full JSON snapshot suitable for archiving / restore.

/** Parse a YYYY-MM-DD (or ISO) query param into a Date, or null if absent/invalid. */
function parseDate(val: unknown): Date | null {
  const s = str(val);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Resolve the createdAt window from query (from/to). Defaults to all-time. */
function resolveRange(req: Request): { from: Date | null; to: Date | null } {
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);
  // Make `to` inclusive of the whole day if it's a bare date (no time component).
  if (to && str(req.query.to).length <= 10) {
    to.setUTCHours(23, 59, 59, 999);
  }
  return { from, to };
}

function buildWhere(from: Date | null, to: Date | null): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (from || to) {
    const createdAt: Record<string, Date> = {};
    if (from) createdAt.gte = from;
    if (to) createdAt.lte = to;
    where.createdAt = createdAt;
  }
  return where;
}

function statusOf(item: { deletedAt: Date | null; usedAt: Date | null }): string {
  if (item.deletedAt) return 'Removed';
  if (item.usedAt) return 'Used';
  return 'In stock';
}

function rangeLabel(from: Date | null, to: Date | null): string {
  const f = from ? from.toISOString().slice(0, 10) : 'all';
  const t = to ? to.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `${f}_to_${t}`;
}

/** GET /api/backup/excel?from=&to= — readable workbook of the window. */
export async function exportBackupExcel(req: Request, res: Response) {
  try {
    const { from, to } = resolveRange(req);
    const items = await prisma.inventoryItem.findMany({
      where: buildWhere(from, to),
      include: {
        distributor: { select: { name: true } },
        bank: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nail Tracker';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet('Inventory Backup');

    sheet.columns = [
      { header: 'Item Number', key: 'itemNumber', width: 22 },
      { header: 'Product', key: 'product', width: 36 },
      { header: 'GTIN', key: 'gtin', width: 18 },
      { header: 'Lot', key: 'lot', width: 18 },
      { header: 'Expiry', key: 'expDate', width: 12 },
      { header: 'Current Status', key: 'status', width: 14 },
      { header: 'Current Location', key: 'location', width: 26 },
      { header: 'Created', key: 'createdAt', width: 14 },
      { header: 'Assigned', key: 'assignedAt', width: 14 },
      { header: 'Used', key: 'usedAt', width: 14 },
      { header: 'Removed', key: 'deletedAt', width: 14 },
      { header: 'Assigned By', key: 'assignedBy', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const day = (d: Date | null) => (d ? d.toISOString().split('T')[0] : '');
    for (const item of items) {
      let location = item.distributor?.name || 'Home Office';
      if (item.bank?.name) location += ` / ${item.bank.name}`;
      sheet.addRow({
        itemNumber: getItemNumber(item.gtinShort, item.rawBarcode) || '',
        product: item.productLabel || getProductLabel(item.gtinShort, item.rawBarcode) || '',
        gtin: item.gtin,
        lot: item.lot,
        expDate: day(item.expDate),
        status: statusOf(item),
        location,
        createdAt: day(item.createdAt),
        assignedAt: day(item.assignedAt),
        usedAt: day(item.usedAt),
        deletedAt: day(item.deletedAt),
        assignedBy: item.assignedBy || '',
      });
    }

    const filename = `inventory-backup-${rangeLabel(from, to)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    return error(res, 'Backup export failed', 500);
  }
}

/**
 * GET /api/backup/json?from=&to=&includeImages=false
 * Full snapshot for archiving/restore: every InventoryItem field plus its
 * assignment history. imageData (base64) is included by default for fidelity
 * but can be dropped with includeImages=false to keep the file small.
 */
export async function exportBackupJson(req: Request, res: Response) {
  try {
    const { from, to } = resolveRange(req);
    const includeImages = str(req.query.includeImages) !== 'false';

    const items = await prisma.inventoryItem.findMany({
      where: buildWhere(from, to),
      include: {
        distributor: { select: { id: true, name: true } },
        bank: { select: { id: true, name: true } },
        history: { orderBy: { changedAt: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      range: {
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
      },
      count: items.length,
      includeImages,
      items: items.map((item) => ({
        id: item.id,
        udi: item.udi,
        gtin: item.gtin,
        gtinShort: item.gtinShort,
        itemNumber: getItemNumber(item.gtinShort, item.rawBarcode),
        lot: item.lot,
        expDate: item.expDate,
        rawBarcode: item.rawBarcode,
        productLabel: item.productLabel,
        ...(includeImages ? { imageData: item.imageData } : {}),
        distributorId: item.distributorId,
        distributorName: item.distributor?.name ?? null,
        bankId: item.bankId,
        bankName: item.bank?.name ?? null,
        assignedAt: item.assignedAt,
        assignedBy: item.assignedBy,
        usedAt: item.usedAt,
        usageTicketId: item.usageTicketId,
        deletedAt: item.deletedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        history: item.history,
      })),
    };

    const filename = `inventory-backup-${rangeLabel(from, to)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    return error(res, 'Backup export failed', 500);
  }
}
