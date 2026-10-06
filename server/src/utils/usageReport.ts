import { getProductCategory, getItemNumber, getProductLabel, PRODUCT_CATEGORIES } from './gtin-map.js';

/**
 * Pure aggregation helpers for the usage analytics reports. No DB access — these
 * take already-fetched "used" inventory rows and pivot them. All date bucketing
 * uses UTC components so results are identical in every timezone.
 */

export interface UsedRow {
  gtinShort: string;
  rawBarcode: string;
  distributorId: string | null;
  usedAt: Date;
}

export interface NamedColumn {
  id: string;
  name: string;
}

const UNASSIGNED = 'unassigned';

/** UTC 'YYYY-MM' key for a date. */
export function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Ascending list of the last n month keys, ending with the current month. */
export function lastNMonths(n: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  for (let i = n - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(Date.UTC(y, m - i, 1))));
  }
  return keys;
}

/** UTC midnight of the first day of the earliest month in an n-month window. */
export function windowStart(n: number, now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1), 1));
}

/**
 * UTC [start, end) bounds for a calendar year.
 *
 * Half-open like monthBounds, so a unit used at 2026-12-31T23:59:59Z falls in
 * 2026 and one used at 2027-01-01T00:00:00Z falls in 2027 — no overlap, no gap.
 * usedAt is stored UTC-canonical, so the year boundary must be UTC too.
 */
export function yearBounds(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
  };
}

/** UTC [start, end) bounds for a 'YYYY-MM' month key. */
export function monthBounds(key: string): { start: Date; end: Date } {
  const [y, m] = key.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 1)),
  };
}

/** Usage trends: units consumed per category per month. */
export function buildTrends(rows: UsedRow[], months: string[]) {
  const monthSet = new Set(months);
  const byCategory = new Map<string, Record<string, number>>();
  const totalsByMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  let total = 0;

  for (const r of rows) {
    const mk = monthKey(r.usedAt);
    if (!monthSet.has(mk)) continue;
    const cat = getProductCategory(r.gtinShort, r.rawBarcode);
    let row = byCategory.get(cat);
    if (!row) {
      row = Object.fromEntries(months.map((m) => [m, 0]));
      byCategory.set(cat, row);
    }
    row[mk] += 1;
    totalsByMonth[mk] += 1;
    total += 1;
  }

  // Stable category order (catalog order), only categories that have data.
  const series = (PRODUCT_CATEGORIES as readonly string[])
    .filter((c) => byCategory.has(c))
    .map((category) => {
      const byMonth = byCategory.get(category)!;
      const catTotal = months.reduce((s, m) => s + byMonth[m], 0);
      return { category, byMonth, total: catTotal };
    });

  return { months, categories: series.map((s) => s.category), series, totalsByMonth, total };
}

/** Usage matrix: category (rows) × distributor (columns), units consumed in the window. */
export function buildMatrix(rows: UsedRow[], distributors: NamedColumn[]) {
  const columns: NamedColumn[] = [...distributors];
  const byCategory = new Map<string, Record<string, number>>();
  const totalsByColumn: Record<string, number> = {};
  let grandTotal = 0;
  let sawUnassigned = false;

  const blank = () => {
    const o: Record<string, number> = {};
    for (const c of distributors) o[c.id] = 0;
    o[UNASSIGNED] = 0;
    return o;
  };

  for (const r of rows) {
    const cat = getProductCategory(r.gtinShort, r.rawBarcode);
    let row = byCategory.get(cat);
    if (!row) {
      row = blank();
      byCategory.set(cat, row);
    }
    const col = r.distributorId ?? UNASSIGNED;
    if (col === UNASSIGNED) sawUnassigned = true;
    row[col] = (row[col] ?? 0) + 1;
    totalsByColumn[col] = (totalsByColumn[col] ?? 0) + 1;
    grandTotal += 1;
  }

  if (sawUnassigned) columns.push({ id: UNASSIGNED, name: 'Unassigned' });

  const outRows = (PRODUCT_CATEGORIES as readonly string[])
    .filter((c) => byCategory.has(c))
    .map((category) => {
      const counts = byCategory.get(category)!;
      const total = columns.reduce((s, c) => s + (counts[c.id] ?? 0), 0);
      return { category, counts, total };
    });

  return { columns, rows: outRows, totalsByColumn, grandTotal };
}

