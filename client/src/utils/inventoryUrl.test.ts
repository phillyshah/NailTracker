import { describe, it, expect } from 'vitest';
import { filtersToSearchParams, searchParamsToFilters } from './inventoryUrl';
import type { InventoryFilters } from '../api/inventory';

/**
 * The Inventory list keeps its state in the URL so "Back to Inventory" returns
 * the user to the same page/sort/search. These guard that round-trip.
 */
describe('inventoryUrl', () => {
  it('persists page, sort, search, and filters in the query string', () => {
    const f: InventoryFilters = {
      page: 42,
      limit: 25,
      sortBy: 'expDate',
      sortDir: 'desc',
      search: 'SO-SPFN-0380-10L-30',
      distributorId: 'd1',
    };
    const p = filtersToSearchParams(f);
    expect(p.get('page')).toBe('42');
    expect(p.get('sortBy')).toBe('expDate');
    expect(p.get('sortDir')).toBe('desc');
    expect(p.get('search')).toBe('SO-SPFN-0380-10L-30');
    expect(p.get('distributorId')).toBe('d1');
  });

  it('omits defaults to keep the URL clean (page 1, default sort, limit 25)', () => {
    const p = filtersToSearchParams({ page: 1, limit: 25, sortBy: 'itemNumber', sortDir: 'asc' });
    expect(p.toString()).toBe('');
  });

  it('round-trips back to the same filters', () => {
    const f: InventoryFilters = {
      page: 7,
      limit: 25,
      sortBy: 'lot',
      sortDir: 'desc',
      search: 'femur',
      distributorId: 'dist-9',
      expired: true,
      expiringInDays: 90,
    };
    const restored = searchParamsToFilters(filtersToSearchParams(f));
    expect(restored).toMatchObject(f);
  });

  it('defaults page to 1 and sort to itemNumber/asc when the URL is empty', () => {
    const f = searchParamsToFilters(new URLSearchParams(''));
    expect(f.page).toBe(1);
    expect(f.limit).toBe(25);
    expect(f.sortBy).toBe('itemNumber');
    expect(f.sortDir).toBe('asc');
    expect(f.search).toBeUndefined();
  });

  it('restores a deep page from the URL (the reported regression)', () => {
    const f = searchParamsToFilters(new URLSearchParams('page=63&sortBy=expDate&sortDir=desc'));
    expect(f.page).toBe(63);
    expect(f.sortBy).toBe('expDate');
    expect(f.sortDir).toBe('desc');
  });
});
