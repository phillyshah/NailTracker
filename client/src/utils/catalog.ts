import { gtinToRef, gtinMap } from './gtin-map';

export interface CatalogItem {
  itemNumber: string; // REF code
  gtinShort: string;
  label: string;
}

/** The full product catalog (one entry per item number), derived from the GTIN
 *  maps. Used by the Par Levels editor to list every item you can set a par on. */
export const productCatalog: CatalogItem[] = (() => {
  const byItem = new Map<string, CatalogItem>();
  for (const [gtinShort, itemNumber] of Object.entries(gtinToRef)) {
    if (!byItem.has(itemNumber)) {
      byItem.set(itemNumber, { itemNumber, gtinShort, label: gtinMap[gtinShort] || itemNumber });
    }
  }
  return Array.from(byItem.values()).sort((a, b) => a.itemNumber.localeCompare(b.itemNumber));
})();
