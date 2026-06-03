export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.23',
    date: '2026-06-03',
    changes: [
      'Fixed a serious barcode-import bug: lot numbers containing certain digits (like "…-L170") were cut short and given a wrong/expired date. Scanning and spreadsheet import now read the full lot and correct expiry',
      'Admins: a new Repair Barcodes button (User Management) re-reads existing items’ barcodes and fixes any lot numbers or expiry dates that were imported incorrectly',
      'Fixed search: you can now find items by their item number (REF code) again, e.g. "SO-SPFN-0380-10L-30"',
    ],
  },
  {
    version: '3.22',
    date: '2026-06-03',
    changes: [
      'Fixed: a distributor\'s detail page now shows all of its items and the correct total — previously it stopped at 100 even when more were assigned',
      'Added Prev/Next paging on the distributor detail page so you can browse the full list',
    ],
  },
  {
    version: '3.21',
    date: '2026-06-03',
    changes: [
      'Batch Upload is now part of Receive — pick a distributor at the top, then scan, photograph, or import a CSV/Excel file all in one place',
      'You can now receive stock directly into any distributor, not just Home Office',
      'Removed the separate Batch Upload menu item to keep things simple (old links now open Receive)',
    ],
  },
  {
    version: '3.20',
    date: '2026-06-02',
    changes: [
      'New usage reports under Reports → Usage: Monthly Usage Report (any month, by distributor and product), Usage Trends (units per month by product type), and Usage by Distributor',
      'Reports page reorganized into Stock / Usage / Movement sections; every report and history now lives in one place',
      'Cleaned up navigation: 4 bottom tabs (Receive · Usage · Inventory · Reports) and a grouped More menu; Lookup is now under More and on the Inventory page',
    ],
  },
  {
    version: '3.19',
    date: '2026-06-02',
    changes: [
      'New Usage tab: record daily implant usage by picking a distributor and scanning the ticket stickers',
      'Each item is checked against that distributor\'s inventory before it\'s deducted — items not in stock are flagged, never deducted',
      'When several identical units exist, the oldest-expiry one is used first (FIFO)',
      'Every ticket is saved with its own USE-… number under Usage History, with a printable report',
    ],
  },
];
