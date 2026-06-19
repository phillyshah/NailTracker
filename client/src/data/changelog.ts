export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.43',
    date: '2026-06-19',
    changes: [
      'New in TrackerLabs: Who Has What. See who holds each item right now, grouped by distributor with counts — or switch to "As of a date" to reconstruct holdings at a point in the past from movement history. Search and Excel export included',
    ],
  },
  {
    version: '3.42',
    date: '2026-06-19',
    changes: [
      'New in TrackerLabs: Inventory Backup. Download a backup of inventory received over any period — last 6 months, last year, or a custom date range — as a readable Excel file or a complete JSON snapshot. The backup includes items since used, transferred, or removed, each with its current status and location',
    ],
  },
  {
    version: '3.41',
    date: '2026-06-17',
    changes: [
      'Polished the look-and-feel: buttons across the app now share one consistent size, shape, and color. The main "go" action is always the same blue, and green is reserved for "done" confirmation screens',
    ],
  },
  {
    version: '3.40',
    date: '2026-06-17',
    changes: [
      'Easier to find the main button in Transfer, Usage, and Cycle Count: the primary action (Review / Consume / Finish) now also appears at the top of the list, not only pinned at the bottom — so it isn\'t missed below a long list, especially on desktop',
      'When you can\'t continue yet, the app now tells you why — e.g. uploading an Excel transfer with no destination chosen shows "Pick a To Distributor to continue" instead of just no button',
    ],
  },
  {
    version: '3.39',
    date: '2026-06-17',
    changes: [
      'Fixed: assigning just-received items to a bank could also pull in other items of the same product/lot that were already in stock. It now adds only the exact items you just received',
      'Fixed: after reassigning an item from its detail page, the inventory list now refreshes to show its new location instead of the old one',
      'Fixed: the Reorder Report no longer lists Home Office (par levels apply to field distributors only)',
      'Improved label photo reading: two identical stickers in one photo now count as two units, and a printed manufacture date is no longer mistaken for the expiry',
    ],
  },
];
