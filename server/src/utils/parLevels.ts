/**
 * Pure helpers for the Par Levels / Reorder report. No DB access — they take
 * already-resolved par rows + current stock and compute what's below par.
 *
 * Par levels resolve from most specific to least specific:
 *   1. an item (SKU) par for that distributor   — per-distributor override
 *   2. an item (SKU) par with no distributor     — that SKU's global default
 *   3. a group (category) par                     — applies to every SKU in the
 *                                                   group (e.g. "Interlocking
 *                                                   Screw"), as a global default
 * A group par is always global; per-distributor tuning is done at the SKU level.
 * Par levels apply to distributors only (Home Office is the warehouse you
 * replenish from, not a site that runs "low").
 */

export interface ParLevelRow {
  scope: 'item' | 'category';
  itemNumber: string | null; // set when scope === 'item'
  category: string | null; // group name, set when scope === 'category'
  gtinShort: string | null;
  distributorId: string | null; // null = global default
  minStock: number;
}

export interface ReorderItem {
  itemNumber: string;
  gtinShort: string;
  productLabel: string;
  group: string;
}

export interface ReorderRow {
  itemNumber: string;
  gtinShort: string;
  productLabel: string;
  distributorId: string;
  distributorName: string;
  current: number;
  par: number;
  shortage: number;
  usagePerMonth: number; // context only — not part of the suggested qty
}

/**
 * Effective par for an item at a specific distributor. Checks, in order:
 * SKU+distributor override → SKU global → group global. Returns null if the
 * item has no par at any level.
 */
export function effectivePar(
  itemNumber: string,
  group: string,
  distributorId: string,
  levels: ParLevelRow[],
): number | null {
  const skuOverride = levels.find(
    (l) => l.scope === 'item' && l.itemNumber === itemNumber && l.distributorId === distributorId,
  );
  if (skuOverride) return skuOverride.minStock;

  const skuGlobal = levels.find(
    (l) => l.scope === 'item' && l.itemNumber === itemNumber && l.distributorId === null,
  );
  if (skuGlobal) return skuGlobal.minStock;

  const groupGlobal = levels.find(
    (l) => l.scope === 'category' && l.category === group && l.distributorId === null,
  );
  if (groupGlobal) return groupGlobal.minStock;

  return null;
}

const key = (itemNumber: string, distributorId: string) => `${itemNumber}|${distributorId}`;

/**
 * Build the reorder rows: for every catalog item, check each distributor and
 * emit a row wherever current stock is below the effective par (resolved from
 * SKU or group level). `shortage`/`suggestedOrder` is par − current.
 */
export function buildReorderRows(params: {
  distributors: { id: string; name: string }[];
  levels: ParLevelRow[];
  current: Record<string, number>; // key(itemNumber, distributorId) -> units on hand
  items: ReorderItem[]; // the catalog — every SKU a par can apply to
  usage?: Record<string, number>; // key(itemNumber, distributorId) -> units/month
}): ReorderRow[] {
  const { distributors, levels, current, items, usage = {} } = params;
  const rows: ReorderRow[] = [];

  for (const item of items) {
    for (const d of distributors) {
      const par = effectivePar(item.itemNumber, item.group, d.id, levels);
      if (par == null || par <= 0) continue;
      const onHand = current[key(item.itemNumber, d.id)] ?? 0;
      if (onHand >= par) continue;
      rows.push({
        itemNumber: item.itemNumber,
        gtinShort: item.gtinShort,
        productLabel: item.productLabel,
        distributorId: d.id,
        distributorName: d.name,
        current: onHand,
        par,
        shortage: par - onHand,
        usagePerMonth: usage[key(item.itemNumber, d.id)] ?? 0,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      a.distributorName.localeCompare(b.distributorName) ||
      a.itemNumber.localeCompare(b.itemNumber),
  );
}
