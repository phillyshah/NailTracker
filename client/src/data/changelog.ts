export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.12',
    date: '2026-05-13',
    changes: [
      'Fixed Transfer History detail pages showing blank when clicked',
      'Added error messaging to diagnose transfer lookup failures',
    ],
  },
  {
    version: '3.11',
    date: '2026-05-13',
    changes: [
      'Fixed: scanning multiple physical units that share the same lot number no longer flags them as duplicates — each scan is its own inventory unit',
      'Batch upload now ingests every row, even when many barcodes share the same GTIN + Lot',
      'Inventory detail / edit / reassign now use a stable internal item ID so items with the same UDI are individually addressable',
    ],
  },
  {
    version: '3.10',
    date: '2026-05-13',
    changes: [
      'New Stock by Item Number report — see how many of each item you have at Home Office and at every distributor in one matrix, with a Total column',
      'Stock matrix is sortable, searchable, and every count is clickable to drill into the matching inventory',
      'Stock matrix has its own Excel download',
      'Fixed Excel exports coming back empty — filters were being sent incorrectly',
      'Inventory page now defaults to sorting by Item Number, and every column header is sortable (Item Number → Description → Lot → Expiry → Distributor)',
    ],
  },
  {
    version: '3.9',
    date: '2026-05-13',
    changes: [
      'Downloads are now Excel (.xlsx) — bold header row, frozen first row, expired dates highlighted in red',
      'Every list/table is now sortable — tap a column header to sort, tap again to reverse',
      'UDI replaced with Item Number (REF) everywhere it was shown',
    ],
  },
  {
    version: '3.8',
    date: '2026-05-13',
    changes: [
      'Reports cards are now clickable — tap to drill into the filtered list of items',
      'Inventory page shows a filter chip when arriving from a Reports card, with a Clear button to reset',
    ],
  },
  {
    version: '3.7',
    date: '2026-05-13',
    changes: [
      'Reassigning an item from the detail page now also creates a Transfer record — visible in Reports → Transfer History',
    ],
  },
  {
    version: '3.6',
    date: '2026-05-13',
    changes: [
      'When editing an item creates a duplicate of an existing one, you’re now prompted to merge — delete the duplicate and keep the original',
      'Merges are tracked in both items’ history',
    ],
  },
  {
    version: '3.5',
    date: '2026-05-13',
    changes: [
      'Press ESC to close the full-screen barcode image and modal dialogs',
    ],
  },
  {
    version: '3.4',
    date: '2026-05-13',
    changes: [
      'New Edit button on inventory detail page — fix GTIN, REF, Lot, Expiry, or Product Label',
      'Entering a known Item Number (REF) auto-resolves the correct GTIN and product description',
      'Every edit is recorded in the item history with what changed and who did it',
    ],
  },
  {
    version: '3.3',
    date: '2026-05-13',
    changes: [
      'Inventory detail page now shows the Item Number (REF code) for every item',
      'Item Number is now the master — if the REF on a label disagrees with the GTIN, the REF wins',
      'Self-healing for items where the GTIN was misread but the REF was captured correctly',
    ],
  },
  {
    version: '3.2',
    date: '2026-05-13',
    changes: [
      'Complete product database — all 105 Summa Orthopedics items now recognized',
      'Fixed wrong angle on existing nails (was 126°, now correct 125°)',
      'Fixed Set Screw label (was incorrectly "Short Proximal Femoral System")',
      'Added Long Nails, Interlocking Screws, Cap Screws, and all Lag Screw sizes',
      'Items previously showing "Unknown" will now display correct product names',
    ],
  },
  {
    version: '3.1',
    date: '2026-05-13',
    changes: [
      'Fixed expiry dates not being captured from some barcode scans',
      'Added Short Proximal Femoral System (SO-SPFS) product category',
      'Added YYYY-MM-DD hourglass date format detection from labels',
      'Added User Guide (available from the Help link in header)',
    ],
  },
  {
    version: '3.0',
    date: '2026-05-01',
    changes: [
      'Added Inventory Banks — group items and move them as a unit',
      'Expiry badges now only show when within 6 months',
      'Bank assignment option when receiving items',
      'Bank items restricted to same distributor as bank',
      'Auto-categorization from REF codes (SO-SPFN, SO-LPFN, etc.)',
    ],
  },
  {
    version: '2.6',
    date: '2026-04-15',
    changes: [
      'PWA support — install as app on iPhone and Android',
      'Wider desktop layouts',
      'iOS standalone mode (no Safari browser bar)',
    ],
  },
  {
    version: '2.5',
    date: '2026-04-01',
    changes: [
      'Multi-barcode detection — up to 4 barcodes per photo',
      'CSV / Excel batch upload',
      'App renamed to Nail Tracker',
    ],
  },
  {
    version: '2.0',
    date: '2026-03-15',
    changes: [
      'Transfer system with auto-generated IDs (TRF-YYYYMMDD-NNNN)',
      'Transfer detail view and print reports',
      'Help banners on each page',
      'Case-insensitive login, password visibility toggle',
      'Deleted items can be re-added by scanning again',
      'Fixed inventory count mismatches across reports',
    ],
  },
];
