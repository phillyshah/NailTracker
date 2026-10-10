import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';
import { getItemNumber } from '../utils/gtin-map.js';
import { generateTransferId } from './transfer.controller.js';

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
    return success(res, {
      ...bank,
      items: bank.items.map((it: { gtinShort: string; rawBarcode: string }) => ({
        ...it,
        itemNumber: getItemNumber(it.gtinShort, it.rawBarcode),
      })),
    });
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
    // A rename can't blank out the name — reject an empty/whitespace name
    // rather than persisting an unnamed bank.
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return error(res, 'Bank name is required');
    }
    const bank = await prisma.bank.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
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

/**
 * POST /api/banks/:id/add — add items to a bank.
 * Accepts item ids (the bank picker) and/or UDIs (the Receive page, which only
 * knows the parsed UDI of what it just received — it never had the row ids).
 */
export async function addItems(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const body = req.body as { itemIds?: string[]; udis?: string[] };
    const itemIds = Array.isArray(body.itemIds) ? body.itemIds : [];
    const udis = Array.isArray(body.udis) ? body.udis : [];

    if (itemIds.length === 0 && udis.length === 0) {
      return error(res, 'itemIds or udis is required', 400);
    }

    const bank = await prisma.bank.findUnique({ where: { id } });
    if (!bank) return error(res, 'Bank not found', 404);

    // Only allow items at the same distributor as the bank
    const scope: Record<string, unknown> = { deletedAt: null, usedAt: null };
    if (bank.distributorId) {
      scope.distributorId = bank.distributorId;
    }

    let updated = 0;
    if (itemIds.length > 0) {
      const result = await prisma.inventoryItem.updateMany({
        where: { ...scope, id: { in: itemIds } },
        data: { bankId: id },
      });
      updated += result.count;
    }
    if (udis.length > 0) {
      // UDIs aren't unique per unit (gtinShort+lot), so only claim units not
      // already in a bank — the just-received ones the caller means.
      const result = await prisma.inventoryItem.updateMany({
        where: { ...scope, udi: { in: udis }, bankId: null },
        data: { bankId: id },
      });
      updated += result.count;
    }

    return success(res, { updated });
  } catch (err) {
    return error(res, 'Failed to add items to bank', 500);
  }
}

/** POST /api/banks/:id/remove — remove items from a bank */
export async function removeItems(req: Request, res: Response) {
  try {
    const id = str(req.params.id);
    const { itemIds } = req.body as { itemIds: string[] };

    const result = await prisma.inventoryItem.updateMany({
      where: { id: { in: itemIds }, bankId: id },
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
        items: {
          where: { deletedAt: null, usedAt: null },
          select: {
            id: true,
            udi: true,
            distributorId: true,
            gtin: true,
            gtinShort: true,
            lot: true,
            expDate: true,
            productLabel: true,
            rawBarcode: true,
          },
        },
        distributor: { select: { name: true } },
      },
    });
    if (!bank) return error(res, 'Bank not found', 404);

    // A "move" to the bank's current distributor is a no-op — reject it loudly
    // instead of reporting success, so a mis-tapped destination can't look like
    // a completed move.
    if ((bank.distributorId || null) === (distributorId || null)) {
      return error(
        res,
        `Bank is already at ${bank.distributor?.name || 'Unassigned'} — choose a different destination`,
        400,
      );
    }

    let newDistributor = null;
    if (distributorId) {
      newDistributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
      if (!newDistributor) return error(res, 'Distributor not found', 404);
    }

    const fromName = bank.distributor?.name || 'Unassigned';
    const toName = newDistributor?.name || 'Unassigned';
    const moveNote = note || `Bank move: ${bank.name}`;
    const username = req.user?.username || null;

    // Build ONE transaction covering every item move, its history row, the
    // bank's own distributor change, and the audit Transfer record — so the
    // move either fully happens or fully doesn't (no half-moved banks).
    const ops = [];
    for (const item of bank.items) {
      ops.push(
        prisma.inventoryItem.update({
          where: { id: item.id },
          data: {
            distributorId: distributorId || null,
            assignedAt: new Date(),
            assignedBy: username,
          },
        }),
        prisma.assignmentHistory.create({
          data: {
            itemId: item.id,
            fromDistributorId: item.distributorId,
            fromDistributorName: fromName,
            toDistributorId: distributorId || null,
            toDistributorName: toName,
            changedBy: username,
            note: moveNote,
          },
        }),
      );
    }
    ops.push(
      prisma.bank.update({
        where: { id },
        data: { distributorId: distributorId || null },
      }),
    );

    let transferId: string | null = null;
    if (bank.items.length > 0) {
      // Record the move in Transfer History so it's verifiable like any other
      // transfer (TRF-…).
      transferId = await generateTransferId();
      ops.push(
        prisma.transfer.create({
          data: {
            transferId,
            fromDistributorId: bank.distributorId,
            fromDistributorName: fromName,
            toDistributorId: distributorId || null,
            toDistributorName: toName,
            note: moveNote,
            itemCount: bank.items.length,
            items: bank.items.map((it) => ({
              id: it.id,
              udi: it.udi,
              itemNumber: getItemNumber(it.gtinShort, it.rawBarcode),
              productLabel: it.productLabel,
              lot: it.lot,
              gtin: it.gtin,
              expDate: it.expDate?.toISOString() ?? null,
            })),
            transferredBy: username,
          },
        }),
      );
    }

    await prisma.$transaction(ops);

    return success(res, {
      transferred: bank.items.length,
      toDistributorName: toName,
      transferId,
    });
  } catch (err) {
    return error(res, 'Failed to transfer bank', 500);
  }
}
