export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.35',
    date: '2026-06-12',
    changes: [
      'TrackerLabs Par Levels: set a par by product group (e.g. all Interlocking Screws) in one step — the number applies to every size in the group',
      'Need an exception? Expand a group to set an individual item\'s par, which overrides the group, and expand an item for a per-distributor value. Most specific wins',
    ],
  },
  {
    version: '3.34',
    date: '2026-06-12',
    changes: [
      'TrackerLabs (admins): new Cycle Count. Pick a distributor, scan everything on the shelf, and the app reconciles it against the system — showing what matches, what\'s missing, and what\'s extra',
      'Fix discrepancies in one step: add the extra items as stock and remove the missing ones, all saved as an audit record (AUD-…) you can review under Audit History',
    ],
  },
  {
    version: '3.33',
    date: '2026-06-12',
    changes: [
      'TrackerLabs (admins): new Par Levels & Reorder. Set a minimum stock level per item — a Global value for every distributor, with optional per-distributor overrides',
      'The Reorder Report lists everything below par by distributor, with a suggested order quantity and recent monthly usage for context, and exports to Excel',
    ],
  },
  {
    version: '3.32',
    date: '2026-06-12',
    changes: [
      'New TrackerLabs section (admins only) — a clearly-labeled space for features that are still in testing. The first experiments, Par Levels & Reorder and Cycle Count, are arriving here shortly',
    ],
  },
  {
    version: '3.31',
    date: '2026-06-11',
    changes: [
      'You can now rename a bank and edit its description at any time — tap "Edit" on a bank (in the Banks list or on the bank\'s page) to match the names you use in real life',
    ],
  },
];
