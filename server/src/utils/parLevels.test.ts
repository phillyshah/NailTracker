import { describe, it, expect } from 'vitest';
import { effectivePar, buildReorderRows, type ParLevelRow } from './parLevels.js';

const DISTS = [
  { id: 'd1', name: 'Berwyn' },
  { id: 'd2', name: 'Joslin' },
];

const labels = {
  'SO-SPFN-0180-10-25': { gtinShort: '9459148', productLabel: 'Short Nail 180/10' },
};

describe('effectivePar', () => {
  const levels: ParLevelRow[] = [
    { itemNumber: 'A', gtinShort: 'g', distributorId: null, minStock: 5 },
    { itemNumber: 'A', gtinShort: 'g', distributorId: 'd2', minStock: 10 },
  ];

  it('uses the per-distributor override when present', () => {
    expect(effectivePar('A', 'd2', levels)).toBe(10);
  });

  it('falls back to the global default when no override', () => {
    expect(effectivePar('A', 'd1', levels)).toBe(5);
  });

  it('returns null when neither override nor global exists', () => {
    expect(effectivePar('B', 'd1', levels)).toBeNull();
  });
});

describe('buildReorderRows', () => {
  it('flags only items below par, with shortage = par - current', () => {
    const levels: ParLevelRow[] = [
      { itemNumber: 'SO-SPFN-0180-10-25', gtinShort: '9459148', distributorId: null, minStock: 5 },
    ];
    const rows = buildReorderRows({
      distributors: DISTS,
      levels,
      current: { 'SO-SPFN-0180-10-25|d1': 2 }, // d1 below par, d2 has none (0)
      labels,
    });
    // d1: 2 < 5 → shortage 3; d2: 0 < 5 → shortage 5
    expect(rows).toHaveLength(2);
    const d1 = rows.find((r) => r.distributorId === 'd1')!;
    expect(d1.current).toBe(2);
    expect(d1.par).toBe(5);
    expect(d1.shortage).toBe(3);
    const d2 = rows.find((r) => r.distributorId === 'd2')!;
    expect(d2.current).toBe(0);
    expect(d2.shortage).toBe(5);
  });

  it('excludes items at or above par', () => {
    const levels: ParLevelRow[] = [
      { itemNumber: 'A', gtinShort: 'g', distributorId: null, minStock: 3 },
    ];
    const rows = buildReorderRows({
      distributors: [{ id: 'd1', name: 'Berwyn' }],
      levels,
      current: { 'A|d1': 3 }, // exactly at par → not low
      labels: { A: { gtinShort: 'g', productLabel: 'A' } },
    });
    expect(rows).toHaveLength(0);
  });

  it('per-distributor override wins over the global default', () => {
    const levels: ParLevelRow[] = [
      { itemNumber: 'A', gtinShort: 'g', distributorId: null, minStock: 2 },
      { itemNumber: 'A', gtinShort: 'g', distributorId: 'd2', minStock: 8 },
    ];
    const rows = buildReorderRows({
      distributors: DISTS,
      levels,
      current: { 'A|d1': 2, 'A|d2': 4 }, // d1 meets global(2); d2 below override(8)
      labels: { A: { gtinShort: 'g', productLabel: 'A' } },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].distributorId).toBe('d2');
    expect(rows[0].par).toBe(8);
    expect(rows[0].shortage).toBe(4);
  });

  it('ignores a zero/negative par', () => {
    const levels: ParLevelRow[] = [
      { itemNumber: 'A', gtinShort: 'g', distributorId: null, minStock: 0 },
    ];
    const rows = buildReorderRows({
      distributors: [{ id: 'd1', name: 'Berwyn' }],
      levels,
      current: {},
      labels: { A: { gtinShort: 'g', productLabel: 'A' } },
    });
    expect(rows).toHaveLength(0);
  });

  it('carries the usage/month context onto each row', () => {
    const levels: ParLevelRow[] = [
      { itemNumber: 'A', gtinShort: 'g', distributorId: null, minStock: 5 },
    ];
    const rows = buildReorderRows({
      distributors: [{ id: 'd1', name: 'Berwyn' }],
      levels,
      current: { 'A|d1': 1 },
      labels: { A: { gtinShort: 'g', productLabel: 'A' } },
      usage: { 'A|d1': 2.5 },
    });
    expect(rows[0].usagePerMonth).toBe(2.5);
  });
});
