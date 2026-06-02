export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
  {
    version: '3.18',
    date: '2026-06-02',
    changes: [
      'Fixed for real: expiration dates now show the exact day you entered or scanned, on every device and timezone (the earlier fix never took effect on the server)',
      'Admins: run Fix Manual Expiry Dates once on the User Management page to clean up any items still stored off by a day',
      'Fixed: Batch Upload now imports Excel (.xlsx) files correctly on desktop and mobile — previously real Excel files were read as gibberish and found no barcodes',
    ],
  },
  {
    version: '3.17',
    date: '2026-06-01',
    changes: [
      'Added the admin Fix Manual Expiry Dates button on the User Management page',
    ],
  },
  {
    version: '3.16',
    date: '2026-06-01',
    changes: [
      'Fixed: after saving a manually-entered item, the "Assign received items to a bank?" prompt now appears as expected (the entry form no longer hides it)',
    ],
  },
];
