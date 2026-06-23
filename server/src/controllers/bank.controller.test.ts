import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests the Banks endpoints with Prisma mocked — written after a production
 * report that "Move Bank" said items moved but nothing changed, and the
 * "Add Items" picker appeared broken. Guards:
 *  - transferBank rejects a move to the bank's CURRENT distributor (the no-op
 *    that looked like a successful move),
 *  - the whole move (items + history + bank + TRF record) is ONE transaction,
 *  - addItems matches by row id AND by UDI (Receive sends UDIs).
 */
const {
  bankFindUniqueMock,
  bankUpdateMock,
  distributorFindUniqueMock,
  itemUpdateMock,
  itemUpdateManyMock,
  historyCreateMock,
  transferCreateMock,
  transferFindFirstMock,
  txMock,
} = vi.hoisted(() => ({
  bankFindUniqueMock: vi.fn(),
  bankUpdateMock: vi.fn(),
  distributorFindUniqueMock: vi.fn(),
  itemUpdateMock: vi.fn(),
  itemUpdateManyMock: vi.fn(),
  historyCreateMock: vi.fn(),
  transferCreateMock: vi.fn(),
  transferFindFirstMock: vi.fn(),
  txMock: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    bank: { findUnique: bankFindUniqueMock, update: bankUpdateMock },
    distributor: { findUnique: distributorFindUniqueMock },
    inventoryItem: { update: itemUpdateMock, updateMany: itemUpdateManyMock },
    assignmentHistory: { create: historyCreateMock },
    transfer: { create: transferCreateMock, findFirst: transferFindFirstMock },
    $transaction: txMock,
  },
}));

import { transferBank, addItems, update } from './bank.controller.js';

function makeRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('express').Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function call(handler: typeof transferBank, id: string, body: Record<string, unknown>) {
  const req = {
    params: { id },
    query: {},
    body,
    user: { username: 'tester' },
  } as unknown as import('express').Request;
  const res = makeRes();
  return { res, promise: handler(req, res) };
}

const BERWYN = { id: 'dist-berwyn', name: 'Berwyn' };
const JOSLIN = { id: 'dist-joslin', name: 'Joslin Orthopaedics' };

const bankAtBerwyn = (itemCount: number) => ({
  id: 'bank-1',
  name: 'Berwyn Bank',
  distributorId: BERWYN.id,
  distributor: { name: BERWYN.name },
  items: Array.from({ length: itemCount }, (_, i) => ({
    id: `item-${i}`,
    udi: `9461479-LOT${i}`,
    distributorId: BERWYN.id,
    gtin: '08880008946147',
    gtinShort: '9461479',
    lot: `LOT${i}`,
    expDate: new Date(Date.UTC(2030, 0, 1)),
    productLabel: 'Lag Screw',
    rawBarcode: 'raw',
  })),
});

describe('transferBank', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.mockResolvedValue([]);
    transferFindFirstMock.mockResolvedValue(null); // first TRF of the day
  });

  it('rejects a move to the bank\'s CURRENT distributor (the silent no-op bug)', async () => {
    bankFindUniqueMock.mockResolvedValue(bankAtBerwyn(31));

    const { res, promise } = call(transferBank, 'bank-1', { distributorId: BERWYN.id });
    await promise;

    expect(res.status).toHaveBeenCalledWith(400);
    expect(txMock).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0] as { error: string };
    expect(payload.error).toContain('already at');
  });

  it('moves every item, the bank, and writes a TRF record in ONE transaction', async () => {
    bankFindUniqueMock.mockResolvedValue(bankAtBerwyn(31));
    distributorFindUniqueMock.mockResolvedValue(JOSLIN);

    const { res, promise } = call(transferBank, 'bank-1', { distributorId: JOSLIN.id });
    await promise;

    // Exactly one atomic transaction — no per-item partial commits.
    expect(txMock).toHaveBeenCalledTimes(1);
    // 31 item updates with the NEW distributor id.
    expect(itemUpdateMock).toHaveBeenCalledTimes(31);
    for (const c of itemUpdateMock.mock.calls) {
      expect(c[0].data.distributorId).toBe(JOSLIN.id);
    }
    // 31 history rows Berwyn → Joslin.
    expect(historyCreateMock).toHaveBeenCalledTimes(31);
    expect(historyCreateMock.mock.calls[0][0].data.fromDistributorName).toBe('Berwyn');
    expect(historyCreateMock.mock.calls[0][0].data.toDistributorName).toBe('Joslin Orthopaedics');
    // The bank itself moves.
    expect(bankUpdateMock).toHaveBeenCalledTimes(1);
    expect(bankUpdateMock.mock.calls[0][0].data.distributorId).toBe(JOSLIN.id);
    // Audit TRF record with all 31 items.
    expect(transferCreateMock).toHaveBeenCalledTimes(1);
    const trf = transferCreateMock.mock.calls[0][0].data;
    expect(trf.itemCount).toBe(31);
    expect(trf.fromDistributorName).toBe('Berwyn');
    expect(trf.toDistributorName).toBe('Joslin Orthopaedics');

    const payload = res.json.mock.calls[0][0] as { data: { transferred: number; toDistributorName: string; transferId: string | null } };
    expect(payload.data.transferred).toBe(31);
    expect(payload.data.toDistributorName).toBe('Joslin Orthopaedics');
    expect(payload.data.transferId).toMatch(/^TRF-/);
  });

  it('a failed transaction moves NOTHING (returns 500, no partial state)', async () => {
    bankFindUniqueMock.mockResolvedValue(bankAtBerwyn(3));
    distributorFindUniqueMock.mockResolvedValue(JOSLIN);
    txMock.mockRejectedValue(new Error('connection lost'));

    const { res, promise } = call(transferBank, 'bank-1', { distributorId: JOSLIN.id });
    await promise;

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('404s on a missing destination distributor', async () => {
    bankFindUniqueMock.mockResolvedValue(bankAtBerwyn(2));
    distributorFindUniqueMock.mockResolvedValue(null);
    const { res, promise } = call(transferBank, 'bank-1', { distributorId: 'nope' });
    await promise;
    expect(res.status).toHaveBeenCalledWith(404);
    expect(txMock).not.toHaveBeenCalled();
  });
});

