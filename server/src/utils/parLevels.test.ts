import { describe, it, expect } from 'vitest';
import {
  effectivePar,
  resolvePar,
  buildReorderRows,
  type ParLevelRow,
  type ReorderItem,
} from './parLevels.js';

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

// ---------------------------------------------------------------------------
// Months-of-cover pars
// ---------------------------------------------------------------------------

const CATALOG: ReorderItem[] = [
  { itemNumber: 'A', gtinShort: 'g', productLabel: 'Screw A', group: 'Interlocking Screw' },
];

describe('resolvePar — months of cover', () => {
  it('converts cover months against that item/distributor usage rate', () => {
    // 1.5 units/month x 12 months = 18
    const levels = [item({ coverMonths: 12 })];
    expect(resolvePar('A', 'Interlocking Screw', 'd1', levels, 1.5)).toEqual({
      par: 18,
      basis: 'cover',
      coverMonths: 12,
    });
  });

  it('rounds up — a partial unit of cover still needs a whole unit', () => {
    expect(resolvePar('A', 'Interlocking Screw', 'd1', [item({ coverMonths: 3 })], 0.4)?.par).toBe(2);
  });

  it('cover wins over a fixed quantity on the same row', () => {
    const levels = [item({ minStock: 99, coverMonths: 6 })];
    expect(resolvePar('A', 'Interlocking Screw', 'd1', levels, 2)).toMatchObject({
      par: 12,
      basis: 'cover',
    });
  });

  it('falls back to the fixed quantity when coverMonths is null or zero', () => {
    expect(resolvePar('A', 'Interlocking Screw', 'd1', [item({ minStock: 7 })], 5)).toEqual({
      par: 7,
      basis: 'qty',
    });
    expect(
      resolvePar('A', 'Interlocking Screw', 'd1', [item({ minStock: 7, coverMonths: 0 })], 5),
    ).toEqual({ par: 7, basis: 'qty' });
  });

  it('yields NO par when cover is set but the item has no usage history', () => {
    // Deliberate: with no demand signal there is nothing to infer. Returning 0
    // would silently drop the item off the reorder report instead of saying so.
    expect(resolvePar('A', 'Interlocking Screw', 'd1', [item({ coverMonths: 12 })], 0)).toBeNull();
  });

  it('a fixed-quantity par is unaffected by usage', () => {
    const levels = [item({ minStock: 4 })];
    expect(effectivePar('A', 'Interlocking Screw', 'd1', levels, 0)).toBe(4);
    expect(effectivePar('A', 'Interlocking Screw', 'd1', levels, 99)).toBe(4);
  });

  it('a category cover par sizes each distributor to its own demand', () => {
    // One "6 months of cover" entry on the group; d1 and d2 get different pars
    // because they consume at different rates. This is the whole point.
    const levels = [{ ...group('Interlocking Screw', 0), coverMonths: 6 }];
    const rows = buildReorderRows({
      distributors: DISTS,
      levels,
      current: { 'A|d1': 0, 'A|d2': 0 },
      items: CATALOG,
      usage: { 'A|d1': 1, 'A|d2': 5 },
    });
    const byDist = Object.fromEntries(rows.map((r) => [r.distributorId, r.par]));
    expect(byDist).toEqual({ d1: 6, d2: 30 });
  });
});

describe('buildReorderRows — cover basis is reported', () => {
  it('labels a cover-derived row with its basis and months', () => {
    const rows = buildReorderRows({
      distributors: [DISTS[0]],
      levels: [item({ coverMonths: 12 })],
      current: { 'A|d1': 2 },
      items: CATALOG,
      usage: { 'A|d1': 1.5 },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      par: 18,
      current: 2,
      shortage: 16,
      parBasis: 'cover',
      parCoverMonths: 12,
    });
  });

  it('labels a quantity-derived row as such, with no months', () => {
    const rows = buildReorderRows({
      distributors: [DISTS[0]],
      levels: [item({ minStock: 10 })],
      current: { 'A|d1': 4 },
      items: CATALOG,
    });
    expect(rows[0].parBasis).toBe('qty');
    expect(rows[0].parCoverMonths).toBeUndefined();
  });

  it('omits a cover-par item with no usage rather than reporting par 0', () => {
    const rows = buildReorderRows({
      distributors: [DISTS[0]],
      levels: [item({ coverMonths: 12 })],
      current: { 'A|d1': 0 },
      items: CATALOG,
      usage: {},
    });
    expect(rows).toEqual([]);
  });

  it('still suppresses rows that are at or above their cover-derived par', () => {
    const rows = buildReorderRows({
      distributors: [DISTS[0]],
      levels: [item({ coverMonths: 2 })],
      current: { 'A|d1': 10 }, // 2 months x 3/mo = 6, and 10 >= 6
      items: CATALOG,
      usage: { 'A|d1': 3 },
    });
    expect(rows).toEqual([]);
  });
});
