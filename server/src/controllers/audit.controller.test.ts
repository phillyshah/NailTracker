import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Cycle Count commit tests with Prisma mocked. Guards that one-tap fixes are
 * atomic and correct: extras become new stock, missing units are soft-deleted
 * (re-scoped to units still present), and one AuditSession snapshot is written —
 * all inside a single $transaction.
 */
const {
  distributorFindUniqueMock,
  itemFindManyMock,
  itemCreateMock,
  itemUpdateMock,
  historyCreateMock,
  auditCreateMock,
  auditFindFirstMock,
  auditCountMock,
  txMock,
} = vi.hoisted(() => ({
  distributorFindUniqueMock: vi.fn(),
  itemFindManyMock: vi.fn(),
  itemCreateMock: vi.fn(),
  itemUpdateMock: vi.fn(),
  historyCreateMock: vi.fn(),
  auditCreateMock: vi.fn(),
  auditFindFirstMock: vi.fn(),
  auditCountMock: vi.fn(),
  txMock: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    distributor: { findUnique: distributorFindUniqueMock },
    inventoryItem: { findMany: itemFindManyMock, create: itemCreateMock, update: itemUpdateMock },
    assignmentHistory: { create: historyCreateMock },
    auditSession: { create: auditCreateMock, findFirst: auditFindFirstMock, count: auditCountMock },
    $transaction: txMock,
  },
}));

import { commit, generateAuditId } from './audit.controller.js';

function makeRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('express').Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function callCommit(body: Record<string, unknown>) {
  const req = { body, user: { username: 'tester' } } as unknown as import('express').Request;
  const res = makeRes();
  return { res, promise: commit(req, res) };
}

const BERWYN = { id: 'dist-berwyn', name: 'Berwyn' };

describe('audit commit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.mockResolvedValue([]);
    auditFindFirstMock.mockResolvedValue(null); // first audit of the day
    distributorFindUniqueMock.mockResolvedValue(BERWYN);
  });

  it('404s on a missing distributor', async () => {
    distributorFindUniqueMock.mockResolvedValue(null);
    const { res, promise } = callCommit({ distributorId: 'nope' });
    await promise;
    expect(res.status).toHaveBeenCalledWith(404);
    expect(txMock).not.toHaveBeenCalled();
  });

  it('adds extras, removes still-present missing units, and writes one audit record in ONE transaction', async () => {
    // Two missing ids requested; only one is still present at the distributor.
    itemFindManyMock.mockResolvedValue([{ id: 'm1', distributorId: BERWYN.id }]);

    const { res, promise } = callCommit({
      distributorId: BERWYN.id,
      matchedCount: 5,
      extras: [
        { scanKey: 's0', gtinShort: '9461479', lot: 'NEW', itemNumber: 'REF', productLabel: 'Lag', gtin: '0888', expDate: null, udi: '9461479-NEW', rawBarcode: 'raw' },
      ],
      missingItemIds: ['m1', 'm2-already-gone'],
    });
    await promise;

    // Exactly one atomic transaction.
    expect(txMock).toHaveBeenCalledTimes(1);
    // One extra created as new stock at the distributor.
    expect(itemCreateMock).toHaveBeenCalledTimes(1);
    expect(itemCreateMock.mock.calls[0][0].data.distributorId).toBe(BERWYN.id);
    expect(itemCreateMock.mock.calls[0][0].data.lot).toBe('NEW');
    // Only the still-present missing unit is soft-deleted.
    expect(itemUpdateMock).toHaveBeenCalledTimes(1);
    expect(itemUpdateMock.mock.calls[0][0].where.id).toBe('m1');
    expect(itemUpdateMock.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    // The audit record reflects the actual counts (missing re-scoped to 1).
    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const audit = auditCreateMock.mock.calls[0][0].data;
    expect(audit.matchedCount).toBe(5);
    expect(audit.extraCount).toBe(1);
    expect(audit.missingCount).toBe(1);
    expect(audit.auditId).toMatch(/^AUD-/);

    const payload = res.json.mock.calls[0][0] as { data: { auditId: string; added: number; removed: number } };
    expect(payload.data.added).toBe(1);
    expect(payload.data.removed).toBe(1);
  });

  it('a failed transaction changes nothing (500)', async () => {
    itemFindManyMock.mockResolvedValue([]);
    txMock.mockRejectedValue(new Error('db down'));
    const { res, promise } = callCommit({ distributorId: BERWYN.id, extras: [], missingItemIds: [] });
    await promise;
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('works with no resolutions (audit-only record)', async () => {
    const { res, promise } = callCommit({ distributorId: BERWYN.id, matchedCount: 3 });
    await promise;
    expect(itemFindManyMock).not.toHaveBeenCalled(); // no missing ids → no lookup
    expect(itemCreateMock).not.toHaveBeenCalled();
    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    expect(auditCreateMock.mock.calls[0][0].data.matchedCount).toBe(3);
  });
});

describe('generateAuditId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts at 0001 for the first audit of the day', async () => {
    auditFindFirstMock.mockResolvedValue(null);
    const id = await generateAuditId();
    expect(id).toMatch(/^AUD-\d{8}-0001$/);
  });

  it('increments from the last audit of the day', async () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    auditFindFirstMock.mockResolvedValue({ auditId: `AUD-${dateStr}-0007` });
    const id = await generateAuditId();
    expect(id).toBe(`AUD-${dateStr}-0008`);
  });
});