describe('addItems', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds by row id, scoped to the bank\'s distributor', async () => {
    bankFindUniqueMock.mockResolvedValue({ id: 'bank-1', distributorId: BERWYN.id });
    itemUpdateManyMock.mockResolvedValue({ count: 2 });

    const { res, promise } = call(addItems, 'bank-1', { itemIds: ['a', 'b'] });
    await promise;

    expect(itemUpdateManyMock).toHaveBeenCalledTimes(1);
    const where = itemUpdateManyMock.mock.calls[0][0].where;
    expect(where.id).toEqual({ in: ['a', 'b'] });
    expect(where.distributorId).toBe(BERWYN.id);
    const payload = res.json.mock.calls[0][0] as { data: { updated: number } };
    expect(payload.data.updated).toBe(2);
  });

  it('adds by UDI (the Receive page flow), claiming only unbanked units', async () => {
    bankFindUniqueMock.mockResolvedValue({ id: 'bank-1', distributorId: BERWYN.id });
    itemUpdateManyMock.mockResolvedValue({ count: 3 });

    const { res, promise } = call(addItems, 'bank-1', { udis: ['9461479-LOT1'] });
    await promise;

    expect(itemUpdateManyMock).toHaveBeenCalledTimes(1);
    const where = itemUpdateManyMock.mock.calls[0][0].where;
    expect(where.udi).toEqual({ in: ['9461479-LOT1'] });
    expect(where.bankId).toBeNull(); // never steal units already in a bank
    const payload = res.json.mock.calls[0][0] as { data: { updated: number } };
    expect(payload.data.updated).toBe(3);
  });

  it('400s when neither itemIds nor udis are provided', async () => {
    const { res, promise } = call(addItems, 'bank-1', {});
    await promise;
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('update (rename / edit description)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renames a bank and updates its description', async () => {
    bankUpdateMock.mockResolvedValue({ id: 'bank-1', name: 'Trauma Cart A', description: 'Left OR' });

    const { res, promise } = call(update, 'bank-1', { name: '  Trauma Cart A  ', description: '  Left OR  ' });
    await promise;

    expect(bankUpdateMock).toHaveBeenCalledTimes(1);
    const args = bankUpdateMock.mock.calls[0][0];
    expect(args.where.id).toBe('bank-1');
    expect(args.data.name).toBe('Trauma Cart A'); // trimmed
    expect(args.data.description).toBe('Left OR'); // trimmed
  });

  it('clears the description when sent blank', async () => {
    bankUpdateMock.mockResolvedValue({ id: 'bank-1', name: 'Bank', description: null });

    const { promise } = call(update, 'bank-1', { name: 'Bank', description: '   ' });
    await promise;

    expect(bankUpdateMock.mock.calls[0][0].data.description).toBeNull();
  });

  it('rejects an empty/whitespace name without touching the DB', async () => {
    const { res, promise } = call(update, 'bank-1', { name: '   ' });
    await promise;

    expect(res.status).toHaveBeenCalledWith(400);
    expect(bankUpdateMock).not.toHaveBeenCalled();
  });

  it('404s on a missing bank', async () => {
    bankUpdateMock.mockRejectedValue({ code: 'P2025' });
    const { res, promise } = call(update, 'nope', { name: 'X' });
    await promise;
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects a duplicate name (unique constraint)', async () => {
    bankUpdateMock.mockRejectedValue({ code: 'P2002' });
    const { res, promise } = call(update, 'bank-1', { name: 'Existing' });
    await promise;
    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0] as { error: string };
    expect(payload.error).toContain('already exists');
  });
});
