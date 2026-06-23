import { describe, it, expect } from 'vitest';
import { effectivePar, buildReorderRows, type ParLevelRow, type ReorderItem } from './parLevels.js';

const DISTS = [
  { id: 'd1', name: 'Berwyn' },
  { id: 'd2', name: 'Joslin' },
];

const item = (over: Partial<ParLevelRow>): ParLevelRow => ({
  scope: 'item',
  itemNumber: 'A',
  category: 'Interlocking Screw',
  gtinShort: 'g',
  distributorId: null,
  minStock: 0,
  ...over,
});

const group = (category: string, minStock: number): ParLevelRow => ({
  scope: 'category',
  itemNumber: null,
  category,
  gtinShort: null,
  distributorId: null,
  minStock,
});

describe('effectivePar', () => {
  it('uses the per-distributor SKU override when present', () => {
    const levels = [item({ minStock: 5 }), item({ distributorId: 'd2', minStock: 10 })];
    expect(effectivePar('A', 'Interlocking Screw', 'd2', levels)).toBe(10);
  });

  it('falls back to the SKU global default when no override', () => {
    const levels = [item({ minStock: 5 }), item({ distributorId: 'd2', minStock: 10 })];
    expect(effectivePar('A', 'Interlocking Screw', 'd1', levels)).toBe(5);
  });

  it('falls back to the group par when no SKU par exists', () => {
    const levels = [group('Interlocking Screw', 3)];
    expect(effectivePar('A', 'Interlocking Screw', 'd1', levels)).toBe(3);
  });

  it('prefers a SKU par over the group par', () => {
    const levels = [group('Interlocking Screw', 3), item({ minStock: 8 })];
    expect(effectivePar('A', 'Interlocking Screw', 'd1', levels)).toBe(8);
  });

  it('returns null when no SKU or group par applies', () => {
    expect(effectivePar('B', 'Cap Screw', 'd1', [group('Interlocking Screw', 3)])).toBeNull();
  });
});

const items: ReorderItem[] = [
  { itemNumber: 'A', gtinShort: 'g', productLabel: 'Screw A', group: 'Interlocking Screw' },
];

describe('buildReorderRows', () => {
  it('flags only items below par, with shortage = par - current', () => {
    const rows = buildReorderRows({
      distributors: DISTS,
      levels: [item({ minStock: 5 })],
      current: { 'A|d1': 2 }, // d1 below par, d2 has none (0)
      items,
    });
    expect(rows).toHaveLength(2);
    const d1 = rows.find((r) => r.distributorId === 'd1')!;
    expect(d1.current).toBe(2);
    expect(d1.par).toBe(5);
    expect(d1.shortage).toBe(3);
    const d2 = rows.find((r) => r.distributorId === 'd2')!;
    expect(d2.current).toBe(0);
    expect(d2.shortage).toBe(5);
  });

  it('applies a group par to every SKU in the group', () => {
    const groupItems: ReorderItem[] = [
      { itemNumber: 'A', gtinShort: 'g', productLabel: 'Screw A', group: 'Interlocking Screw' },
      { itemNumber: 'B', gtinShort: 'h', productLabel: 'Screw B', group: 'Interlocking Screw' },
    ];
    const rows = buildReorderRows({
      distributors: [{ id: 'd1', name: 'Berwyn' }],
      levels: [group('Interlocking Screw', 4)],
      current: { 'A|d1': 1 }, // A short by 3, B short by 4
      items: groupItems,
    });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.itemNumber === 'A')!.shortage).toBe(3);
    expect(rows.find((r) => r.itemNumber === 'B')!.shortage).toBe(4);
  });

  it('lets a SKU par override the group par for that item', () => {
    const groupItems: ReorderItem[] = [
      { itemNumber: 'A', gtinShort: 'g', productLabel: 'Screw A', group: 'Interlocking Screw' },
      { itemNumber: 'B', gtinShort: 'h', productLabel: 'Screw B', group: 'Interlocking Screw' },
    ];
    const rows = buildReorderRows({
      distributors: [{ id: 'd1', name: 'Berwyn' }],
      levels: [group('Interlocking Screw', 4), item({ itemNumber: 'A', minStock: 1 })],
      current: { 'A|d1': 1, 'B|d1': 1 }, // A meets its SKU par of 1; B below group par of 4
      items: groupItems,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].itemNumber).toBe('B');
    expect(rows[0].shortage).toBe(3);
  });

  it('excludes items at or above par', () => {
    const rows = buildReorderRows({
      distributors: [{ id: 'd1', name: 'Berwyn' }],
      levels: [item({ minStock: 3 })],
      current: { 'A|d1': 3 }, // exactly at par → not low
      items,
    });
    expect(rows).toHaveLength(0);
  });

  it('per-distributor override wins over the global default', () => {
    const rows = buildReorderRows({
      distributors: DISTS,
      levels: [item({ minStock: 2 }), item({ distributorId: 'd2', minStock: 8 })],
      current: { 'A|d1': 2, 'A|d2': 4 }, // d1 meets global(2); d2 below override(8)
      items,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].distributorId).toBe('d2');
    expect(rows[0].par).toBe(8);
    expect(rows[0].shortage).toBe(4);
  });

  it('ignores a zero/negative par', () => {
    const rows = buildReorderRows({
      distributors: [{ id: 'd1', name: 'Berwyn' }],
      levels: [item({ minStock: 0 })],
      current: {},
      items,
    });
    expect(rows).toHaveLength(0);
  });

  it('carries the usage/month context onto each row', () => {
    const rows = buildReorderRows({
      distributors: [{ id: 'd1', name: 'Berwyn' }],
      levels: [item({ minStock: 5 })],
      current: { 'A|d1': 1 },
      items,
      usage: { 'A|d1': 2.5 },
    });
    expect(rows[0].usagePerMonth).toBe(2.5);
  });
});
