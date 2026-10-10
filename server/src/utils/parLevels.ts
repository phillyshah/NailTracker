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
  /** Months of stock to hold. When set it wins over minStock. */
  coverMonths?: number | null;
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
  usagePerMonth: number;
  /** How `par` was arrived at: a fixed quantity, or N months of cover. */
  parBasis: 'qty' | 'cover';
  /** Set when parBasis === 'cover' — the months requested. */
  parCoverMonths?: number;
}

/** The par row that applies, before any cover-months arithmetic. */
function matchingLevel(
  itemNumber: string,
  group: string,
  distributorId: string,
  levels: ParLevelRow[],
): ParLevelRow | null {
  const skuOverride = levels.find(
    (l) => l.scope === 'item' && l.itemNumber === itemNumber && l.distributorId === distributorId,
  );
  if (skuOverride) return skuOverride;

  const skuGlobal = levels.find(
    (l) => l.scope === 'item' && l.itemNumber === itemNumber && l.distributorId === null,
  );
  if (skuGlobal) return skuGlobal;

  const groupGlobal = levels.find(
    (l) => l.scope === 'category' && l.category === group && l.distributorId === null,
  );
  if (groupGlobal) return groupGlobal;

  return null;
}

export interface ResolvedPar {
  par: number;
  basis: 'qty' | 'cover';
  /** Set when basis === 'cover'. */
  coverMonths?: number;
}

/**
 * Effective par for an item at a distributor, resolved most-specific-first:
 * SKU+distributor override → SKU global → group global.
 *
 * A row expressed in **months of cover** is converted here, against that
 * item/distributor's own usage rate: `ceil(usagePerMonth * coverMonths)`. That
 * is the point of storing cover rather than a number — one "12 months" entry on
 * a category gives every SKU at every distributor a par sized to its own demand,
 * and it keeps tracking demand as usage shifts.
 *
 * Returns null when no par applies. A cover-based par with no usage history
 * also returns null: with no demand signal there is nothing to infer, and
 * guessing 0 would silently suppress the item from the reorder report.
 */
export function resolvePar(
  itemNumber: string,
  group: string,
  distributorId: string,
  levels: ParLevelRow[],
  usagePerMonth = 0,
): ResolvedPar | null {
  const level = matchingLevel(itemNumber, group, distributorId, levels);
  if (!level) return null;

  if (level.coverMonths != null && level.coverMonths > 0) {
    if (usagePerMonth <= 0) return null; // no demand signal -> no inferable par
    return {
      par: Math.ceil(usagePerMonth * level.coverMonths),
      basis: 'cover',
      coverMonths: level.coverMonths,
    };
  }

  return { par: level.minStock, basis: 'qty' };
}

/**
 * Effective par as a plain number. Thin wrapper over resolvePar for callers
 * that don't care how it was derived.
 */
export function effectivePar(
  itemNumber: string,
  group: string,
  distributorId: string,
  levels: ParLevelRow[],
  usagePerMonth = 0,
): number | null {
  return resolvePar(itemNumber, group, distributorId, levels, usagePerMonth)?.par ?? null;
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
      const perMonth = usage[key(item.itemNumber, d.id)] ?? 0;
      const resolved = resolvePar(item.itemNumber, item.group, d.id, levels, perMonth);
      if (resolved == null || resolved.par <= 0) continue;
      const par = resolved.par;
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
        usagePerMonth: perMonth,
        parBasis: resolved.basis,
        ...(resolved.coverMonths != null ? { parCoverMonths: resolved.coverMonths } : {}),
      });
    }
  }

  return rows.sort(
    (a, b) =>
      a.distributorName.localeCompare(b.distributorName) ||
      a.itemNumber.localeCompare(b.itemNumber),
  );
}
