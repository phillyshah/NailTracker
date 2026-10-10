import { gtinToRef, gtinMap } from './gtin-map';

/**
 * Product GROUPS for Par Levels. A group par is the default for every SKU it
 * contains; the nail family (Short + Long) is intentionally a single group.
 */
export const PAR_GROUPS = [
  'Proximal Femur Nail',
  'Lag Screw',
  'Interlocking Screw',
  'Cap Screw',
  'Set Screw',
] as const;

export type ParGroup = (typeof PAR_GROUPS)[number] | 'Other';

/** Map an item number (REF code) to its Par Levels group. */
export function parGroupOf(itemNumber: string): ParGroup {
  const s = itemNumber.toUpperCase();
  if (/^SO-SPFN|^SO-LPFN/.test(s)) return 'Proximal Femur Nail';
  if (/^SO-SPFL/.test(s)) return 'Lag Screw';
  if (/^SO-S50I|^SO-IS/.test(s)) return 'Interlocking Screw';
  if (/^SO-SPFC|^SO-EC/.test(s)) return 'Cap Screw';
  if (/^SO-SPFS|^SO-SS/.test(s)) return 'Set Screw';
  return 'Other';
}

export interface CatalogItem {
  itemNumber: string; // REF code
  gtinShort: string;
  label: string;
  group: ParGroup;
}

/** The full product catalog (one entry per item number), derived from the GTIN
 *  maps. Used by the Par Levels editor to list every item you can set a par on. */
export const productCatalog: CatalogItem[] = (() => {
  const byItem = new Map<string, CatalogItem>();
  for (const [gtinShort, itemNumber] of Object.entries(gtinToRef)) {
    if (!byItem.has(itemNumber)) {
      byItem.set(itemNumber, {
        itemNumber,
        gtinShort,
        label: gtinMap[gtinShort] || itemNumber,
        group: parGroupOf(itemNumber),
      });
    }
  }
  return Array.from(byItem.values()).sort((a, b) => a.itemNumber.localeCompare(b.itemNumber));
})();

/** Catalog items grouped by Par Levels group, in PAR_GROUPS order. */
export const catalogByGroup: { group: ParGroup; items: CatalogItem[] }[] = PAR_GROUPS.map(
  (group) => ({ group, items: productCatalog.filter((c) => c.group === group) }),
).filter((g) => g.items.length > 0);
