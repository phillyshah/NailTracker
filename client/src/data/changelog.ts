export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
  {
    version: '3.15',
    date: '2026-06-01',
    changes: [
      'Manual Entry on the Receive page now offers two ways to add an item when you can\'t scan',
      'Paste QR Code Data: paste or type the full QR/barcode string and tap Add',
      'Enter Item Info Manually: type the Item Number, Lot Number, Expiration Date, and Quantity Received',
      'Quantity lets you receive several identical units at once — each becomes its own inventory record',
    ],
  },
  {
    version: '3.14',
    date: '2026-05-14',
    changes: [
      'Bulk reassign bar on mobile now fits on screen — no more swiping right to find the Reassign button',
      'User Guide rewritten with plain-English instructions and a troubleshooting section',
      'User Guide download button added to the login page',
    ],
  },
];