/**
 * Usage by item: item number (rows) x distributor (columns), units consumed in
 * the period. Structurally the same pivot as buildMatrix, but keyed on the
 * individual SKU rather than the product category — the `total` on each row is
 * the company-wide figure for that item, and the columns break it down by who
 * used it.
 *
 * Rows are grouped by gtinShort (the stable catalogue identity) and labelled
 * with the item number, matching buildStockRows in stockReport.ts. The two are
 * 1:1 in this catalogue, so a row is effectively one item number; if that ever
 * stops holding it surfaces as two rows rather than silently merging two
 * different products.
 */
export function buildItemMatrix(rows: UsedRow[], distributors: NamedColumn[]) {
  const columns: NamedColumn[] = [...distributors];

  interface ItemAgg {
    gtinShort: string;
    itemNumber: string;
    productLabel: string;
    counts: Record<string, number>;
  }
  const byItem = new Map<string, ItemAgg>();
  const totalsByColumn: Record<string, number> = {};
  let grandTotal = 0;
  let sawUnassigned = false;

  const blank = () => {
    const o: Record<string, number> = {};
    for (const c of distributors) o[c.id] = 0;
    o[UNASSIGNED] = 0;
    return o;
  };

  for (const r of rows) {
    let item = byItem.get(r.gtinShort);
    if (!item) {
      item = {
        gtinShort: r.gtinShort,
        // Fall back to the gtinShort so a row is never unlabelled.
        itemNumber: getItemNumber(r.gtinShort, r.rawBarcode) || r.gtinShort,
        productLabel: getProductLabel(r.gtinShort, r.rawBarcode) || 'Unknown',
        counts: blank(),
      };
      byItem.set(r.gtinShort, item);
    }
    const col = r.distributorId ?? UNASSIGNED;
    if (col === UNASSIGNED) sawUnassigned = true;
    item.counts[col] = (item.counts[col] ?? 0) + 1;
    totalsByColumn[col] = (totalsByColumn[col] ?? 0) + 1;
    grandTotal += 1;
  }

  if (sawUnassigned) columns.push({ id: UNASSIGNED, name: 'Unassigned' });

  const outRows = Array.from(byItem.values())
    .map((it) => ({
      gtinShort: it.gtinShort,
      itemNumber: it.itemNumber,
      productLabel: it.productLabel,
      counts: it.counts,
      total: columns.reduce((sum, c) => sum + (it.counts[c.id] ?? 0), 0),
    }))
    .sort((a, b) => a.itemNumber.localeCompare(b.itemNumber));

  return { columns, rows: outRows, totalsByColumn, grandTotal };
}

/** Monthly statement: itemized usage (one row per product), grouped by distributor. */
export function buildMonthlyUsage(rows: UsedRow[], distributors: NamedColumn[]) {
  const nameById = new Map(distributors.map((d) => [d.id, d.name]));

  // distributorId|UNASSIGNED -> (gtinShort -> aggregated item)
  const groups = new Map<string, Map<string, { gtinShort: string; itemNumber: string | null; productLabel: string; category: string; qty: number }>>();

  for (const r of rows) {
    const gid = r.distributorId ?? UNASSIGNED;
    let items = groups.get(gid);
    if (!items) {
      items = new Map();
      groups.set(gid, items);
    }
    let item = items.get(r.gtinShort);
    if (!item) {
      item = {
        gtinShort: r.gtinShort,
        itemNumber: getItemNumber(r.gtinShort, r.rawBarcode),
        productLabel: getProductLabel(r.gtinShort, r.rawBarcode),
        category: getProductCategory(r.gtinShort, r.rawBarcode),
        qty: 0,
      };
      items.set(r.gtinShort, item);
    }
    item.qty += 1;
  }

  let grandTotal = 0;
  const outGroups = [...groups.entries()]
    .map(([gid, items]) => {
      const list = [...items.values()].sort((a, b) =>
        (a.itemNumber || a.gtinShort).localeCompare(b.itemNumber || b.gtinShort),
      );
      const subtotal = list.reduce((s, i) => s + i.qty, 0);
      grandTotal += subtotal;
      return {
        distributorId: gid === UNASSIGNED ? null : gid,
        distributorName: gid === UNASSIGNED ? 'Unassigned' : nameById.get(gid) ?? 'Unknown',
        items: list,
        subtotal,
      };
    })
    .sort((a, b) => a.distributorName.localeCompare(b.distributorName));

  return { groups: outGroups, grandTotal };
}
