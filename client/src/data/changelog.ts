export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.29',
    date: '2026-06-07',
    changes: [
      'Quick-search is now everywhere you pick items: Transfer "Pick from list", the Manual Transfer staged list, and the Bank "Add Items" picker all have the same search box — type an item number, lot, or product to narrow a long list instantly',
      'Distributor detail pages now have a search box too, so you can find an item within a site without paging through everything',
      'Added the dismissible help banner to the Bank, Distributor detail, and Distributors pages for consistent guidance',
    ],
  },
  {
    version: '3.28',
    date: '2026-06-06',
    changes: [
      'Transfer now works like Receive: a new "Manual Transfer" tab lets you scan items one at a time, snap or upload photos, paste a barcode, or type the item number/lot/expiry — great for quick transfers of a few parts',
      'The Transfer page now has three tabs: Pick from list, Manual Transfer, and Import from Excel (all the original options are still here, just clearer)',
      'Each item is checked against the source site as you add it; anything not in stock there is flagged with one-tap "Add to source" or "Skip" (plus an "Add all missing" shortcut)',
      'Everything you add moves together as a single, race-safe transfer record',
    ],
  },
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
];
