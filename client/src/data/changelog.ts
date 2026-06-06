export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.27',
    date: '2026-06-04',
    changes: [
      'Fixed: Transfer (Pick from list) and the bank "add items" picker now show ALL of a distributor\'s items, not just the first 100 — so you can select from the full list even with thousands in stock',
    ],
  },
  {
    version: '3.26',
    date: '2026-06-03',
    changes: [
      'Repair Barcodes (admin) now walks you through damaged items one at a time, showing the old vs. corrected lot and expiry — repair or skip each, like Find & Replace',
      'Includes a "Repair all remaining" shortcut to fix the rest in one tap',
    ],
  },
  {
    version: '3.25',
    date: '2026-06-03',
    changes: [
      'New Transfer mode: Import from Excel — upload a CSV/Excel file of barcodes and move many items between distributors at once',
      'Each barcode is checked against the source distributor first; items not in stock are flagged with one-tap "Add to source & include" or "Skip", plus an "Add all missing" shortcut',
      'Race-safe commit: if an item is moved out of source between preview and confirm, it\'s skipped and reported instead of silently relocated',
    ],
  },
  {
    version: '3.24',
    date: '2026-06-03',
    changes: [
      'Inventory now remembers your place: "Back to Inventory" returns you to the same page, sort, and search instead of jumping back to page 1',
      'Your current Inventory view (page, sort, filters, search) is kept in the address bar, so it survives a refresh and can be bookmarked or shared',
    ],
  },
  {
    version: '3.23',
    date: '2026-06-03',
    changes: [
      'Fixed a serious barcode-import bug: lot numbers containing certain digits (like "…-L170") were cut short and given a wrong/expired date. Scanning and spreadsheet import now read the full lot and correct expiry',
      'Admins: a new Repair Barcodes button (User Management) re-reads existing items’ barcodes and fixes any lot numbers or expiry dates that were imported incorrectly',
      'Fixed search: you can now find items by their item number (REF code) again, e.g. "SO-SPFN-0380-10L-30"',
    ],
  },
];
