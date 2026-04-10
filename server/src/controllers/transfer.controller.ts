import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { success, error, str } from '../utils/response.js';

/**
 * Generate a transfer ID: TRF-YYYYMMDD-XXXX (sequential per day).
 */
async function generateTransferId(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRF-${dateStr}`;

  const lastToday = await prisma.transfer.findFirst({
    where: { transferId: { startsWith: prefix } },
    orderBy: { transferId: 'desc' },
  });

  let seq = 1;
  if (lastToday) {
    const lastSeq = parseInt(lastToday.transferId.split('-').pop() || '0', 10);
    seq = lastSeq + 1;
  }

  return `${prefix}-${seq.toString().padStart(4, '0')}`;
}

/**
 * POST /api/transfers
 * Create a transfer record after items have been reassigned.
 */
export async function create(req: Request, res: Response) {
  try {
    const { fromDistributorId, fromDistributorName, toDistributorId, toDistributorName, note, items } = req.body;

    const transferId = await generateTransferId();

    const transfer = await prisma.transfer.create({
      data: {
        transferId,
        fromDistributorId: fromDistributorId || null,
        fromDistributorName,
        toDistributorId: toDistributorId || null,
        toDistributorName,
        note: note || null,
        itemCount: items.length,
        items,
        transferredBy: req.user?.username || null,
      },
    });

    return success(res, transfer, undefined, 201);
  } catch (err) {
    return error(res, 'Failed to create transfer record', 500);
  }
}

/**
 * GET /api/transfers
 * List all transfers, newest first.
 */
export async function list(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(str(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(str(req.query.limit)) || 25));
    const skip = (page - 1) * limit;
    const search = str(req.query.search);

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { transferId: { contains: search, mode: 'insensitive' } },
        { fromDistributorName: { contains: search, mode: 'insensitive' } },
        { toDistributorName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transfers, total] = await Promise.all([
      prisma.transfer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transfer.count({ where }),
    ]);

    return success(res, transfers, { page, limit, total });
  } catch (err) {
    return error(res, 'Failed to fetch transfers', 500);
  }
}

/**
 * GET /api/transfers/:transferId
 * Get a single transfer by its transferId.
 */
export async function getOne(req: Request, res: Response) {
  try {
    const transferId = str(req.params.transferId);
    const transfer = await prisma.transfer.findUnique({
      where: { transferId },
    });

    if (!transfer) {
      return error(res, 'Transfer not found', 404);
    }

    return success(res, transfer);
  } catch (err) {
    return error(res, 'Failed to fetch transfer', 500);
  }
}
