import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { parseGS1, isParseError } from '../utils/parseGS1.js';

export async function parse(req: Request, res: Response) {
  try {
    const { barcodes } = req.body as { barcodes: string[] };
    const results = barcodes.map((b: string) => parseGS1(b));

    // Check for duplicates in DB
    const udis = results
      .filter((r) => !isParseError(r))
      .map((r) => (r as { udi: string }).udi);

    const existing = await prisma.inventoryItem.findMany({
      where: { udi: { in: udis }, deletedAt: null },
      select: { udi: true },
    });
    const existingSet = new Set(existing.map((e) => e.udi));

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

export async function assign(req: Request, res: Response) {
  try {
    const { items, distributorId } = req.body;

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
      if (existing) {
        skipped++;
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

    const expBefore = str(req.query.expBefore);
    if (expBefore) {
      where.expDate = { lte: new Date(expBefore) };
    }

    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({
        where,
        include: { distributor: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.inventoryItem.count({ where }),
    ]);

    return success(res, items, { page, limit, total });
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

    return success(res, item);
  } catch (err) {
    return error(res, 'Failed to fetch item', 500);
  }
}

export async function reassign(req: Request, res: Response) {
  try {
    const { distributorId, note } = req.body;
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

    await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { udi },
        data: {
          distributorId: distributorId || null,
          assignedAt: distributorId ? new Date() : null,
          assignedBy: req.user?.username || null,
        },
      }),
      prisma.assignmentHistory.create({
        data: {
          itemId: item.id,
          fromDistributorId: item.distributorId,
          fromDistributorName: item.distributor?.name || null,
          toDistributorId: distributorId || null,
          toDistributorName: newDistributor?.name || null,
          changedBy: req.user?.username || null,
          note: note || null,
        },
      }),
    ]);

    return success(res, { message: 'Item reassigned' });
  } catch (err) {
    return error(res, 'Reassignment failed', 500);
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
