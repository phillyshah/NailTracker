import { describe, it, expect } from 'vitest';
import { countByStatus, isTransferable, buildTransferItems, canReviewTransfer } from './transferBatch';
import type { BatchLine } from '../api/transfers';

function line(status: BatchLine['status'], id?: string): BatchLine {
  return {
    barcode: 'b',
    status,
    matchedItemId: id,
    productLabel: 'X',
    lot: 'L',
    expDate: null,
    parsed: id
      ? {
          gtin: '08800089459148',
          gtinShort: '9459148',
          lot: 'L',
          expDate: null,
          udi: '9459148-L',
          rawBarcode: 'b',
          productLabel: 'X',
        }
      : undefined,
  };
}

describe('countByStatus', () => {
  it('tallies per status and total', () => {
    const lines: BatchLine[] = [line('available', 'i1'), line('available', 'i2'), line('not_in_stock'), line('error')];
    expect(countByStatus(lines)).toEqual({ available: 2, not_in_stock: 1, error: 1, total: 4 });
  });
});

describe('isTransferable / buildTransferItems', () => {
  it('only includes available lines that the user has not excluded', () => {
    const lines: BatchLine[] = [line('available', 'i1'), line('available', 'i2'), line('not_in_stock'), line('error')];
    const excluded = new Set(['i2']);
    expect(isTransferable(lines[0], excluded)).toBe(true);
    expect(isTransferable(lines[1], excluded)).toBe(false);
    expect(isTransferable(lines[2], excluded)).toBe(false);
    expect(isTransferable(lines[3], excluded)).toBe(false);

    const out = buildTransferItems(lines, excluded);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('i1');
    expect(out[0].udi).toBe('9459148-L');
  });

  it('builds nothing when every available line is excluded', () => {
    const lines: BatchLine[] = [line('available', 'i1')];
    expect(buildTransferItems(lines, new Set(['i1']))).toEqual([]);
  });
});

describe('canReviewTransfer', () => {
  it('requires a destination in every mode', () => {
    expect(canReviewTransfer({ mode: 'pick', selectedCount: 3, includedCount: 0, hasDestination: false })).toBe(false);
    expect(canReviewTransfer({ mode: 'manual', selectedCount: 0, includedCount: 3, hasDestination: false })).toBe(false);
    expect(canReviewTransfer({ mode: 'excel', selectedCount: 0, includedCount: 3, hasDestination: false })).toBe(false);
  });

  it('gates pick mode on the selection count', () => {
    expect(canReviewTransfer({ mode: 'pick', selectedCount: 0, includedCount: 0, hasDestination: true })).toBe(false);
    expect(canReviewTransfer({ mode: 'pick', selectedCount: 1, includedCount: 0, hasDestination: true })).toBe(true);
  });

  it('gates manual AND excel modes on the included (staged) count', () => {
    // Regression: Import-from-Excel must enable Review just like Manual Transfer.
    expect(canReviewTransfer({ mode: 'excel', selectedCount: 0, includedCount: 0, hasDestination: true })).toBe(false);
    expect(canReviewTransfer({ mode: 'excel', selectedCount: 0, includedCount: 61, hasDestination: true })).toBe(true);
    expect(canReviewTransfer({ mode: 'manual', selectedCount: 0, includedCount: 1, hasDestination: true })).toBe(true);
  });
});
