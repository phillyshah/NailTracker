import type { Request, Response } from 'express';
import { stringify } from 'csv-stringify/sync';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';

export async function summary(_req: Request, res: Response) {
  try {
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const in180 = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const baseWhere = { deletedAt: null };

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
        expDate: { lte: cutoff },
      },
      include: { distributor: { select: { name: true } } },
      orderBy: { expDate: 'asc' },
    });

    const enriched = items.map((item) => ({
      udi: item.udi,
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
      where: { distributorId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, { distributor, items });
  } catch (err) {
    return error(res, 'Failed to generate distributor report', 500);
  }
}

export async function exportCsv(req: Request, res: Response) {
  try {
    const where: Record<string, unknown> = { deletedAt: null };

    const distributorId = str(req.query.distributorId);
    if (distributorId) {
      where.distributorId = distributorId;
    }

    const search = str(req.query.search);
    if (search) {
      where.OR = [
        { udi: { contains: search, mode: 'insensitive' } },
        { lot: { contains: search, mode: 'insensitive' } },
        { productLabel: { contains: search, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      include: { distributor: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const rows = items.map((item) => ({
      UDI: item.udi,
      Product: item.productLabel || '',
      GTIN: item.gtin,
      Lot: item.lot,
      'Expiry Date': item.expDate ? item.expDate.toISOString().split('T')[0] : '',
      Distributor: item.distributor?.name || 'Unassigned',
      'Assigned Date': item.assignedAt ? item.assignedAt.toISOString().split('T')[0] : '',
    }));

    const csv = stringify(rows, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory-export.csv');
    return res.send(csv);
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
          select: { items: { where: { deletedAt: null } } },
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
      where: { distributorId: null, deletedAt: null },
    });

    if (unassigned > 0) {
      counts.push({ distributorId: null as any, distributorName: 'Unassigned', count: unassigned });
    }

    return success(res, counts);
  } catch (err) {
    return error(res, 'Failed to fetch distributor counts', 500);
  }
}
