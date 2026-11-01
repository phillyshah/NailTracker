import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests the usage (consumption) controller with Prisma mocked, so we can assert
 * exactly what gets matched, written, and recorded without a database.
 */
const {
  distributorFindUniqueMock,
  itemFindManyMock,
  itemUpdateManyMock,
  historyCreateMock,
  ticketFindFirstMock,
  ticketCreateMock,
  txMock,
} = vi.hoisted(() => ({
  distributorFindUniqueMock: vi.fn(),
  itemFindManyMock: vi.fn(),
  itemUpdateManyMock: vi.fn(),
  historyCreateMock: vi.fn(),
  ticketFindFirstMock: vi.fn(),
  ticketCreateMock: vi.fn(),
  txMock: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    distributor: { findUnique: distributorFindUniqueMock },
    inventoryItem: { findMany: itemFindManyMock, updateMany: itemUpdateManyMock },
    assignmentHistory: { create: historyCreateMock },
    usageTicket: { findFirst: ticketFindFirstMock, create: ticketCreateMock },
    $transaction: txMock,
  },
}));

import { preview, commit } from './usage.controller.js';

function makeRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('express').Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function call(fn: typeof preview | typeof commit, body: Record<string, unknown>) {
  const req = {
    params: {},
    query: {},
    body,
    user: { username: 'tester' },
  } as unknown as import('express').Request;
  const res = makeRes();
  return { res, promise: fn(req, res) };
}

const DIST = { id: 'dist1', name: 'Acme Ortho', active: true };

// A GS1 barcode for the interlocking screw on the sample ticket.
const BARCODE = '(01)08800089459032(10)J251021-L009(17)301020';

function unit(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    udi: '9459032-J251021-L009',
    gtin: '08800089459032',
    gtinShort: '9459032',
    lot: 'J251021-L009',
    expDate: new Date('2030-10-20T00:00:00.000Z'),
    rawBarcode: BARCODE,
    productLabel: 'Interlocking Screw 32 x Ø5 mm',
    distributorId: 'dist1',
    usedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  distributorFindUniqueMock.mockResolvedValue({ ...DIST });
  itemUpdateManyMock.mockReturnValue('UPDATE_OP');
  historyCreateMock.mockReturnValue('HISTORY_OP');
  ticketCreateMock.mockReturnValue('TICKET_OP');
  ticketFindFirstMock.mockResolvedValue(null); // no prior ticket today → seq 0001
  txMock.mockResolvedValue([]);
});

describe('preview', () => {
  it('flags a barcode as not_in_stock when the distributor has no match', async () => {
    itemFindManyMock.mockResolvedValue([]);
    const { res, promise } = call(preview, { distributorId: 'dist1', barcodes: [BARCODE] });
    await promise;

    const payload = res.json.mock.calls[0][0].data;
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0].status).toBe('not_in_stock');
    expect(payload.lines[0].matchedItemId).toBeUndefined();
  });

  it('marks available and picks the oldest-expiry unit (FIFO)', async () => {
    itemFindManyMock.mockResolvedValue([
      unit({ id: 'late', expDate: new Date('2032-01-01T00:00:00.000Z') }),
      unit({ id: 'early', expDate: new Date('2030-06-01T00:00:00.000Z') }),
      unit({ id: 'mid', expDate: new Date('2031-01-01T00:00:00.000Z') }),
    ]);
    const { res, promise } = call(preview, { distributorId: 'dist1', barcodes: [BARCODE] });
    await promise;

    const line = res.json.mock.calls[0][0].data.lines[0];
    expect(line.status).toBe('available');
    expect(line.matchedItemId).toBe('early');
    expect(line.availableCount).toBe(3);
  });

  it('dedups within a ticket: a 2nd identical sticker with only one unit is not_in_stock', async () => {
    itemFindManyMock.mockResolvedValue([unit({ id: 'only' })]);
    const { res, promise } = call(preview, {
      distributorId: 'dist1',
      barcodes: [BARCODE, BARCODE],
    });
    await promise;

    const lines = res.json.mock.calls[0][0].data.lines;
    expect(lines[0].status).toBe('available');
    expect(lines[0].matchedItemId).toBe('only');
    expect(lines[1].status).toBe('not_in_stock');
  });

  it('returns an error line for an unparseable barcode', async () => {
    const { res, promise } = call(preview, { distributorId: 'dist1', barcodes: ['garbage'] });
    await promise;
    expect(res.json.mock.calls[0][0].data.lines[0].status).toBe('error');
    expect(itemFindManyMock).not.toHaveBeenCalled();
  });

  it('rejects an inactive distributor', async () => {
    distributorFindUniqueMock.mockResolvedValue({ ...DIST, active: false });
    const { res, promise } = call(preview, { distributorId: 'dist1', barcodes: [BARCODE] });
    await promise;
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('commit', () => {
  it('consumes available items: one transaction, guarded updates, audit + ticket', async () => {
    itemFindManyMock.mockResolvedValue([unit({ id: 'u1' }), unit({ id: 'u2' })]);
    const { res, promise } = call(commit, { distributorId: 'dist1', itemIds: ['u1', 'u2'] });
    await promise;

    expect(txMock).toHaveBeenCalledTimes(1);
    expect(itemUpdateManyMock).toHaveBeenCalledTimes(2);
    // Guard ensures preview→commit races can't double-consume.
    expect(itemUpdateManyMock.mock.calls[0][0].where).toMatchObject({
      id: 'u1',
      usedAt: null,
      deletedAt: null,
      distributorId: 'dist1',
    });
    expect(itemUpdateManyMock.mock.calls[0][0].data.usageTicketId).toBe('USE-' + dateStamp() + '-0001');

    expect(historyCreateMock).toHaveBeenCalledTimes(2);
    expect(historyCreateMock.mock.calls[0][0].data.note).toContain('USE-');

    expect(ticketCreateMock).toHaveBeenCalledTimes(1);
    expect(ticketCreateMock.mock.calls[0][0].data.itemCount).toBe(2);

    const payload = res.json.mock.calls[0][0].data;
    expect(payload.consumed).toBe(2);
    expect(payload.ticketId).toMatch(/^USE-\d{8}-0001$/);
  });

  it('blocks already-used and wrong-distributor items, consuming only the valid one', async () => {
    itemFindManyMock.mockResolvedValue([
      unit({ id: 'ok' }),
      unit({ id: 'used', usedAt: new Date() }),
      unit({ id: 'other', distributorId: 'dist2' }),
    ]);
    const { res, promise } = call(commit, {
      distributorId: 'dist1',
      itemIds: ['ok', 'used', 'other'],
    });
    await promise;

    expect(itemUpdateManyMock).toHaveBeenCalledTimes(1);
    expect(ticketCreateMock.mock.calls[0][0].data.itemCount).toBe(1);
    const payload = res.json.mock.calls[0][0].data;
    expect(payload.consumed).toBe(1);
    expect(payload.blocked).toEqual(
      expect.arrayContaining([
        { id: 'used', reason: 'already_used' },
        { id: 'other', reason: 'wrong_distributor' },
      ]),
    );
  });

  it('returns 409 and does not open a transaction when nothing is consumable', async () => {
    itemFindManyMock.mockResolvedValue([unit({ id: 'used', usedAt: new Date() })]);
    const { res, promise } = call(commit, { distributorId: 'dist1', itemIds: ['used'] });
    await promise;

    expect(res.status).toHaveBeenCalledWith(409);
    expect(txMock).not.toHaveBeenCalled();
  });
});

/** Today's YYYYMMDD in UTC, matching nextUsageId(). */
function dateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
