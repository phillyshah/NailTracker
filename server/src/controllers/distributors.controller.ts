import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';

export async function list(_req: Request, res: Response) {
  try {
    const distributors = await prisma.distributor.findMany({
      where: { active: true },
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });
    return success(res, distributors);
  } catch (err) {
    return error(res, 'Failed to fetch distributors', 500);
  }
}

export async function getOne(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const distributor = await prisma.distributor.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    });
    if (!distributor) {
      return error(res, 'Distributor not found', 404);
    }
    return success(res, distributor);
  } catch (err) {
    return error(res, 'Failed to fetch distributor', 500);
  }
}

export async function create(req: Request, res: Response) {
  try {
    const distributor = await prisma.distributor.create({
      data: req.body,
    });
    return success(res, distributor, undefined, 201);
  } catch (err: any) {
    if (err.code === 'P2002') {
      return error(res, 'A distributor with that name already exists');
    }
    return error(res, 'Failed to create distributor', 500);
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const distributor = await prisma.distributor.update({
      where: { id },
      data: req.body,
    });
    return success(res, distributor);
  } catch (err: any) {
    if (err.code === 'P2025') {
      return error(res, 'Distributor not found', 404);
    }
    if (err.code === 'P2002') {
      return error(res, 'A distributor with that name already exists');
    }
    return error(res, 'Failed to update distributor', 500);
  }
}

export async function deactivate(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const itemCount = await prisma.inventoryItem.count({
      where: { distributorId: id, deletedAt: null },
    });

    await prisma.distributor.update({
      where: { id },
      data: { active: false },
    });

    return success(res, {
      message: 'Distributor deactivated',
      assignedItems: itemCount,
      warning: itemCount > 0 ? `This distributor has ${itemCount} assigned items that should be reassigned.` : undefined,
    });
  } catch (err: any) {
    if (err.code === 'P2025') {
      return error(res, 'Distributor not found', 404);
    }
    return error(res, 'Failed to deactivate distributor', 500);
  }
}
