import { describe, it, expect } from 'vitest';
import {
  holdingsAsOf,
  groupHoldings,
  HOME,
  type HoldingItem,
  type HoldingHistory,
} from './holdings.js';

const D = (s: string) => new Date(s);

const mkItem = (over: Partial<HoldingItem>): HoldingItem => ({
  id: 'i1',
  gtinShort: 'g',
  rawBarcode: 'raw',
  productLabel: 'Product',
  lot: 'L1',
  expDate: null,
  distributorId: null,
  createdAt: D('2026-01-01'),
  usedAt: null,
  deletedAt: null,
  ...over,
});

const placement = (over: Partial<HoldingHistory>): HoldingHistory => ({
  itemId: 'i1',
  toDistributorId: null,
  fromDistributorId: null,
  changedAt: D('2026-01-01'),
  isPlacement: true,
  ...over,
});

describe('holdingsAsOf', () => {
  it('excludes items created after the as-of date', () => {
    const items = [mkItem({ createdAt: D('2026-06-01') })];
    const res = holdingsAsOf(items, [], D('2026-03-01'));
    expect(res).toHaveLength(0);
  });

  it('excludes items used on/before as-of but includes used-after', () => {
    const usedBefore = mkItem({ id: 'a', usedAt: D('2026-02-01') });
    const usedAfter = mkItem({ id: 'b', usedAt: D('2026-04-01') });
    const res = holdingsAsOf([usedBefore, usedAfter], [], D('2026-03-01'));
    expect(res.map((r) => r.item.id)).toEqual(['b']);
  });

  it('includes items deleted after the as-of date', () => {
    const items = [mkItem({ deletedAt: D('2026-04-01') })];
    const res = holdingsAsOf(items, [], D('2026-03-01'));
    expect(res).toHaveLength(1);
  });

  it('falls back to current distributorId when there is no history', () => {
    const items = [mkItem({ distributorId: 'd1' })];
    const res = holdingsAsOf(items, [], D('2026-03-01'));
    expect(res[0].distributorId).toBe('d1');
  });

  it('resolves to the to-distributor of the latest placement at/before as-of', () => {
    const items = [mkItem({ distributorId: 'd2' })];
    const history = [
      placement({ toDistributorId: 'd1', changedAt: D('2026-01-15') }),
      placement({ fromDistributorId: 'd1', toDistributorId: 'd2', changedAt: D('2026-05-01') }),
    ];
    // As of March, the d1->d2 move hasn't happened yet, so it's at d1.
    const res = holdingsAsOf(items, history, D('2026-03-01'));
    expect(res[0].distributorId).toBe('d1');
  });

  it('uses the first move’s from-location when as-of predates all moves', () => {
    const items = [mkItem({ distributorId: 'd2', createdAt: D('2026-01-01') })];
    const history = [
      placement({ fromDistributorId: 'd1', toDistributorId: 'd2', changedAt: D('2026-05-01') }),
    ];
    const res = holdingsAsOf(items, history, D('2026-02-01'));
    expect(res[0].distributorId).toBe('d1');
  });

  it('ignores non-placement (usage/delete) history rows', () => {
    const items = [mkItem({ distributorId: 'd1' })];
    const history = [
      placement({ toDistributorId: 'd1', changedAt: D('2026-01-15') }),
      placement({ fromDistributorId: 'd1', toDistributorId: null, changedAt: D('2026-02-01'), isPlacement: false }),
    ];
    const res = holdingsAsOf(items, history, D('2026-03-01'));
    expect(res[0].distributorId).toBe('d1');
  });
});

describe('groupHoldings', () => {
  it('buckets by location with Home Office first and counts', () => {
    const resolved = [
      { distributorId: null, item: mkItem({ id: 'a' }) },
      { distributorId: 'd1', item: mkItem({ id: 'b' }) },
      { distributorId: 'd1', item: mkItem({ id: 'c' }) },
    ];
    const groups = groupHoldings(resolved, [{ id: 'd1', name: 'Berwyn' }]);
    expect(groups[0].locationId).toBe(HOME);
    expect(groups[0].count).toBe(1);
    const berwyn = groups.find((g) => g.locationId === 'd1')!;
    expect(berwyn.locationName).toBe('Berwyn');
    expect(berwyn.count).toBe(2);
  });
});
