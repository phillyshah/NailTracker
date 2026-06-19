export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.44',
    date: '2026-06-19',
    changes: [
      'New "Distributor" account type. A distributor logs into a focused home screen scoped to their own stock, where they can run a Cycle Count of their shelf, view their inventory, and record usage — without seeing the rest of the system. Create one under User Management by choosing the Distributor role and picking which distributor it belongs to',
    ],
  },
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
];
