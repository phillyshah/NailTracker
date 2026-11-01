/**
 * Pure, React-free text matching for the app's quick-search boxes. Used to
 * filter in-browser item lists (Transfer pick-list, Manual Transfer staged list,
 * the Bank "Add Items" picker) instantly without a server round-trip. Kept
 * separate from the components so the matching rules can be unit-tested.
 */

/** True if the (trimmed, lower-cased) query is a substring of ANY field. An
 *  empty/whitespace query matches everything. Null/undefined fields are safe. */
export function textMatch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(q));
}

/** The subset of fields a user expects to search items by. */
export interface SearchableItem {
  itemNumber?: string | null;
  lot?: string | null;
  productLabel?: string | null;
  udi?: string | null;
  gtinShort?: string | null;
}

/** Match an item against a search box — item number (REF), lot, product, UDI,
 *  or GTIN short. Mirrors the fields the server `search` param covers. */
export function matchesItemSearch(item: SearchableItem, query: string): boolean {
  return textMatch(
    query,
    item.itemNumber,
    item.lot,
    item.productLabel,
    item.udi,
    item.gtinShort,
  );
}
