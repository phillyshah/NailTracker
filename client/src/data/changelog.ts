export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '3.53',
    date: '2026-10-10',
    changes: [
      'New in TrackerLabs — Order Planner: what to buy from the manufacturer, as opposed to what to send a distributor. Enter the surgical cases you expect per month and how long the factory takes (6, 9, 12 months), and it works out how many nails that is, then how many lag, interlocking, cap and set screws go with them using the ratios measured from your own cases',
      'Each category is split across sizes using the mix you have actually used, then stock on hand and anything already on order is subtracted — so the suggestion is what is genuinely missing',
      'Quantities are capped at what can realistically be used before it expires, so a slow-moving size is never over-ordered. Capped rows are marked',
      'You can type what is already on order against any item, and the plan nets it out. Excel export includes a second sheet listing every assumption the plan used',
      'Fixed: usage rates (used by par levels set as months of cover) divided by the full look-back window even for items first used weeks ago, understating demand on new products. They now divide by the time an item has actually been in use',
    ],
  },
  {
    version: '3.52',
    date: '2026-10-08',
    changes: [
      'Par levels can now be set as "months of cover" instead of a fixed quantity — enter 12 and the system works out the quantity from how fast that item actually moves, and keeps it in step as usage changes. Set it on a whole product group and every size gets a par sized to its own demand',
      'While you type, each par shows what it works out to (e.g. "12 mo ≈ 24 units (2/mo)"), so you can see the number before you save',
      'The Reorder Report and its Excel export now show whether a par was a fixed quantity or months of cover',
    ],
  },
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
];
