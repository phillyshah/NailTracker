import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests the batch-transfer preview controller and the source-distributor guard
 * on reassign, with Prisma mocked so we can assert matching, within-batch
 * dedup, and race-safety without a database.
 */
const {
  distributorFindUniqueMock,
  itemFindManyMock,
  itemFindUniqueMock,
  itemUpdateMock,
  historyCreateMock,
  txMock,
} = vi.hoisted(() => ({
  distributorFindUniqueMock: vi.fn(),
  itemFindManyMock: vi.fn(),
  itemFindUniqueMock: vi.fn(),
  itemUpdateMock: vi.fn(),
  historyCreateMock: vi.fn(),
  txMock: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    distributor: { findUnique: distributorFindUniqueMock },
    inventoryItem: {
      findMany: itemFindManyMock,
      findUnique: itemFindUniqueMock,
      update: itemUpdateMock,
    },
    assignmentHistory: { create: historyCreateMock },
    $transaction: txMock,
  },
}));

import { previewBatch } from './transfer.controller.js';
import { reassign } from './inventory.controller.js';

function makeRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('express').Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function callPreview(body: Record<string, unknown>) {
  const req = { params: {}, query: {}, body, user: { username: 'tester' } } as unknown as import('express').Request;
  const res = makeRes();
  return { res, promise: previewBatch(req, res) };
}

function callReassign(id: string, body: Record<string, unknown>) {
  const req = {
    params: { id },
    query: {},
    body,
    user: { username: 'tester' },
  } as unknown as import('express').Request;
  const res = makeRes();
  return { res, promise: reassign(req, res) };
}

const SOURCE = { id: 'src1', name: 'Acme Ortho', active: true };
const OTHER = { id: 'other1', name: 'Beta Surgical', active: true };
// Real GS1-128 string from the v3.23 fix — the parser knows it lives at
// gtinShort=9461479, lot=J260225-L170, expiry 2031-02-24.
const BARCODE = '010880008946147910J260225-L17017310224';
const BAD_BARCODE = 'not-a-real-barcode';

