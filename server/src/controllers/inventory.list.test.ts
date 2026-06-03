import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Regression guard for the distributor-detail "item count" bug: the displayed
 * count must come from the DB `count` (meta.total), NOT from the length of the
 * returned page. A distributor with 105 items but a 100-row page must still
 * report total = 105, so the detail header and the distributor-list badge agree.
 */
const { findManyMock, countMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    inventoryItem: { findMany: findManyMock, count: countMock },
  },
}));

import { list } from './inventory.controller.js';

function makeRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('express').Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function callList(query: Record<string, string>) {
  const req = { query } as unknown as import('express').Request;
  const res = makeRes();
  return { res, promise: list(req, res) };
}

describe('inventory list — count is the DB total, not the page length', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns meta.total from count() even when the page is capped at 100', async () => {
    // A distributor with 105 matching items, but a single page returns only 100.
    const page = Array.from({ length: 100 }, (_, i) => ({
      id: `i${i}`,
      gtinShort: '8945914',
      rawBarcode: 'SO-SPFN-0180-10-25',
    }));
    findManyMock.mockResolvedValue(page);
    countMock.mockResolvedValue(105);

    const { res, promise } = callList({ distributorId: 'd1', limit: '100', page: '1' });
    await promise;

    const payload = res.json.mock.calls[0][0] as {
      success: boolean;
      data: unknown[];
      meta: { page: number; limit: number; total: number };
    };

    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(100); // page is capped
    expect(payload.meta.total).toBe(105); // ...but the true total is reported
    expect(payload.meta.page).toBe(1);
    expect(payload.meta.limit).toBe(100);
  });

  it('counts and lists with the SAME where filter (badge and detail agree)', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    const { promise } = callList({ distributorId: 'd1', limit: '100', page: '1' });
    await promise;

    const expectedWhere = { deletedAt: null, usedAt: null, distributorId: 'd1' };
    expect(findManyMock.mock.calls[0][0].where).toEqual(expectedWhere);
    expect(countMock.mock.calls[0][0].where).toEqual(expectedWhere);
  });
});
