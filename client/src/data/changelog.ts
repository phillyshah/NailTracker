export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.37',
    date: '2026-06-12',
    changes: [
      'Added an "OCR debug" toggle under the photo scanner: turn it on to see the exact text the app read off a label, with a Copy button — handy for reporting a sticker that won\'t scan',
    ],
  },
  {
    version: '3.36',
    date: '2026-06-12',
    changes: [
      'Usage now reads implant stickers that have no barcode: use Take Photo or Upload Photo and the app reads the item number, lot, and expiry off the printed label — and you can capture several stickers in one photo',
      'If a label won\'t read, the manual entry now takes the item number, lot, and expiry straight off the sticker instead of asking for a barcode',
    ],
  },
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
];
