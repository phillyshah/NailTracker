import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Guards the admin "Repair Barcodes" maintenance endpoint: it must re-derive
 * lot / expiry / udi from each item's stored rawBarcode, fix only the rows that
 * disagree, and leave un-parseable (manual REF) rows alone.
 */
const { findManyMock, updateMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    inventoryItem: { findMany: findManyMock, update: updateMock },
  },
}));

import { backfillReparse } from './inventory.controller.js';

function makeRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('express').Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

describe('backfillReparse — repair lot/expiry from rawBarcode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMock.mockResolvedValue({});
  });

  it('fixes a corrupted row (truncated lot + bogus expiry) from its barcode', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'bad1',
        rawBarcode: '010880008946147910J260225-L17017310224',
        // Values the old buggy parser stored:
        lot: 'J260225-L',
        udi: '9461479-J260225-L',
        gtinShort: '9461479',
        expDate: new Date(Date.UTC(2007, 0, 10)),
        productLabel: 'Lag Screw Normal 120mm',
      },
    ]);

    const res = makeRes();
    await backfillReparse({} as import('express').Request, res);

    expect(updateMock).toHaveBeenCalledTimes(1);
    const data = updateMock.mock.calls[0][0].data as { lot: string; udi: string; expDate: Date };
    expect(data.lot).toBe('J260225-L170');
    expect(data.udi).toBe('9461479-J260225-L170');
    expect(data.expDate.toISOString().slice(0, 10)).toBe('2031-02-24');

    const payload = res.json.mock.calls[0][0] as { data: { total: number; updated: number } };
    expect(payload.data).toEqual({ total: 1, updated: 1 });
  });

  it('leaves an already-correct row untouched (idempotent)', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'good1',
        rawBarcode: '010880008946147910J260225-L17017310224',
        lot: 'J260225-L170',
        udi: '9461479-J260225-L170',
        gtinShort: '9461479',
        expDate: new Date(Date.UTC(2031, 1, 24)),
        productLabel: 'Lag Screw Normal 120mm',
      },
    ]);

    const res = makeRes();
    await backfillReparse({} as import('express').Request, res);

    expect(updateMock).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0] as { data: { total: number; updated: number } };
    expect(payload.data).toEqual({ total: 1, updated: 0 });
  });

  it('skips rows whose rawBarcode is not a parseable GS1 string (manual REF)', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 'manual1',
        rawBarcode: 'SO-SPFN-0180-10-25',
        lot: 'HANDLOT',
        udi: '9461479-HANDLOT',
        gtinShort: '9461479',
        expDate: new Date(Date.UTC(2030, 0, 1)),
        productLabel: 'Short Nail',
      },
    ]);

    const res = makeRes();
    await backfillReparse({} as import('express').Request, res);

    expect(updateMock).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0] as { data: { total: number; updated: number } };
    expect(payload.data).toEqual({ total: 1, updated: 0 });
  });
});
