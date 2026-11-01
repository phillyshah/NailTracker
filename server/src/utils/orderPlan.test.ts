import { describe, it, expect } from 'vitest';
import {
  sizeMixFromUsage,
  companionRatiosFromCases,
  buildOrderPlan,
  type PlanItem,
} from './orderPlan.js';

const item = (itemNumber: string, category: string): PlanItem => ({
  itemNumber,
  gtinShort: itemNumber.replace(/\W/g, '').slice(-8),
  productLabel: itemNumber,
  category,
});

describe('sizeMixFromUsage', () => {
  it('shares each item within its own category, not across the catalogue', () => {
    const mix = sizeMixFromUsage([
      { itemNumber: 'N-A', category: 'Short Nail' },
      { itemNumber: 'N-A', category: 'Short Nail' },
      { itemNumber: 'N-B', category: 'Short Nail' },
      { itemNumber: 'L-1', category: 'Lag Screw' },
    ]);
    expect(mix['N-A']).toBeCloseTo(2 / 3, 6);
    expect(mix['N-B']).toBeCloseTo(1 / 3, 6);
    // A single lag screw is 100% of lag screws, not 25% of everything.
    expect(mix['L-1']).toBe(1);
  });

  it('shares within a category sum to 1', () => {
    const mix = sizeMixFromUsage([
      { itemNumber: 'a', category: 'Long Nail' },
      { itemNumber: 'b', category: 'Long Nail' },
      { itemNumber: 'c', category: 'Long Nail' },
      { itemNumber: 'c', category: 'Long Nail' },
    ]);
    const sum = ['a', 'b', 'c'].reduce((s, k) => s + mix[k], 0);
    expect(sum).toBeCloseTo(1, 6);
  });

  it('gives an unused item no share rather than inventing one', () => {
    const mix = sizeMixFromUsage([{ itemNumber: 'a', category: 'Cap Screw' }]);
    expect(mix['never-used']).toBeUndefined();
  });

  it('returns nothing for no usage', () => {
    expect(sizeMixFromUsage([])).toEqual({});
  });
});

describe('companionRatiosFromCases', () => {
  it('derives units per nail from cases', () => {
    const { ratios, nails, cases } = companionRatiosFromCases([
      { 'Short Nail': 1, 'Lag Screw': 1, 'Interlocking Screw': 2, 'Cap Screw': 1 },
      { 'Long Nail': 1, 'Lag Screw': 1, 'Interlocking Screw': 1, 'Cap Screw': 1 },
    ]);
    expect(nails).toBe(2);
    expect(cases).toBe(2);
    expect(ratios['Lag Screw']).toBe(1);
    expect(ratios['Interlocking Screw']).toBe(1.5);
    expect(ratios['Cap Screw']).toBe(1);
  });

  it('excludes nail-less groups, which would drag every ratio toward zero', () => {
    // The second group is a bare "mark as used" of two screws with no nail —
    // including it would report 1.5 lag screws per nail instead of 1.
    const { ratios, nails, cases } = companionRatiosFromCases([
      { 'Short Nail': 1, 'Lag Screw': 1 },
      { 'Lag Screw': 1 },
    ]);
    expect(cases).toBe(1);
    expect(nails).toBe(1);
    expect(ratios['Lag Screw']).toBe(1);
  });

  it('never reports a nail category as its own companion', () => {
    const { ratios } = companionRatiosFromCases([
      { 'Short Nail': 1, 'Long Nail': 1, 'Lag Screw': 2 },
    ]);
    expect(ratios['Short Nail']).toBeUndefined();
    expect(ratios['Long Nail']).toBeUndefined();
    expect(ratios['Lag Screw']).toBe(1); // 2 screws / 2 nails
  });

  it('is a lower bound when a case logged the nail but not its screws', () => {
    // Two identical cases, but one case's screws were never in stock so only
    // the nail got recorded. The true ratio is 1; we report 0.5 and the
    // caller must present it as a floor.
    const { ratios } = companionRatiosFromCases([
      { 'Short Nail': 1, 'Lag Screw': 1 },
      { 'Short Nail': 1 },
    ]);
    expect(ratios['Lag Screw']).toBe(0.5);
  });

  it('honours a custom nail-category list', () => {
    const { ratios, nails } = companionRatiosFromCases(
      [{ Widget: 2, Bolt: 4 }],
      ['Widget'],
    );
    expect(nails).toBe(2);
    expect(ratios['Bolt']).toBe(2);
  });

  it('returns no ratios when no case contains a nail', () => {
    const { ratios, nails, cases } = companionRatiosFromCases([{ 'Lag Screw': 3 }]);
    expect(ratios).toEqual({});
    expect(nails).toBe(0);
    expect(cases).toBe(0);
  });
});

