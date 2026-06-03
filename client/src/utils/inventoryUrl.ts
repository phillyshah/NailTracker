import type { InventoryFilters } from '../api/inventory';

/**
 * Single source of truth for serializing the Inventory list's state (page, sort,
 * search, and filters) to/from the URL query string. Keeping it in the URL means
 * navigating into an item and back (or refreshing, or sharing a link) restores
 * the exact page/sort/search the user was on instead of snapping back to page 1.
 */

const DEFAULT_LIMIT = 25;
const DEFAULT_SORT_BY = 'itemNumber';
const DEFAULT_SORT_DIR = 'asc';

/** Serialize filters to URL params, omitting defaults so the URL stays clean. */
export function filtersToSearchParams(f: InventoryFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.search) p.set('search', f.search);
  if (f.distributorId) p.set('distributorId', f.distributorId);
  if (f.gtinShort) p.set('gtinShort', f.gtinShort);
  if (f.expBefore) p.set('expBefore', f.expBefore);
  if (f.unassigned) p.set('unassigned', 'true');
  if (f.expired) p.set('expired', 'true');
  if (f.expiringInDays) p.set('expiringInDays', String(f.expiringInDays));
  if (f.page && f.page > 1) p.set('page', String(f.page));
  if (f.limit && f.limit !== DEFAULT_LIMIT) p.set('limit', String(f.limit));
  if (f.sortBy && f.sortBy !== DEFAULT_SORT_BY) p.set('sortBy', f.sortBy);
  if (f.sortDir && f.sortDir !== DEFAULT_SORT_DIR) p.set('sortDir', f.sortDir);
  return p;
}

/** Rebuild filters from URL params, applying defaults for anything absent. */
export function searchParamsToFilters(p: URLSearchParams): InventoryFilters {
  const pageRaw = parseInt(p.get('page') ?? '', 10);
  const limitRaw = parseInt(p.get('limit') ?? '', 10);
  const expDays = parseInt(p.get('expiringInDays') ?? '', 10);
  return {
    page: pageRaw > 0 ? pageRaw : 1,
    limit: limitRaw > 0 ? limitRaw : DEFAULT_LIMIT,
    sortBy: p.get('sortBy') || DEFAULT_SORT_BY,
    sortDir: p.get('sortDir') === 'desc' ? 'desc' : 'asc',
    search: p.get('search') || undefined,
    distributorId: p.get('distributorId') || undefined,
    gtinShort: p.get('gtinShort') || undefined,
    expBefore: p.get('expBefore') || undefined,
    unassigned: p.get('unassigned') === 'true' || undefined,
    expired: p.get('expired') === 'true' || undefined,
    expiringInDays: expDays > 0 ? expDays : undefined,
  };
}
