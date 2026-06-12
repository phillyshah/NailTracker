import { describe, it, expect } from 'vitest';
import { reconcile, type ScanInput, type StockUnit } from './auditReconcile.js';

const scan = (key: string, gtinShort: string, lot: string, extra: Partial<ScanInput> = {}): ScanInput => ({
  key,
  gtinShort,
  lot,
  ...extra,
});

const unit = (id: string, gtinShort: string, lot: string, extra: Partial<StockUnit> = {}): StockUnit => ({
  id,
  gtinShort,
  lot,
  ...extra,
});

describe('reconcile', () => {
  it('matches a scan to a system unit of the same product + lot', () => {
    const r = reconcile([scan('s0', '9461479', 'LOT1')], [unit('i1', '9461479', 'LOT1')]);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].itemId).toBe('i1');
    expect(r.extra).toHaveLength(0);
    expect(r.missing).toHaveLength(0);
  });

  it('flags a scanned item with no system unit as extra', () => {
    const r = reconcile([scan('s0', '9461479', 'NOPE', { productLabel: 'Lag Screw' })], []);
    expect(r.extra).toHaveLength(1);
    expect(r.extra[0].lot).toBe('NOPE');
    expect(r.matched).toHaveLength(0);
  });

  it('flags a system unit that was never scanned as missing', () => {
    const r = reconcile([], [unit('i1', '9461479', 'LOT1')]);
    expect(r.missing).toHaveLength(1);
    expect(r.missing[0].itemId).toBe('i1');
  });

  it('two identical scans claim two distinct units (1 matched + 1 extra when only one in stock)', () => {
    const r = reconcile(
      [scan('s0', '9461479', 'LOT1'), scan('s1', '9461479', 'LOT1')],
      [unit('i1', '9461479', 'LOT1')],
    );
    expect(r.matched).toHaveLength(1);
    expect(r.extra).toHaveLength(1);
    expect(r.missing).toHaveLength(0);
  });

  it('matches the FIFO unit first (oldest expiry claimed) and leaves the newer one missing', () => {
    const r = reconcile(
      [scan('s0', '9461479', 'LOT1')],
      [
        unit('newer', '9461479', 'LOT1', { expDate: '2031-01-01' }),
        unit('older', '9461479', 'LOT1', { expDate: '2030-01-01' }),
      ],
    );
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].itemId).toBe('older'); // oldest expiry claimed first
    expect(r.missing.map((m) => m.itemId)).toEqual(['newer']);
  });

  it('handles a mixed shelf: some matched, some missing, some extra', () => {
    const scans = [
      scan('a', '9461479', 'LOT1'), // matches i1
      scan('b', '9461479', 'LOT2'), // matches i2
      scan('c', '0000000', 'X'), // extra (not in system)
    ];
    const stock = [
      unit('i1', '9461479', 'LOT1'),
      unit('i2', '9461479', 'LOT2'),
      unit('i3', '9461479', 'LOT3'), // never scanned → missing
    ];
    const r = reconcile(scans, stock);
    expect(r.matched.map((m) => m.itemId).sort()).toEqual(['i1', 'i2']);
    expect(r.extra.map((e) => e.lot)).toEqual(['X']);
    expect(r.missing.map((m) => m.itemId)).toEqual(['i3']);
  });
});