describe('buildOrderPlan', () => {
  const items = [
    item('N-100', 'Short Nail'),
    item('N-200', 'Short Nail'),
    item('L-300', 'Long Nail'),
    item('S-400', 'Lag Screw'),
  ];
  const sizeMix = { 'N-100': 0.75, 'N-200': 0.25, 'L-300': 1, 'S-400': 1 };
  const base = {
    items,
    assumptions: {
      casesPerMonth: 10,
      leadTimeMonths: 6,
      coverMonths: 6,
      usableShelfMonths: 48,
    },
    ratios: { 'Lag Screw': 1 },
    sizeMix,
    longNailShare: 0.2,
    onHand: {} as Record<string, number>,
    onOrder: {} as Record<string, number>,
  };

  it('horizon is lead time plus cover, and nails follow from case volume', () => {
    const plan = buildOrderPlan(base);
    expect(plan.horizonMonths).toBe(12);
    expect(plan.totalNails).toBe(120);
  });

  it('splits nails short/long by the share, then across sizes by the mix', () => {
    const plan = buildOrderPlan(base);
    const by = Object.fromEntries(plan.rows.map((r) => [r.itemNumber, r]));
    // 120 nails: 24 long, 96 short. Short splits 75/25.
    expect(by['L-300'].required).toBe(24);
    expect(by['N-100'].required).toBe(72);
    expect(by['N-200'].required).toBe(24);
  });

  it('explodes companions from total nails, not from their own history', () => {
    const plan = buildOrderPlan(base);
    const lag = plan.rows.find((r) => r.itemNumber === 'S-400')!;
    expect(lag.required).toBe(120); // 1 per nail, both families
  });

  it('nets out stock on hand and stock already on order', () => {
    const plan = buildOrderPlan({
      ...base,
      onHand: { 'N-100': 20 },
      onOrder: { 'N-100': 12 },
    });
    const row = plan.rows.find((r) => r.itemNumber === 'N-100')!;
    expect(row.required).toBe(72);
    expect(row.gap).toBe(40);
    expect(row.suggested).toBe(40);
  });

  it('never suggests a negative quantity when over-stocked', () => {
    const plan = buildOrderPlan({ ...base, onHand: { 'N-100': 500 } });
    const row = plan.rows.find((r) => r.itemNumber === 'N-100')!;
    expect(row.gap).toBe(0);
    expect(row.suggested).toBe(0);
  });

  it('caps a slow mover at what can be consumed before it expires', () => {
    // 1 case/month over a 12-month horizon: 12 nails, 9.6 short, and N-200
    // takes a quarter of those -> 2 units required, 0.17/mo. With only 4
    // usable months, at most 1 unit can be consumed in time.
    const plan = buildOrderPlan({
      ...base,
      assumptions: { ...base.assumptions, casesPerMonth: 1, usableShelfMonths: 4 },
    });
    const row = plan.rows.find((r) => r.itemNumber === 'N-200')!;
    expect(row.gap).toBe(2);
    expect(row.suggested).toBe(1);
    expect(row.cappedByShelfLife).toBe(true);
    expect(plan.cappedCount).toBeGreaterThan(0);
  });

  it('does not flag a row as shelf-capped when demand decided the number', () => {
    const plan = buildOrderPlan(base);
    expect(plan.rows.every((r) => r.cappedByShelfLife === false)).toBe(true);
    expect(plan.cappedCount).toBe(0);
  });

  it('counts stock on hand against the shelf-life ceiling', () => {
    // Shelf ceiling is 1 unit of consumption, and one is already held, so
    // there is nothing left to buy even though a unit is still short.
    const plan = buildOrderPlan({
      ...base,
      assumptions: { ...base.assumptions, casesPerMonth: 1, usableShelfMonths: 4 },
      onHand: { 'N-200': 1 },
    });
    const row = plan.rows.find((r) => r.itemNumber === 'N-200')!;
    expect(row.gap).toBe(1);
    expect(row.suggested).toBe(0);
  });

  it('drops SKUs with no modelled demand and no gap', () => {
    const plan = buildOrderPlan({ ...base, sizeMix: { 'N-100': 1 } });
    expect(plan.rows.map((r) => r.itemNumber)).toEqual(['N-100']);
  });

  it('keeps a zero-demand SKU out even when it is held in stock', () => {
    const plan = buildOrderPlan({
      ...base,
      sizeMix: { 'N-100': 1 },
      onHand: { 'L-300': 5 },
    });
    expect(plan.rows.find((r) => r.itemNumber === 'L-300')).toBeUndefined();
  });

  it('sorts by what to order first, then category, then item number', () => {
    const plan = buildOrderPlan(base);
    const suggested = plan.rows.map((r) => r.suggested);
    expect([...suggested].sort((a, b) => b - a)).toEqual(suggested);
  });

  it('totals the suggestions it printed', () => {
    const plan = buildOrderPlan(base);
    expect(plan.totalSuggested).toBe(plan.rows.reduce((s, r) => s + r.suggested, 0));
    expect(plan.totalSuggested).toBe(72 + 24 + 24 + 120);
  });

  it('a zero-case plan asks for nothing rather than dividing by zero', () => {
    const plan = buildOrderPlan({
      ...base,
      assumptions: { ...base.assumptions, casesPerMonth: 0 },
    });
    expect(plan.totalNails).toBe(0);
    expect(plan.rows).toEqual([]);
  });

  it('a zero horizon asks for nothing and does not produce NaN', () => {
    const plan = buildOrderPlan({
      ...base,
      assumptions: { ...base.assumptions, leadTimeMonths: 0, coverMonths: 0 },
    });
    expect(plan.horizonMonths).toBe(0);
    expect(plan.rows).toEqual([]);
  });

  it('clamps a nonsense long-nail share instead of inverting demand', () => {
    const plan = buildOrderPlan({ ...base, longNailShare: 1.4 });
    const by = Object.fromEntries(plan.rows.map((r) => [r.itemNumber, r]));
    expect(by['L-300'].required).toBe(120);
    expect(by['N-100']).toBeUndefined(); // all demand went long
  });

  it('treats negative assumptions as zero', () => {
    const plan = buildOrderPlan({
      ...base,
      assumptions: { ...base.assumptions, leadTimeMonths: -6 },
    });
    expect(plan.horizonMonths).toBe(6);
  });
});
