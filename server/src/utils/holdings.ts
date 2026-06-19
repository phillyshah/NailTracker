/**
 * Pure helpers for the "who has what" report. No DB access — they take
 * already-fetched inventory rows (and, for point-in-time, the assignment
 * history) and resolve where each unit was held.
 *
 * Point-in-time caveat: AssignmentHistory is NOT a complete ledger. Items first
 * received to Home Office (distributorId null) get no history row, and a direct
 * delete writes none either. So `holdingsAsOf` resolves an item's location at a
 * past date from history when it can, and otherwise falls back to the item's
 * current distributorId — which is correct for items that never moved.
 */

export const HOME = 'home';

export interface HoldingItem {
  id: string;
  gtinShort: string;
  rawBarcode: string;
  productLabel: string | null;
  lot: string;
  expDate: Date | null;
  distributorId: string | null;
  createdAt: Date;
  usedAt: Date | null;
  deletedAt: Date | null;
}

export interface HoldingHistory {
  itemId: string;
  toDistributorId: string | null;
  fromDistributorId: string | null;
  changedAt: Date;
  /** True for rows that record a placement (assign / reassign / edit). Usage and
   *  delete rows carry only `from` and must not be read as a move to null. */
  isPlacement: boolean;
}

export interface NamedColumn {
  id: string;
  name: string;
}

export interface ResolvedHolding {
  distributorId: string | null;
  item: HoldingItem;
}

/**
 * For each item that existed at `asOf` (created on/before, and not yet used or
 * deleted as of that instant), determine which distributor held it then.
 */
export function holdingsAsOf(
  items: HoldingItem[],
  history: HoldingHistory[],
  asOf: Date,
): ResolvedHolding[] {
  // Group placement history per item, ascending by changedAt.
  const byItem = new Map<string, HoldingHistory[]>();
  for (const h of history) {
    if (!h.isPlacement) continue;
    const list = byItem.get(h.itemId);
    if (list) list.push(h);
    else byItem.set(h.itemId, [h]);
  }
  for (const list of byItem.values()) {
    list.sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
  }

  const out: ResolvedHolding[] = [];
  for (const item of items) {
    // Must have existed and still be live at asOf.
    if (item.createdAt.getTime() > asOf.getTime()) continue;
    if (item.usedAt && item.usedAt.getTime() <= asOf.getTime()) continue;
    if (item.deletedAt && item.deletedAt.getTime() <= asOf.getTime()) continue;

    out.push({ distributorId: distributorAt(item, byItem.get(item.id), asOf), item });
  }
  return out;
}

function distributorAt(
  item: HoldingItem,
  placements: HoldingHistory[] | undefined,
  asOf: Date,
): string | null {
  if (!placements || placements.length === 0) {
    // No recorded moves — it's wherever it currently is.
    return item.distributorId;
  }
  // Latest placement at or before asOf wins.
  let resolved: HoldingHistory | null = null;
  for (const p of placements) {
    if (p.changedAt.getTime() <= asOf.getTime()) resolved = p;
    else break;
  }
  if (resolved) return resolved.toDistributorId;
  // asOf predates the first recorded move — it was wherever that move came from.
  return placements[0].fromDistributorId;
}

/** Bucket resolved holdings by location, naming the Home Office / distributors. */
export function groupHoldings(resolved: ResolvedHolding[], distributors: NamedColumn[]) {
  const nameById = new Map(distributors.map((d) => [d.id, d.name]));
  const buckets = new Map<string, { locationId: string; locationName: string; items: HoldingItem[] }>();

  for (const r of resolved) {
    const id = r.distributorId ?? HOME;
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = {
        locationId: id,
        locationName: id === HOME ? 'Home Office' : nameById.get(id) ?? 'Unknown',
        items: [],
      };
      buckets.set(id, bucket);
    }
    bucket.items.push(r.item);
  }

  return [...buckets.values()]
    .map((b) => ({ ...b, count: b.items.length }))
    .sort((a, b) => {
      if (a.locationId === HOME) return -1;
      if (b.locationId === HOME) return 1;
      return a.locationName.localeCompare(b.locationName);
    });
}
