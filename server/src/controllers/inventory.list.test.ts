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

describe('inventory list — searching by item number (REF code)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  it('resolves a REF search to the matching gtinShort and searches rawBarcode', async () => {
    // SO-SPFN-0380-10L-30 maps to gtinShort 9459940 in the catalog. Scanned
    // items store only the gtinShort, so the search must translate the REF.
    const { promise } = callList({ search: 'SO-SPFN-0380-10L-30' });
    await promise;

    const or = findManyMock.mock.calls[0][0].where.OR as Record<string, unknown>[];
    // rawBarcode is now searched (covers manual REF entries + raw GS1).
    expect(or).toContainEqual({ rawBarcode: { contains: 'SO-SPFN-0380-10L-30', mode: 'insensitive' } });
    // ...and the REF resolves to its gtinShort for scanned items.
    expect(or).toContainEqual({ gtinShort: { in: ['9459940'] } });
  });

  it('omits the gtinShort "in" clause for a free-text search with no REF match', async () => {
    const { promise } = callList({ search: 'zzz-not-a-ref' });
    await promise;

    const or = findManyMock.mock.calls[0][0].where.OR as Record<string, unknown>[];
    expect(or.some((c) => 'gtinShort' in c && (c.gtinShort as { in?: unknown }).in)).toBe(false);
    // Plain field searches are still present.
    expect(or).toContainEqual({ lot: { contains: 'zzz-not-a-ref', mode: 'insensitive' } });
  });
});
