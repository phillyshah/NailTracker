import { describe, it, expect } from 'vitest';
import {
  addBarcode,
  addManual,
  removeByKey,
  removeMatchingLine,
  toPreviewPayload,
  type StagedInput,
} from './transferStaging';
import type { BatchLineParsed } from '../api/transfers';

const parsed = (over: Partial<BatchLineParsed> = {}): BatchLineParsed => ({
  gtin: '08880008946147',
  gtinShort: '9461479',
  lot: 'J260225-L170',
  expDate: null,
  udi: '9461479-J260225-L170',
  rawBarcode: 'SO-SPFL-N-120',
  productLabel: 'Lag Screw',
  ...over,
});

describe('transferStaging', () => {
  it('appends two identical barcodes as two distinct staged inputs', () => {
    let list: StagedInput[] = [];
    list = addBarcode(list, 'CODE-1');
    list = addBarcode(list, 'CODE-1');
    expect(list).toHaveLength(2);
    // Distinct keys so each can be removed independently.
    expect(list[0].key).not.toBe(list[1].key);
    // The full list is sent so the server can dedup across both.
    expect(toPreviewPayload(list).barcodes).toEqual(['CODE-1', 'CODE-1']);
  });

  it('partitions barcode vs manual inputs in the preview payload', () => {
    let list: StagedInput[] = [];
    list = addBarcode(list, 'CODE-1');
    list = addManual(list, parsed());
    list = addBarcode(list, 'CODE-2');
    const payload = toPreviewPayload(list);
    expect(payload.barcodes).toEqual(['CODE-1', 'CODE-2']);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].udi).toBe('9461479-J260225-L170');
  });

  it('removeByKey removes only the targeted input', () => {
    let list: StagedInput[] = [];
    list = addBarcode(list, 'CODE-1');
    list = addBarcode(list, 'CODE-2');
    const target = list[0].key;
    list = removeByKey(list, target);
    expect(list).toHaveLength(1);
    expect(list[0].barcode).toBe('CODE-2');
  });

  it('removeMatchingLine drops exactly one of two duplicate barcodes', () => {
    let list: StagedInput[] = [];
    list = addBarcode(list, 'DUP');
    list = addBarcode(list, 'DUP');
    list = addBarcode(list, 'OTHER');
    list = removeMatchingLine(list, 'DUP');
    expect(list).toHaveLength(2);
    expect(list.filter((i) => i.barcode === 'DUP')).toHaveLength(1);
    expect(list.some((i) => i.barcode === 'OTHER')).toBe(true);
  });

  it('removeMatchingLine matches a manual item by its UDI', () => {
    let list: StagedInput[] = [];
    list = addManual(list, parsed({ udi: 'U-1' }));
    list = addManual(list, parsed({ udi: 'U-2' }));
    list = removeMatchingLine(list, 'U-1');
    expect(list).toHaveLength(1);
    expect(list[0].parsed?.udi).toBe('U-2');
  });
});
