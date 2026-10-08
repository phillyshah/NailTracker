export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.51',
    date: '2026-10-08',
    changes: [
      'Fixed: the five Telescopic Lag Screws (PFL-T085 to PFL-T110) were showing as "Unknown" in the "Other" category in every report. They now show their correct name and group under Lag Screw',
      'Stock by Item Number has a new Location filter — pick Home Office or a single distributor to see just their stock, and the Excel export matches whatever you pick',
      'Usage by Item Number is now grouped by product category, with the most-used items listed first in each group and a total for every item across all distributors. Added a category filter; the per-distributor columns have been removed',
    ],
  },
  {
    version: '3.50',
    date: '2026-10-06',
    changes: [
      'New report — Usage by Item Number: how many of each item number were used, broken down by distributor, with a company-wide Total column. Pick a calendar year for a year-to-date or full-year total, or a rolling 3/6/12-month window. Search, sort any column, tap a number to see those units in Inventory, and export to Excel',
    ],
  },
  {
    version: '3.49',
    date: '2026-10-05',
    changes: [
      'The app now loads much faster, especially on a phone: pages download about 60% less code, and the barcode scanner library is only fetched when you actually scan something',
      'Reports, inventory and distributor screens load faster too — the server no longer sends label photos with list data that does not display them',
      'Fixed a crash that could show "This page didn\'t load" on Reports if the server returned an unexpected response',
      'If a page ever fails to load, the error screen now has a "Copy error details" button so problems can be reported and fixed quickly',
    ],
  },
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
];
