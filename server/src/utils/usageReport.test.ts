import { describe, it, expect } from 'vitest';
import {
  monthKey,
  lastNMonths,
  windowStart,
  monthBounds,
  buildTrends,
  buildMatrix,
  buildItemTotals,
  buildMonthlyUsage,
  yearBounds,
  type UsedRow,
} from './usageReport.js';

/**
 * Usage aggregation is timezone-sensitive (it buckets by UTC month). Run under
 * e.g. TZ=America/New_York and TZ=UTC to confirm the same bucketing.
 */

// REF codes that deterministically classify into each category.
const REF = {
  short: 'SO-SPFN-0180-10-25',
  long: 'SO-SPFN-0300-10L-25',
  lag: 'SO-SPFL-N70',
  lagB: 'SO-SPFL-N75',   // a second Lag Screw, for within-category ranking
  inter: 'SO-S50I-SO-032-T',
};

// Distributors are irrelevant to buildItemTotals (it pools across them) but
// buildMatrix still needs them for the cross-check invariant.
const DISTS = [
  { id: 'd1', name: 'Garcia Medical Solutions' },
  { id: 'd2', name: 'Swede Creek' },
];

// Use the REF as the gtinShort key so each distinct product groups separately
// (in production each gtinShort maps 1:1 to a REF). Category/itemNumber still
// resolve from the REF embedded in rawBarcode.
function row(ref: string, distributorId: string | null, usedAt: string): UsedRow {
  return { gtinShort: ref, rawBarcode: `(10)LOT ${ref}`, distributorId, usedAt: new Date(usedAt) };
}

