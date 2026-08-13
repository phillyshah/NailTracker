export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.48',
    date: '2026-08-13',
    changes: [
      'Fixed: pressing "View ticket" after recording usage opened a blank screen you could only escape by closing the app. The ticket now opens correctly. The same crash on transfer detail pages is fixed too',
      'If a page ever fails to load, you now get a "This page didn\'t load" screen with Try again and Go to home buttons, instead of a blank page — the menu stays available so you are never stuck',
    ],
  },
  {
    version: '3.47',
    date: '2026-08-10',
    changes: [
      'Added project README with setup instructions, architecture diagram, and local development guide',
      'ESLint now enforces security rules (no-eval, no-implied-eval) across both workspaces',
    ],
  },
  {
    version: '3.46',
    date: '2026-07-31',
    changes: [
      'Added Telescopic Lag Screw products (PFL-T085 through PFL-T110)',
    ],
  },
  {
    version: '3.45',
    date: '2026-06-23',
    changes: [
      'Transfer has a new "Take / Upload Photo" tab: photograph implant labels and the printed REF, lot, and expiry are read automatically — several stickers in one photo are all read at once — then checked against the source distributor\'s stock, just like Scan',
      'Sharper label reading: photos are now upscaled and cleaned up before scanning, and the matcher recovers more common character mis-reads, so labels read correctly more often',
      'New in TrackerLabs: OCR Training (admin). Upload label photos, review what the scanner read, and correct any mistakes — each correction is remembered so the same label reads correctly next time',
    ],
  },
  {
    version: '3.44',
    date: '2026-06-19',
    changes: [
      'New "Distributor" account type. A distributor logs into a focused home screen scoped to their own stock, where they can run a Cycle Count of their shelf, view their inventory, and record usage — without seeing the rest of the system. Create one under User Management by choosing the Distributor role and picking which distributor it belongs to',
    ],
  },
];
