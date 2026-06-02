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
