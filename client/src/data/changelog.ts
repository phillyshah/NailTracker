export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
