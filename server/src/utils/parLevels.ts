/**
 * Pure helpers for the Par Levels / Reorder report. No DB access — they take
 * already-resolved par rows + current stock and compute what's below par.
 *
 * Par scope: a par row with `distributorId === null` is the GLOBAL default for
 * an item; a row with a real `distributorId` is a per-distributor OVERRIDE that
 * beats the global. Par levels apply to distributors only (Home Office is the
 * warehouse you replenish from, not a site that runs "low").
 */

export interface ParLevelRow {
  itemNumber: string;
  gtinShort: string;
  distributorId: string | null; // null = global default
  minStock: number;
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

/** Effective par for an item at a specific distributor: override beats global. */
export function effectivePar(
  itemNumber: string,
  distributorId: string,
  levels: ParLevelRow[],
): number | null {
  const override = levels.find(
    (l) => l.itemNumber === itemNumber && l.distributorId === distributorId,
  );
  if (override) return override.minStock;
  const global = levels.find((l) => l.itemNumber === itemNumber && l.distributorId === null);
  return global ? global.minStock : null;
}

const key = (itemNumber: string, distributorId: string) => `${itemNumber}|${distributorId}`;

/**
 * Build the reorder rows: for every item that has a par defined, check each
 * distributor and emit a row wherever current stock is below the effective par.
 * `suggestedOrder` equals the shortage (par − current).
 */
export function buildReorderRows(params: {
  distributors: { id: string; name: string }[];
  levels: ParLevelRow[];
  current: Record<string, number>; // key(itemNumber, distributorId) -> units on hand
  labels: Record<string, { gtinShort: string; productLabel: string }>; // itemNumber -> meta
  usage?: Record<string, number>; // key(itemNumber, distributorId) -> units/month
}): ReorderRow[] {
  const { distributors, levels, current, labels, usage = {} } = params;

  // Only items that have some par defined can be "below par".
  const itemNumbers = Array.from(new Set(levels.map((l) => l.itemNumber)));
  const rows: ReorderRow[] = [];

  for (const itemNumber of itemNumbers) {
    const meta = labels[itemNumber] ?? {
      gtinShort: levels.find((l) => l.itemNumber === itemNumber)?.gtinShort ?? '',
      productLabel: 'Unknown',
    };
    for (const d of distributors) {
      const par = effectivePar(itemNumber, d.id, levels);
      if (par == null || par <= 0) continue;
      const onHand = current[key(itemNumber, d.id)] ?? 0;
      if (onHand >= par) continue;
      rows.push({
        itemNumber,
        gtinShort: meta.gtinShort,
        productLabel: meta.productLabel,
        distributorId: d.id,
        distributorName: d.name,
        current: onHand,
        par,
        shortage: par - onHand,
        usagePerMonth: usage[key(itemNumber, d.id)] ?? 0,
      });
    }
  }

  return rows.sort(
    (a, b) =>
      a.distributorName.localeCompare(b.distributorName) ||
      a.itemNumber.localeCompare(b.itemNumber),
  );
}
