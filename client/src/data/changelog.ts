export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.13',
    date: '2026-05-14',
    changes: [
      'Stock by Item Number: clicking an item number drills into that item\'s inventory across all locations',
      'Stock by Item Number: clicking a count at a specific location shows only that item at that location',
      'Stock by Item Number: total column is now clickable too',
      'Inventory filter chip shows both item and location when drilling down from Stock report',
      'New bell icon in the header shows expiry alerts — items expiring within 90 days appear instantly without visiting Reports',
      'Dismiss alerts individually or all at once — dismissed state is remembered across sessions',
      'New Live Scan button on the Receive page — point your camera at a barcode and it\'s detected automatically without taking a photo',
    ],
  },
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
];
