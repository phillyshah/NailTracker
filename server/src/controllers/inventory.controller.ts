import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { parseGS1, isParseError } from '../utils/parseGS1.js';

/**
 * POST /api/inventory/scan
 * Scan a single barcode — parse it and check if it already exists in the DB.
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

    // Check if this UDI already exists
    const existing = await prisma.inventoryItem.findUnique({
      where: { udi: parsed.udi },
      include: { distributor: { select: { id: true, name: true } } },
    });

    // Exclude soft-deleted or used items from "existing" match
    const activeExisting = existing && !existing.deletedAt && !existing.usedAt ? existing : null;

    return success(res, {
      parsed: {
        ...parsed,
        expDate: parsed.expDate?.toISOString() ?? null,
        status: activeExisting ? ('duplicate' as const) : ('new' as const),
      },
      existing: activeExisting,
    });
  } catch (err) {
    return error(res, 'Scan failed', 500);
  }
}

/**
 * POST /api/inventory/parse
 * Parse multiple barcodes and check for duplicates.
 */
export async function parse(req: Request, res: Response) {
  try {
    const { barcodes } = req.body as { barcodes: string[] };
    const results = barcodes.map((b: string) => parseGS1(b));

    // Check for duplicates in DB
    const udis = results
      .filter((r) => !isParseError(r))
      .map((r) => (r as { udi: string }).udi);

    const existing = await prisma.inventoryItem.findMany({
      where: { udi: { in: udis }, deletedAt: null, usedAt: null },
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

    const where: Record<string, unknown> = { deletedAt: null, usedAt: null };

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
        // Don't return imageData in list view (too large)
        omit: { imageData: true },
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

/**
 * PATCH /api/inventory/:udi/use
 * Mark an item as used (implanted).
 */
export async function markUsed(req: Request, res: Response) {
  try {
    const udi = str(req.params.udi);

    const item = await prisma.inventoryItem.findUnique({
      where: { udi },
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
        where: { udi },
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
