import { describe, it, expect } from 'vitest';
import {
  monthKey,
  lastNMonths,
  windowStart,
  monthBounds,
  buildTrends,
  buildMatrix,
  buildMonthlyUsage,
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
  inter: 'SO-S50I-SO-032-T',
};

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
