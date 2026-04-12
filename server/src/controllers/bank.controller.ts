import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';

/** GET /api/banks — list all banks with item counts */
export async function list(_req: Request, res: Response) {
  try {
    const banks = await prisma.bank.findMany({
      include: {
        distributor: { select: { id: true, name: true } },
        _count: { select: { items: { where: { deletedAt: null, usedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    });
    return success(res, banks);
  } catch (err) {
    return error(res, 'Failed to fetch banks', 500);
  }
}

/** GET /api/banks/:id — get bank with all its items */
export async function getOne(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const bank = await prisma.bank.findUnique({
      where: { id },
      include: {
        distributor: { select: { id: true, name: true } },
        items: {
          where: { deletedAt: null, usedAt: null },
          omit: { imageData: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!bank) return error(res, 'Bank not found', 404);
    return success(res, bank);
  } catch (err) {
    return error(res, 'Failed to fetch bank', 500);
  }
}

/** POST /api/banks — create a new bank */
export async function create(req: Request, res: Response) {
  try {
    const { name, description, distributorId } = req.body;
    if (!name || !name.trim()) return error(res, 'Bank name is required');

    const bank = await prisma.bank.create({
      data: {
        name: name.trim(),
        description: description || null,
        distributorId: distributorId || null,
        createdBy: req.user?.username || null,
      },
    });
    return success(res, bank, undefined, 201);
  } catch (err: any) {
    if (err.code === 'P2002') return error(res, 'A bank with that name already exists');
    return error(res, 'Failed to create bank', 500);
  }
}

/** PATCH /api/banks/:id — update bank name/description */
export async function update(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const { name, description, distributorId } = req.body;
    const bank = await prisma.bank.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(distributorId !== undefined && { distributorId: distributorId || null }),
      },
    });
    return success(res, bank);
  } catch (err: any) {
    if (err.code === 'P2025') return error(res, 'Bank not found', 404);
    if (err.code === 'P2002') return error(res, 'A bank with that name already exists');
    return error(res, 'Failed to update bank', 500);
  }
}

/** DELETE /api/banks/:id — delete bank (unlinks items, doesn't delete them) */
export async function remove(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    // Unlink all items from this bank first
    await prisma.inventoryItem.updateMany({
      where: { bankId: id },
      data: { bankId: null },
    });
    await prisma.bank.delete({ where: { id } });
    return success(res, { message: 'Bank deleted' });
  } catch (err: any) {
    if (err.code === 'P2025') return error(res, 'Bank not found', 404);
    return error(res, 'Failed to delete bank', 500);
  }
}

/** POST /api/banks/:id/add — add items to a bank by UDI */
export async function addItems(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const { udis } = req.body as { udis: string[] };

    const bank = await prisma.bank.findUnique({ where: { id } });
    if (!bank) return error(res, 'Bank not found', 404);

    // Only allow items at the same distributor as the bank
    const where: Record<string, unknown> = {
      udi: { in: udis },
      deletedAt: null,
      usedAt: null,
    };
    if (bank.distributorId) {
      where.distributorId = bank.distributorId;
    }

    const result = await prisma.inventoryItem.updateMany({
      where,
      data: { bankId: id },
    });

    return success(res, { updated: result.count });
  } catch (err) {
    return error(res, 'Failed to add items to bank', 500);
  }
}

/** POST /api/banks/:id/remove — remove items from a bank */
export async function removeItems(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const { udis } = req.body as { udis: string[] };

    const result = await prisma.inventoryItem.updateMany({
      where: { udi: { in: udis }, bankId: id },
      data: { bankId: null },
    });

    return success(res, { updated: result.count });
  } catch (err) {
    return error(res, 'Failed to remove items from bank', 500);
  }
}

/** POST /api/banks/:id/transfer — move entire bank to a different distributor */
export async function transferBank(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const { distributorId, note } = req.body;

    const bank = await prisma.bank.findUnique({
      where: { id },
      include: {
        items: { where: { deletedAt: null, usedAt: null }, select: { id: true, udi: true, distributorId: true } },
        distributor: { select: { name: true } },
      },
    });
    if (!bank) return error(res, 'Bank not found', 404);

    let newDistributor = null;
    if (distributorId) {
      newDistributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
      if (!newDistributor) return error(res, 'Distributor not found', 404);
    }

    // Reassign all items in the bank
    for (const item of bank.items) {
      await prisma.$transaction([
        prisma.inventoryItem.update({
          where: { id: item.id },
          data: {
            distributorId: distributorId || null,
            assignedAt: new Date(),
            assignedBy: req.user?.username || null,
          },
        }),
        prisma.assignmentHistory.create({
          data: {
            itemId: item.id,
            fromDistributorId: item.distributorId,
            fromDistributorName: bank.distributor?.name || 'Unassigned',
            toDistributorId: distributorId || null,
            toDistributorName: newDistributor?.name || 'Unassigned',
            changedBy: req.user?.username || null,
            note: note || `Bank transfer: ${bank.name}`,
          },
        }),
      ]);
    }

    // Update bank's distributor
    await prisma.bank.update({
      where: { id },
      data: { distributorId: distributorId || null },
    });

    return success(res, { transferred: bank.items.length });
  } catch (err) {
    return error(res, 'Failed to transfer bank', 500);
  }
}
