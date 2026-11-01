import { describe, it, expect, beforeEach, vi } from 'vitest';

/** Wiring test for the usage report controllers (Prisma mocked). */
const { itemFindManyMock, distributorFindManyMock } = vi.hoisted(() => ({
  itemFindManyMock: vi.fn(),
  distributorFindManyMock: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    inventoryItem: { findMany: itemFindManyMock },
    distributor: { findMany: distributorFindManyMock },
  },
}));

import { usageTrends, usageMatrix, monthlyUsage } from './reports.controller.js';

function makeRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('express').Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function call(fn: (req: any, res: any) => Promise<unknown>, query: any) {
  const req = { params: {}, query, body: {}, user: { username: 't' } };
  const res = makeRes();
  return { res, promise: fn(req, res) };
}

const used = (ref: string, distributorId: string | null, usedAt: string) => ({
  gtinShort: '0000001',
  rawBarcode: `(10)LOT ${ref}`,
  distributorId,
  usedAt: new Date(usedAt),
});

beforeEach(() => {
  vi.clearAllMocks();
  distributorFindManyMock.mockResolvedValue([
    { id: 'd1', name: 'Acme' },
    { id: 'd2', name: 'Beta' },
  ]);
});

describe('usageTrends', () => {
  it('queries usedAt >= window start and returns category series', async () => {
    itemFindManyMock.mockResolvedValue([
      used('SO-SPFN-0180-10-25', 'd1', new Date().toISOString()),
    ]);
    const { res, promise } = call(usageTrends, { months: '6' });
    await promise;

    const where = itemFindManyMock.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.usedAt.gte).toBeInstanceOf(Date);

    const data = res.json.mock.calls[0][0].data;
    expect(data.window).toBe(6);
    expect(data.months).toHaveLength(6);
    expect(data.categories).toContain('Short Nail');
  });

  it('adds a distributor filter when provided', async () => {
    itemFindManyMock.mockResolvedValue([]);
    const { promise } = call(usageTrends, { months: '3', distributorId: 'd1' });
    await promise;
    expect(itemFindManyMock.mock.calls[0][0].where.distributorId).toBe('d1');
  });
});

describe('usageMatrix', () => {
  it('returns category × distributor columns', async () => {
    itemFindManyMock.mockResolvedValue([
      used('SO-SPFN-0180-10-25', 'd1', new Date().toISOString()),
      used('SO-SPFL-N70', 'd2', new Date().toISOString()),
    ]);
    const { res, promise } = call(usageMatrix, { months: '12' });
    await promise;
    const data = res.json.mock.calls[0][0].data;
    expect(data.columns.map((c: any) => c.id)).toEqual(['d1', 'd2']);
    expect(data.grandTotal).toBe(2);
  });
});

describe('monthlyUsage', () => {
  it('defaults to the current month and bounds the query to [start,end)', async () => {
    itemFindManyMock.mockResolvedValue([
      used('SO-SPFN-0180-10-25', 'd1', new Date().toISOString()),
    ]);
    const { res, promise } = call(monthlyUsage, {});
    await promise;
    const where = itemFindManyMock.mock.calls[0][0].where;
    expect(where.usedAt.gte).toBeInstanceOf(Date);
    expect(where.usedAt.lt).toBeInstanceOf(Date);
    const data = res.json.mock.calls[0][0].data;
    expect(data.month).toMatch(/^\d{4}-\d{2}$/);
    expect(data.grandTotal).toBe(1);
  });
});
