import { describe, it, expect } from 'vitest';
import { usageRates, ratesPerMonth, type UsageObservation } from './usageRate.js';

const NOW = new Date('2026-10-10T00:00:00Z');
const monthsAgo = (n: number) => new Date(NOW.getTime() - n * 2_629_800_000);

const obs = (key: string, ...ago: number[]): UsageObservation[] =>
  ago.map((n) => ({ key, usedAt: monthsAgo(n) }));

describe('usageRates', () => {
  it('divides by months actually observed, not the nominal window', () => {
    // 6 units, all within the last month, against a 3-month window.
    // The old `units / windowMonths` form would report 2/mo.
    const r = usageRates(obs('a', 0.9, 0.8, 0.7, 0.6, 0.5, 0.4), 3, NOW);
    expect(r.a.perMonth).toBe(6);
    expect(r.a.observedMonths).toBe(1);
  });

  it('reports a genuinely slow item as slow', () => {
    // One unit, three months ago, nothing since. Observed for the full window.
    const r = usageRates(obs('a', 3), 3, NOW);
    expect(r.a.observedMonths).toBe(3);
    expect(r.a.perMonth).toBeCloseTo(0.33, 2);
  });

  it('caps observed months at the window', () => {
    // First use a year ago, but we only queried a 3-month window.
    const r = usageRates(obs('a', 12, 1), 3, NOW);
    expect(r.a.observedMonths).toBe(3);
  });

  it('floors observed months at 1 so a busy fortnight is not extrapolated', () => {
    // 4 units in half a month would be 8/mo if we annualised the partial month.
    const r = usageRates(obs('a', 0.5, 0.4, 0.3, 0.2), 3, NOW);
    expect(r.a.observedMonths).toBe(1);
    expect(r.a.perMonth).toBe(4);
  });

  it('carries the evidence count so a rate is never shown bare', () => {
    const r = usageRates(obs('a', 2, 1), 3, NOW);
    expect(r.a.units).toBe(2);
  });

  it('keys are independent — a ramping item does not affect a steady one', () => {
    const r = usageRates([...obs('new', 0.5, 0.4), ...obs('old', 3, 2, 1)], 3, NOW);
    expect(r.new.perMonth).toBe(2); // 2 units, 1 month observed
    expect(r.old.perMonth).toBe(1); // 3 units, 3 months observed
  });

  it('returns nothing for no observations', () => {
    expect(usageRates([], 3, NOW)).toEqual({});
  });

  it('ratesPerMonth is the bare-number form', () => {
    expect(ratesPerMonth(obs('a', 0.5, 0.4), 3, NOW)).toEqual({ a: 2 });
  });

  it('the old nominal-window form would have understated a ramp 3x', () => {
    // Documents the bug this helper exists to fix, so a future refactor that
    // reintroduces `units / windowMonths` fails here.
    const rows = obs('a', 0.9, 0.8, 0.7, 0.6, 0.5, 0.4);
    const nominal = rows.length / 3;
    expect(usageRates(rows, 3, NOW).a.perMonth).toBe(nominal * 3);
  });
});