describe('previewBatch — match against source distributor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns "available" with a matched item id when the source has stock', async () => {
    distributorFindUniqueMock.mockResolvedValue(SOURCE);
    // One matching unit at the source.
    itemFindManyMock.mockResolvedValue([
      {
        id: 'item-A',
        gtinShort: '9461479',
        lot: 'J260225-L170',
        rawBarcode: BARCODE,
        productLabel: 'Lag Screw Normal 120mm',
        expDate: new Date(Date.UTC(2031, 1, 24)),
        createdAt: new Date(2026, 0, 1),
      },
    ]);

    const { res, promise } = callPreview({ fromDistributorId: SOURCE.id, barcodes: [BARCODE] });
    await promise;

    const payload = res.json.mock.calls[0][0] as {
      data: { lines: Array<{ status: string; matchedItemId?: string; parsed?: { lot: string } }> };
    };
    expect(payload.data.lines).toHaveLength(1);
    expect(payload.data.lines[0].status).toBe('available');
    expect(payload.data.lines[0].matchedItemId).toBe('item-A');
    // The parsed payload is included so the client can offer "Add to source"
    // for not_in_stock lines without re-parsing the barcode.
    expect(payload.data.lines[0].parsed?.lot).toBe('J260225-L170');
  });

  it('flags "not_in_stock" when the source has no matching unit', async () => {
    distributorFindUniqueMock.mockResolvedValue(SOURCE);
    itemFindManyMock.mockResolvedValue([]); // source has nothing matching

    const { res, promise } = callPreview({ fromDistributorId: SOURCE.id, barcodes: [BARCODE] });
    await promise;

    const payload = res.json.mock.calls[0][0] as { data: { lines: Array<{ status: string; parsed?: object }> } };
    expect(payload.data.lines[0].status).toBe('not_in_stock');
    // Parsed payload is still attached so the UI can offer "Add to source & include".
    expect(payload.data.lines[0].parsed).toBeDefined();
  });

  it('within-batch dedup: two identical barcodes claim two distinct units; a third is not_in_stock', async () => {
    distributorFindUniqueMock.mockResolvedValue(SOURCE);
    // Source has exactly two matching units.
    const units = [
      { id: 'u1', gtinShort: '9461479', lot: 'J260225-L170', rawBarcode: BARCODE, productLabel: 'L', expDate: new Date(Date.UTC(2031, 1, 24)), createdAt: new Date(2026, 0, 1) },
      { id: 'u2', gtinShort: '9461479', lot: 'J260225-L170', rawBarcode: BARCODE, productLabel: 'L', expDate: new Date(Date.UTC(2031, 1, 24)), createdAt: new Date(2026, 0, 2) },
    ];
    itemFindManyMock.mockResolvedValue(units);

    const { res, promise } = callPreview({
      fromDistributorId: SOURCE.id,
      barcodes: [BARCODE, BARCODE, BARCODE],
    });
    await promise;

    const payload = res.json.mock.calls[0][0] as { data: { lines: Array<{ status: string; matchedItemId?: string }> } };
    const matched = payload.data.lines.filter((l) => l.status === 'available').map((l) => l.matchedItemId);
    expect(new Set(matched).size).toBe(2); // each available row claims a distinct unit
    expect(payload.data.lines.filter((l) => l.status === 'not_in_stock')).toHaveLength(1);
  });

  it('returns "error" for an unparseable barcode (and does not query inventory)', async () => {
    distributorFindUniqueMock.mockResolvedValue(SOURCE);
    const { res, promise } = callPreview({ fromDistributorId: SOURCE.id, barcodes: [BAD_BARCODE] });
    await promise;
    const payload = res.json.mock.calls[0][0] as { data: { lines: Array<{ status: string; errorMessage?: string }> } };
    expect(payload.data.lines[0].status).toBe('error');
    expect(payload.data.lines[0].errorMessage).toBeTruthy();
    expect(itemFindManyMock).not.toHaveBeenCalled();
  });

  it('404s if the source distributor does not exist', async () => {
    distributorFindUniqueMock.mockResolvedValue(null);
    const { res, promise } = callPreview({ fromDistributorId: 'missing', barcodes: [BARCODE] });
    await promise;
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('previewBatch — already-parsed items (Manual Entry fields)', () => {
  beforeEach(() => vi.clearAllMocks());

  // Manual-fields entry can't be re-parsed (its rawBarcode is a REF code), so
  // the client sends the parsed payload directly under `items`.
  const PARSED = { gtin: '08880008946147', gtinShort: '9461479', lot: 'J260225-L170', expDate: null, udi: '9461479-J260225-L170', rawBarcode: 'SO-SPFL-N-120' };

  it('matches a parsed item against source stock → "available"', async () => {
    distributorFindUniqueMock.mockResolvedValue(SOURCE);
    itemFindManyMock.mockResolvedValue([
      { id: 'item-M', gtinShort: '9461479', lot: 'J260225-L170', rawBarcode: 'x', productLabel: 'Lag Screw', expDate: null, createdAt: new Date(2026, 0, 1) },
    ]);

    const { res, promise } = callPreview({ fromDistributorId: SOURCE.id, items: [PARSED] });
    await promise;

    const payload = res.json.mock.calls[0][0] as { data: { lines: Array<{ status: string; matchedItemId?: string }> } };
    expect(payload.data.lines).toHaveLength(1);
    expect(payload.data.lines[0].status).toBe('available');
    expect(payload.data.lines[0].matchedItemId).toBe('item-M');
  });

  it('flags a parsed item with no source match as "not_in_stock" (parsed kept for Add-to-source)', async () => {
    distributorFindUniqueMock.mockResolvedValue(SOURCE);
    itemFindManyMock.mockResolvedValue([]);

    const { res, promise } = callPreview({ fromDistributorId: SOURCE.id, items: [PARSED] });
    await promise;

    const payload = res.json.mock.calls[0][0] as { data: { lines: Array<{ status: string; parsed?: object }> } };
    expect(payload.data.lines[0].status).toBe('not_in_stock');
    expect(payload.data.lines[0].parsed).toBeDefined();
  });

  it('a parsed item missing gtin/lot is an "error" line (no inventory query)', async () => {
    distributorFindUniqueMock.mockResolvedValue(SOURCE);
    const { res, promise } = callPreview({ fromDistributorId: SOURCE.id, items: [{ gtinShort: '', lot: '' }] });
    await promise;
    const payload = res.json.mock.calls[0][0] as { data: { lines: Array<{ status: string }> } };
    expect(payload.data.lines[0].status).toBe('error');
    expect(itemFindManyMock).not.toHaveBeenCalled();
  });

  it('cross-input dedup: a barcode and a parsed item for the same lot share the claimed set', async () => {
    distributorFindUniqueMock.mockResolvedValue(SOURCE);
    // Only ONE matching unit at source for both the barcode and the manual item.
    itemFindManyMock.mockResolvedValue([
      { id: 'only1', gtinShort: '9461479', lot: 'J260225-L170', rawBarcode: BARCODE, productLabel: 'L', expDate: new Date(Date.UTC(2031, 1, 24)), createdAt: new Date(2026, 0, 1) },
    ]);

    const { res, promise } = callPreview({ fromDistributorId: SOURCE.id, barcodes: [BARCODE], items: [PARSED] });
    await promise;

    const payload = res.json.mock.calls[0][0] as { data: { lines: Array<{ status: string }> } };
    expect(payload.data.lines.filter((l) => l.status === 'available')).toHaveLength(1);
    expect(payload.data.lines.filter((l) => l.status === 'not_in_stock')).toHaveLength(1);
  });
});

describe('reassign — expectedFromDistributorId source guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.mockResolvedValue([]);
  });

  it('returns 409 when the item is no longer at the expected source', async () => {
    itemFindUniqueMock.mockResolvedValue({
      id: 'i1',
      distributorId: OTHER.id, // item moved to a different distributor since preview
      deletedAt: null,
      distributor: OTHER,
    });

    const { res, promise } = callReassign('i1', {
      distributorId: 'dest1',
      expectedFromDistributorId: SOURCE.id,
      skipTransferRecord: true,
    });
    await promise;

    expect(res.status).toHaveBeenCalledWith(409);
    expect(txMock).not.toHaveBeenCalled(); // critical: nothing was moved
  });

  it('proceeds when expectedFromDistributorId matches the item\'s current distributor', async () => {
    itemFindUniqueMock.mockResolvedValue({
      id: 'i2',
      distributorId: SOURCE.id,
      deletedAt: null,
      distributor: SOURCE,
    });
    distributorFindUniqueMock.mockResolvedValue({ id: 'dest1', name: 'Dest', active: true });

    const { res, promise } = callReassign('i2', {
      distributorId: 'dest1',
      expectedFromDistributorId: SOURCE.id,
      skipTransferRecord: true,
    });
    await promise;

    expect(txMock).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalledWith(409);
  });
});
