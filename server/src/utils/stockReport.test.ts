import { describe, it, expect } from 'vitest';
import { buildStockRows, HOME, type StockGroup } from './stockReport.js';

const g = (
  gtinShort: string,
  distributorId: string | null,
  count: number,
  productLabel = 'Lag Screw',
  rawBarcode = '',
): StockGroup => ({ gtinShort, rawBarcode, productLabel, distributorId, count });

describe('buildStockRows', () => {
  it('sums counts per location into one row per item', () => {
    const rows = buildStockRows(
      [g('9454785', null, 3), g('9454785', 'd1', 5), g('9454785', 'd2', 2)],
      ['d1', 'd2'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].counts[HOME]).toBe(3);
    expect(rows[0].counts.d1).toBe(5);
    expect(rows[0].counts.d2).toBe(2);
    expect(rows[0].total).toBe(10);
  });

  it('zero-fills every distributor column even with no stock there', () => {
    const rows = buildStockRows([g('9454785', 'd1', 1)], ['d1', 'd2', 'd3']);
    expect(rows[0].counts).toEqual({ [HOME]: 0, d1: 1, d2: 0, d3: 0 });
  });

  it('aggregates counts, not row occurrences — a group of N counts as N', () => {
    // This is the regression the groupBy rewrite had to preserve: the previous
    // implementation iterated one row per unit and did `+= 1`.
    const rows = buildStockRows([g('9454785', 'd1', 97)], ['d1']);
    expect(rows[0].total).toBe(97);
  });

  it('merges groups that differ only by rawBarcode or label into one row', () => {
    const rows = buildStockRows(
      [g('9454785', 'd1', 2, 'Lag Screw', 'A'), g('9454785', 'd1', 3, 'Lag Screw', 'B')],
      ['d1'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(5);
  });

  it('keeps rows separate for different products', () => {
    const rows = buildStockRows([g('9454785', 'd1', 1), g('9454792', 'd1', 4)], ['d1']);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.total).reduce((a, b) => a + b)).toBe(5);
  });

  it('falls back to gtinShort for the export, blank for the JSON report', () => {
    const unknown = [g('0000000', 'd1', 1)];
    expect(buildStockRows(unknown, ['d1'], 'gtinShort')[0].itemNumber).toBe('0000000');
    expect(buildStockRows(unknown, ['d1'], 'empty')[0].itemNumber).toBe('');
  });

  it('labels an unknown product rather than emitting null', () => {
    const rows = buildStockRows([g('9454785', null, 1, null)], []);
    expect(rows[0].productLabel).toBe('Unknown');
  });

  it('returns an empty list for no groups', () => {
    expect(buildStockRows([], ['d1'])).toEqual([]);
  });

  it('sorts deterministically by item number', () => {
    const rows = buildStockRows(
      [g('9454815', 'd1', 1), g('9454785', 'd1', 1), g('9454792', 'd1', 1)],
      ['d1'],
      'gtinShort',
    );
    const keys = rows.map((r) => r.itemNumber || r.gtinShort);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });
});
