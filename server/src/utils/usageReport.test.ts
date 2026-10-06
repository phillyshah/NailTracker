import { describe, it, expect } from 'vitest';
import {
  monthKey,
  lastNMonths,
  windowStart,
  monthBounds,
  buildTrends,
  buildMatrix,
  buildItemMatrix,
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
// buildItemMatrix
// ---------------------------------------------------------------------------

const DISTS = [
  { id: 'd1', name: 'Garcia Medical Solutions' },
  { id: 'd2', name: 'Swede Creek' },
];

describe('buildItemMatrix', () => {
  it('counts units per item per distributor, with a company-wide total', () => {
    const out = buildItemMatrix(
      [
        row(REF.lag, 'd1', '2026-03-01'),
        row(REF.lag, 'd1', '2026-04-01'),
        row(REF.lag, 'd2', '2026-05-01'),
        row(REF.short, 'd2', '2026-06-01'),
      ],
      DISTS,
    );
    expect(out.grandTotal).toBe(4);

    const lagRow = out.rows.find((r) => r.gtinShort === REF.lag)!;
    expect(lagRow.counts.d1).toBe(2);
    expect(lagRow.counts.d2).toBe(1);
    expect(lagRow.total).toBe(3);

    expect(out.totalsByColumn.d1).toBe(2);
    expect(out.totalsByColumn.d2).toBe(2);
  });

  it('keeps each item on its own row', () => {
    const out = buildItemMatrix(
      [row(REF.lag, 'd1', '2026-03-01'), row(REF.short, 'd1', '2026-03-02')],
      DISTS,
    );
    expect(out.rows).toHaveLength(2);
  });

  it('zero-fills every distributor column', () => {
    const out = buildItemMatrix([row(REF.lag, 'd1', '2026-03-01')], DISTS);
    expect(out.rows[0].counts.d2).toBe(0);
  });

  it('adds an Unassigned column only when some usage has no distributor', () => {
    const without = buildItemMatrix([row(REF.lag, 'd1', '2026-03-01')], DISTS);
    expect(without.columns.map((c) => c.id)).toEqual(['d1', 'd2']);

    const withUnassigned = buildItemMatrix(
      [row(REF.lag, 'd1', '2026-03-01'), row(REF.lag, null, '2026-03-02')],
      DISTS,
    );
    expect(withUnassigned.columns.map((c) => c.id)).toContain('unassigned');
    expect(withUnassigned.rows[0].counts.unassigned).toBe(1);
    expect(withUnassigned.rows[0].total).toBe(2);
  });

  it('labels a row with its item number, falling back to gtinShort', () => {
    const known = buildItemMatrix([row(REF.lag, 'd1', '2026-03-01')], DISTS);
    expect(known.rows[0].itemNumber).toBeTruthy();

    const unknown = buildItemMatrix(
      [{ gtinShort: '0000000', rawBarcode: '', distributorId: 'd1', usedAt: new Date('2026-03-01') }],
      DISTS,
    );
    expect(unknown.rows[0].itemNumber).toBe('0000000');
    expect(unknown.rows[0].productLabel).toBeTruthy();
  });

  it('sorts rows by item number', () => {
    const out = buildItemMatrix(
      [row(REF.short, 'd1', '2026-03-01'), row(REF.inter, 'd1', '2026-03-02'), row(REF.lag, 'd1', '2026-03-03')],
      DISTS,
    );
    const nums = out.rows.map((r) => r.itemNumber);
    expect(nums).toEqual([...nums].sort((a, b) => a.localeCompare(b)));
  });

  it('returns an empty pivot for no usage', () => {
    const out = buildItemMatrix([], DISTS);
    expect(out.rows).toEqual([]);
    expect(out.grandTotal).toBe(0);
  });

  it('agrees with buildMatrix on the totals for the same rows', () => {
    // Same source rows, different grouping -- the company-wide figures must match.
    // This is the invariant that catches a grouping bug in either report.
    const rows = [
      row(REF.lag, 'd1', '2026-03-01'),
      row(REF.lag, 'd2', '2026-04-01'),
      row(REF.short, 'd1', '2026-05-01'),
      row(REF.inter, null, '2026-06-01'),
    ];
    const byItem = buildItemMatrix(rows, DISTS);
    const byCategory = buildMatrix(rows, DISTS);

    expect(byItem.grandTotal).toBe(byCategory.grandTotal);
    expect(byItem.totalsByColumn).toEqual(byCategory.totalsByColumn);
    expect(byItem.columns.map((c) => c.id)).toEqual(byCategory.columns.map((c) => c.id));
  });
});