describe('date helpers', () => {
  it('monthKey uses the UTC month regardless of timezone', () => {
    expect(monthKey(new Date('2026-06-01T00:00:00.000Z'))).toBe('2026-06');
    // 2026-07-01T00:30 UTC is still July in UTC even where local time is June.
    expect(monthKey(new Date('2026-07-01T00:30:00.000Z'))).toBe('2026-07');
  });

  it('lastNMonths returns ascending keys ending at the current month', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    expect(lastNMonths(3, now)).toEqual(['2026-04', '2026-05', '2026-06']);
    expect(lastNMonths(12, now)[0]).toBe('2025-07');
    expect(lastNMonths(12, now)).toHaveLength(12);
  });

  it('windowStart is UTC midnight of the first day of the earliest month', () => {
    const now = new Date('2026-06-15T12:00:00.000Z');
    expect(windowStart(3, now).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('monthBounds gives [start, end) and rolls Dec → Jan', () => {
    expect(monthBounds('2026-06').start.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(monthBounds('2026-06').end.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(monthBounds('2026-12').end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});

describe('buildTrends', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');
  const months = lastNMonths(3, now); // 2026-04, -05, -06

  it('counts units per category per month, with totals', () => {
    const rows = [
      row(REF.short, 'd1', '2026-04-10T00:00:00Z'),
      row(REF.short, 'd1', '2026-06-02T00:00:00Z'),
      row(REF.long, 'd2', '2026-06-20T00:00:00Z'),
      row(REF.lag, 'd1', '2026-05-05T00:00:00Z'),
      row(REF.short, 'd1', '2026-01-01T00:00:00Z'), // outside window → ignored
    ];
    const t = buildTrends(rows, months);

    expect(t.total).toBe(4);
    expect(t.totalsByMonth).toEqual({ '2026-04': 1, '2026-05': 1, '2026-06': 2 });

    const short = t.series.find((s) => s.category === 'Short Nail')!;
    expect(short.byMonth).toEqual({ '2026-04': 1, '2026-05': 0, '2026-06': 1 });
    expect(short.total).toBe(2);
    // Categories appear in catalog order: Short Nail before Long Nail before Lag Screw.
    expect(t.categories).toEqual(['Short Nail', 'Long Nail', 'Lag Screw']);
  });
});

describe('buildMatrix', () => {
  const distributors = [
    { id: 'd1', name: 'Acme' },
    { id: 'd2', name: 'Beta' },
  ];

  it('pivots category × distributor and adds an Unassigned column when needed', () => {
    const rows = [
      row(REF.short, 'd1', '2026-06-01T00:00:00Z'),
      row(REF.short, 'd2', '2026-06-01T00:00:00Z'),
      row(REF.long, 'd1', '2026-06-01T00:00:00Z'),
      row(REF.inter, null, '2026-06-01T00:00:00Z'), // unassigned
    ];
    const m = buildMatrix(rows, distributors);

    expect(m.columns.map((c) => c.id)).toEqual(['d1', 'd2', 'unassigned']);
    expect(m.grandTotal).toBe(4);
    expect(m.totalsByColumn).toMatchObject({ d1: 2, d2: 1, unassigned: 1 });

    const short = m.rows.find((r) => r.category === 'Short Nail')!;
    expect(short.counts).toMatchObject({ d1: 1, d2: 1 });
    expect(short.total).toBe(2);
  });

  it('omits the Unassigned column when every unit has a distributor', () => {
    const rows = [row(REF.short, 'd1', '2026-06-01T00:00:00Z')];
    const m = buildMatrix(rows, distributors);
    expect(m.columns.map((c) => c.id)).toEqual(['d1', 'd2']);
  });
});

describe('buildMonthlyUsage', () => {
  it('itemizes per distributor with subtotals and a grand total', () => {
    const distributors = [
      { id: 'd1', name: 'Acme' },
      { id: 'd2', name: 'Beta' },
    ];
    const rows = [
      row(REF.short, 'd1', '2026-06-01T00:00:00Z'),
      row(REF.short, 'd1', '2026-06-03T00:00:00Z'), // same product+distributor → qty 2
      row(REF.lag, 'd1', '2026-06-04T00:00:00Z'),
      row(REF.long, 'd2', '2026-06-05T00:00:00Z'),
    ];
    const r = buildMonthlyUsage(rows, distributors);

    expect(r.grandTotal).toBe(4);
    const acme = r.groups.find((g) => g.distributorId === 'd1')!;
    expect(acme.subtotal).toBe(3);
    const shortItem = acme.items.find((i) => i.category === 'Short Nail')!;
    expect(shortItem.qty).toBe(2);
    expect(shortItem.itemNumber).toBe('SO-SPFN-0180-10-25');

    const beta = r.groups.find((g) => g.distributorId === 'd2')!;
    expect(beta.subtotal).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// yearBounds
// ---------------------------------------------------------------------------

describe('yearBounds', () => {
  it('spans Jan 1 of the year to Jan 1 of the next, in UTC', () => {
    const { start, end } = yearBounds(2026);
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('is half-open: Dec 31 23:59:59Z is inside, Jan 1 00:00:00Z is not', () => {
    const { start, end } = yearBounds(2026);
    const lastMoment = new Date('2026-12-31T23:59:59.999Z');
    const firstOfNext = new Date('2027-01-01T00:00:00.000Z');
    expect(lastMoment >= start && lastMoment < end).toBe(true);
    expect(firstOfNext >= start && firstOfNext < end).toBe(false);
  });

  it('abuts the following year with no gap or overlap', () => {
    expect(yearBounds(2025).end.getTime()).toBe(yearBounds(2026).start.getTime());
  });
});

// ---------------------------------------------------------------------------
// buildItemTotals
// ---------------------------------------------------------------------------

describe('buildItemTotals', () => {
  it('counts units per item and totals them', () => {
    const out = buildItemTotals([
      row(REF.lag, 'd1', '2026-03-01'),
      row(REF.lag, 'd2', '2026-04-01'),
      row(REF.short, 'd1', '2026-05-01'),
    ]);
    expect(out.grandTotal).toBe(3);
    const lag = out.categories.flatMap((c) => c.items).find((i) => i.gtinShort === REF.lag)!;
    expect(lag.qty).toBe(2);
  });

  it('pools usage across distributors — there is no per-distributor split', () => {
    // The whole point of this report: who used it does not matter, only how many.
    const sameItemEverywhere = buildItemTotals([
      row(REF.lag, 'd1', '2026-03-01'),
      row(REF.lag, 'd2', '2026-03-02'),
      row(REF.lag, null, '2026-03-03'),
    ]);
    const items = sameItemEverywhere.categories.flatMap((c) => c.items);
    expect(items).toHaveLength(1);
    expect(items[0].qty).toBe(3);
  });

  it('groups items under their product category', () => {
    const out = buildItemTotals([
      row(REF.lag, 'd1', '2026-03-01'),
      row(REF.short, 'd1', '2026-03-02'),
      row(REF.inter, 'd1', '2026-03-03'),
    ]);
    const names = out.categories.map((c) => c.category);
    expect(names).toContain('Lag Screw');
    expect(names).toContain('Short Nail');
    expect(names).toContain('Interlocking Screw');
  });

  it('orders categories by the catalogue, not by volume', () => {
    // One Short Nail against many Lag Screws: Short Nail still comes first,
    // because PRODUCT_CATEGORIES lists it first.
    const out = buildItemTotals([
      row(REF.short, 'd1', '2026-03-01'),
      ...Array.from({ length: 5 }, () => row(REF.lag, 'd1', '2026-03-02')),
    ]);
    expect(out.categories.map((c) => c.category)).toEqual(['Short Nail', 'Lag Screw']);
  });

  it('ranks items most-used first WITHIN a category', () => {
    const out = buildItemTotals([
      row(REF.lag, 'd1', '2026-03-01'),
      ...Array.from({ length: 4 }, () => row(REF.lagB, 'd1', '2026-03-02')),
    ]);
    const lagItems = out.categories.find((c) => c.category === 'Lag Screw')!.items;
    expect(lagItems.map((i) => i.qty)).toEqual([4, 1]);
  });

  it('subtotals equal the sum of their items, and grandTotal the sum of subtotals', () => {
    const out = buildItemTotals([
      row(REF.lag, 'd1', '2026-03-01'),
      row(REF.lagB, 'd2', '2026-03-02'),
      row(REF.short, 'd1', '2026-03-03'),
      row(REF.inter, null, '2026-03-04'),
    ]);
    for (const c of out.categories) {
      expect(c.subtotal).toBe(c.items.reduce((s, i) => s + i.qty, 0));
    }
    expect(out.grandTotal).toBe(out.categories.reduce((s, c) => s + c.subtotal, 0));
  });

  it('omits categories with no usage', () => {
    const out = buildItemTotals([row(REF.lag, 'd1', '2026-03-01')]);
    expect(out.categories.map((c) => c.category)).toEqual(['Lag Screw']);
  });

  it('returns nothing for no usage', () => {
    const out = buildItemTotals([]);
    expect(out.categories).toEqual([]);
    expect(out.grandTotal).toBe(0);
  });

  it('labels an unresolvable item with its gtinShort rather than leaving it blank', () => {
    const out = buildItemTotals([
      { gtinShort: '0000000', rawBarcode: '', distributorId: 'd1', usedAt: new Date('2026-03-01') },
    ]);
    const item = out.categories.flatMap((c) => c.items)[0];
    expect(item.itemNumber).toBe('0000000');
    expect(item.productLabel).toBeTruthy();
  });

  it('agrees with buildMatrix on the grand total for the same rows', () => {
    // Same source rows, different grouping — the company-wide figure must match.
    // This is the invariant that catches a grouping bug in either report.
    const rows = [
      row(REF.lag, 'd1', '2026-03-01'),
      row(REF.lag, 'd2', '2026-04-01'),
      row(REF.short, 'd1', '2026-05-01'),
      row(REF.inter, null, '2026-06-01'),
    ];
    expect(buildItemTotals(rows).grandTotal).toBe(buildMatrix(rows, DISTS).grandTotal);
  });
});
