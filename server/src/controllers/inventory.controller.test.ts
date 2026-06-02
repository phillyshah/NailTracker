import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests the `edit` controller — the server side of the "Save Changes" button on
 * the item detail page — focusing on expiration-date handling. Prisma is mocked
 * so we can assert exactly what gets written without a database.
 */
const { findUniqueMock, updateMock, historyCreateMock, txMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  updateMock: vi.fn(),
  historyCreateMock: vi.fn(),
  txMock: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({
  prisma: {
    inventoryItem: { findUnique: findUniqueMock, update: updateMock },
    assignmentHistory: { create: historyCreateMock },
    $transaction: txMock,
  },
}));

import { edit } from './inventory.controller.js';

function makeRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('express').Response & {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

const baseItem = {
  id: 'item1',
  gtin: '08880089459148',
  gtinShort: '8945914',
  lot: 'LOT1',
  expDate: new Date(2030, 0, 1), // existing expiry: Jan 1 2030 (local midnight)
  udi: '8945914-LOT1',
  rawBarcode: 'SO-SPFN-0180-10-25', // manual entry (REF code, not a GS1 barcode)
  productLabel: 'Femoral Nail',
  distributorId: null,
  distributor: null,
  deletedAt: null,
};

function callEdit(body: Record<string, unknown>) {
  const req = {
    params: { id: 'item1' },
    body,
    user: { username: 'tester' },
  } as unknown as import('express').Request;
  const res = makeRes();
  return { res, promise: edit(req, res) };
}

describe('edit controller — Save Changes expiry handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue({ ...baseItem });
    updateMock.mockReturnValue('UPDATE_OP');
    historyCreateMock.mockReturnValue('HISTORY_OP');
    txMock.mockResolvedValue([]);
  });

  it('stores a newly-entered date at LOCAL midnight (no UTC off-by-one)', async () => {
    const { res, promise } = callEdit({ expDate: '2030-09-28' });
    await promise;

    // The Save Changes path must have written the item.
    expect(updateMock).toHaveBeenCalledTimes(1);
    const written = updateMock.mock.calls[0][0].data.expDate as Date;

    // Must equal the scan path's construction, not new Date("2030-09-28") (UTC).
    expect(written.getTime()).toBe(new Date(2030, 8, 28).getTime());
    expect(written.getFullYear()).toBe(2030);
    expect(written.getMonth()).toBe(8); // September
    expect(written.getDate()).toBe(28); // the day the user typed survives
    expect(written.getHours()).toBe(0);

    // And it reports success.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      success: true,
      data: { message: 'Item updated' },
    });
  });

  it('clears the expiry when an empty date is submitted', async () => {
    const { promise } = callEdit({ expDate: '' });
    await promise;

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0].data.expDate).toBeNull();
  });

  it('treats re-saving the same date as no change (does not rewrite)', async () => {
    // Existing expiry already Sep 28 2030; user opens edit and saves without
    // touching the date — change detection compares calendar days and no-ops.
    findUniqueMock.mockResolvedValue({ ...baseItem, expDate: new Date(2030, 8, 28) });

    const { res, promise } = callEdit({ expDate: '2030-09-28' });
    await promise;

    expect(updateMock).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0]).toMatchObject({
      success: true,
      data: { message: 'No changes' },
    });
  });

  it('records the expiry change in the audit history', async () => {
    const { promise } = callEdit({ expDate: '2030-09-28' });
    await promise;

    expect(historyCreateMock).toHaveBeenCalledTimes(1);
    const note = historyCreateMock.mock.calls[0][0].data.note as string;
    expect(note).toContain('Expiry');
    expect(note).toContain('2030-09-28');
  });
});
