/**
 * Pure reconciliation for Cycle Count. No DB access: given the items physically
 * scanned on a shelf and the units the system thinks are at that distributor,
 * partition into three buckets:
 *  - matched: a scan that found a system unit (same product + lot, FIFO),
 *  - extra:   a scan with no matching system unit (on the shelf, not in system),
 *  - missing: a system unit no scan claimed (in system, not on the shelf).
 *
 * Each scan consumes at most one system unit; two identical stickers claim two
 * distinct units. Among interchangeable units (same product+lot) the FIFO unit
 * (oldest expiry, then oldest createdAt) is matched first — deterministic so
 * results are stable.
 */

export interface ScanInput {
  key: string; // stable id for this scan (e.g. staged index)
  gtinShort: string;
  lot: string;
  itemNumber?: string | null;
  productLabel?: string;
  gtin?: string;
  expDate?: string | null;
  udi?: string;
  rawBarcode?: string;
}

export interface StockUnit {
  id: string;
  gtinShort: string;
  lot: string;
  itemNumber?: string | null;
  productLabel?: string | null;
  expDate?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface MatchedRow {
  scanKey: string;
  itemId: string;
  itemNumber: string | null;
  productLabel: string;
  lot: string;
  expDate: string | null;
}

export interface ExtraRow {
  scanKey: string;
  gtinShort: string;
  lot: string;
  itemNumber: string | null;
  productLabel: string;
  gtin: string | null;
  expDate: string | null;
  udi: string | null;
  rawBarcode: string | null;
}

export interface MissingRow {
  itemId: string;
  gtinShort: string;
  lot: string;
  itemNumber: string | null;
  productLabel: string;
  expDate: string | null;
}

export interface ReconcileResult {
  matched: MatchedRow[];
  extra: ExtraRow[];
  missing: MissingRow[];
}

const time = (d: Date | string | null | undefined): number => {
  if (!d) return Number.POSITIVE_INFINITY;
  const t = new Date(d).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

const iso = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const groupKey = (gtinShort: string, lot: string) => `${gtinShort}|${lot}`;

export function reconcile(scans: ScanInput[], stock: StockUnit[]): ReconcileResult {
  // Index stock by product+lot, each group sorted FIFO so the first popped is
  // the one that should leave the shelf first.
  const groups = new Map<string, StockUnit[]>();
  for (const unit of stock) {
    const k = groupKey(unit.gtinShort, unit.lot);
    const arr = groups.get(k);
    if (arr) arr.push(unit);
    else groups.set(k, [unit]);
  }
  for (const arr of groups.values()) {
    arr.sort((a, b) => time(a.expDate) - time(b.expDate) || time(a.createdAt) - time(b.createdAt) || a.id.localeCompare(b.id));
  }

  const claimed = new Set<string>();
  const matched: MatchedRow[] = [];
  const extra: ExtraRow[] = [];

  for (const scan of scans) {
    const arr = groups.get(groupKey(scan.gtinShort, scan.lot));
    const unit = arr?.find((u) => !claimed.has(u.id));
    if (unit) {
      claimed.add(unit.id);
      matched.push({
        scanKey: scan.key,
        itemId: unit.id,
        itemNumber: unit.itemNumber ?? scan.itemNumber ?? null,
        productLabel: unit.productLabel || scan.productLabel || 'Unknown',
        lot: unit.lot,
        expDate: iso(unit.expDate),
      });
    } else {
      extra.push({
        scanKey: scan.key,
        gtinShort: scan.gtinShort,
        lot: scan.lot,
        itemNumber: scan.itemNumber ?? null,
        productLabel: scan.productLabel || 'Unknown',
        gtin: scan.gtin ?? null,
        expDate: scan.expDate ?? null,
        udi: scan.udi ?? null,
        rawBarcode: scan.rawBarcode ?? null,
      });
    }
  }

  const missing: MissingRow[] = [];
  for (const unit of stock) {
    if (claimed.has(unit.id)) continue;
    missing.push({
      itemId: unit.id,
      gtinShort: unit.gtinShort,
      lot: unit.lot,
      itemNumber: unit.itemNumber ?? null,
      productLabel: unit.productLabel || 'Unknown',
      expDate: iso(unit.expDate),
    });
  }

  return { matched, extra, missing };
}
