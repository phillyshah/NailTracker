import { getItemNumber } from './gtin-map.js';

/**
 * One pre-aggregated bucket from the database: a count of live units sharing the
 * same product identity and location. Produced by a Prisma `groupBy` rather than
 * one row per physical unit — the pivot output is SKUs x locations, so grouping
 * in SQL turns an ~80x over-fetch into roughly the size of the answer.
 */
export interface StockGroup {
  gtinShort: string;
  rawBarcode: string;
  productLabel: string | null;
  distributorId: string | null;
  count: number;
}

export interface StockRow {
  gtinShort: string;
  itemNumber: string;
  productLabel: string;
  counts: Record<string, number>;
  total: number;
}

/** Column key for stock held at Home Office (no distributor assigned). */
export const HOME = 'home';

/**
 * Pivot pre-aggregated groups into one row per item number, with a count per
 * location. Pure so it can be unit-tested without a database.
 *
 * `itemNumberFallback` mirrors the two existing callers: the JSON report leaves
 * an unresolvable item number blank, the spreadsheet export falls back to the
 * gtinShort so no cell is empty. Sorting by `itemNumber || gtinShort` is
 * equivalent to sorting by `itemNumber` under the 'gtinShort' fallback, so one
 * comparator serves both.
 */
export function buildStockRows(
  groups: StockGroup[],
  distributorIds: string[],
  itemNumberFallback: 'empty' | 'gtinShort' = 'empty',
): StockRow[] {
  const rowsMap = new Map<string, StockRow>();

  for (const g of groups) {
    let row = rowsMap.get(g.gtinShort);
    if (!row) {
      const resolved = getItemNumber(g.gtinShort, g.rawBarcode);
      row = {
        gtinShort: g.gtinShort,
        itemNumber: resolved || (itemNumberFallback === 'gtinShort' ? g.gtinShort : ''),
        productLabel: g.productLabel || 'Unknown',
        counts: { [HOME]: 0 },
        total: 0,
      };
      for (const id of distributorIds) row.counts[id] = 0;
      rowsMap.set(g.gtinShort, row);
    }
    const key = g.distributorId ?? HOME;
    row.counts[key] = (row.counts[key] ?? 0) + g.count;
    row.total += g.count;
  }

  return Array.from(rowsMap.values()).sort((a, b) =>
    (a.itemNumber || a.gtinShort).localeCompare(b.itemNumber || b.gtinShort),
  );
}
