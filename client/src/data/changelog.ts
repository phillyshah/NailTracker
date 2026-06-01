export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
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
];
