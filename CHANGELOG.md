# Changelog

## v3.27 — 2026-06-04
- **Fixed list truncation on the selection screens.** The server caps `/api/inventory` at 100 rows/request, so screens that requested `limit: 200` and rendered the result directly were silently showing only the first 100:
  - **Transfer → Pick from list** — only the first 100 of a distributor's items were selectable (the reported bug).
  - **Bank detail → Add items** picker — same cap.
- Added `listAllInventory(filters)` (`client/src/api/inventory.ts`) which pages through the 100-row cap and returns the complete set; both selection screens now use it, so "Select All" and the on-screen count cover everything even with thousands of items.
- Audited the other item/record lists: **Inventory**, **Distributor detail**, **Usage History**, and **Transfer History** already paginate correctly (Prev/Next driven by `meta.total`) — no change needed.
- New test `client/src/api/inventory.listAll.test.ts` (pages through 250 items → 3 requests, single page when it fits, empty result, forwards filters).

## v3.26 — 2026-06-03
- **Interactive "Repair Barcodes" stepper** (admin → User Management → Maintenance). Instead of a single bulk fire-and-forget, the admin now reviews each damaged item one at a time — a Find & Replace–style modal showing the stored vs. re-parsed **lot / expiry / product / item #**, with **Repair**, **Skip**, and **Repair all remaining** actions plus a running repaired/skipped tally.
  - New read-only endpoint `GET /api/inventory/reparse-preview` (returns before/after for every item whose stored fields disagree with a fresh parse of its barcode) and `POST /api/inventory/reparse-apply` `{ ids }` (repairs only the chosen items, re-parsed server-side from `rawBarcode` — client values are never trusted; idempotent).
  - Refactored the existing one-shot `backfill-reparse` and the new endpoints onto a shared `reparsePatch` / `reparseCandidate` helper so the diff logic lives in one place.
  - New client component `RepairBarcodesModal.tsx`; the Maintenance button now opens the stepper.
  - Tests extended in `server/src/controllers/inventory.reparse.test.ts` (preview lists only drifted rows with before/after; apply repairs chosen ids, 400s on empty, idempotent on already-correct rows).

## v3.25 — 2026-06-03
- **Batch transfer from an Excel/CSV file** on the Transfer page. A new **"Pick from list / Import from Excel"** mode toggle lets users move many items between distributors at once. Upload a spreadsheet of barcodes → the server resolves each one against the **source distributor's** stock (gtinShort + lot, FIFO, with within-batch dedup so two identical stickers each claim a distinct unit) → the page shows a per-row preview with **Available / Not in stock / Error** badges.
  - **Per-row missing-item handling:** every *Not in stock* row has inline **"Add to source"** and **"Skip"** buttons. A single **"Add all missing to source & include"** shortcut is shown when any are flagged. Both reuse the existing `assignItems()` Receive path (creates the row at source, then re-runs the preview to refresh matched IDs).
  - **Race-safe commit:** each item is moved via `reassignItem(..., { expectedFromDistributorId })`. The server `reassign` controller gained an optional `expectedFromDistributorId` guard — if the item is no longer at source (someone else moved it between preview and commit), it returns **409** and the commit reports the row as skipped in the success screen rather than silently relocating it. Transfers never create stock — that's the missing-item affordance's job.
  - New server endpoint `POST /api/transfers/preview-batch` (mirrors the Usage Tickets preview pattern); new helpers `client/src/utils/transferBatch.ts` (pure, unit-tested); reuses `parseSpreadsheet`, `parseGS1`, `pickFifo`, `assignItems`, `reassignItem`, `createTransfer`.
  - New tests: `server/src/controllers/transfer.controller.test.ts` (preview match / not-in-stock / within-batch dedup / parse error / 404, plus the 409 source guard on reassign); `client/src/utils/transferBatch.test.ts` (status counts, include/exclude, commit payload).
- Pick-mode Transfer flow is unchanged (the existing UI is wrapped by the new mode toggle but behaves identically).

## v3.24 — 2026-06-03
- **Inventory list state is preserved across navigation.** Opening an item and tapping **Back to Inventory** previously dropped the user on page 1 — painful with 1,600 items across 60+ pages. The Inventory page now serializes its full state (page, sort, search, and all filters) to the URL query string via `client/src/utils/inventoryUrl.ts` (`filtersToSearchParams` / `searchParamsToFilters`), and the detail page's back button uses `navigate(-1)` (falling back to `/inventory` when opened directly). The view now survives navigation, refresh, bookmarking, and sharing.
  - New round-trip tests: `client/src/utils/inventoryUrl.test.ts`.
- Item-number (REF) search shipped in v3.23 and is included here — searching e.g. `SO-SPFN-0380-10L-30` returns the matching scanned items.

## v3.23 — 2026-06-03
- **Fixed a serious GS1 barcode-parsing bug that corrupted imported lot numbers and expiry dates.** The raw-stream parser located AI 17 (expiry) with a naive `indexOf('17')`, so any lot containing the digits `17` (e.g. `J260225-L170`, where `L170` contains `17`) was split mid-lot: the lot was truncated to `J260225-L` and `017310` was read as the date — month `73`, which JavaScript's `Date` overflowed into Jan 2007, showing the item as "Expired". (Lots containing `10` had the analogous failure.)
  - Replaced the `indexOf`-based heuristic in both `server/src/utils/parseGS1.ts` and `client/src/utils/parseGS1.ts` with a proper **left-to-right Application Identifier walker**: AI 01/17 are fixed-length; AI 10 (lot) is variable and is terminated by an FNC1 separator when present, otherwise by peeling a trailing, **date-validated** `17YYMMDD` off the end. This fixes the whole class (lot contains `17`/`10`, expiry-before-lot order, FNC1-separated streams, production-date AI 11).
  - New tests: `server/src/utils/parseGS1.test.ts` (incl. a data-driven pass over every distinct barcode from the real `Lag_Screw_Restocks` file) and `client/src/utils/parseGS1.test.ts`, run under multiple timezones.
- **Admin "Repair Barcodes" maintenance action** (`POST /api/inventory/backfill-reparse`, button on User Management). Re-derives lot / expiry / GTIN / label from each item's stored `rawBarcode` to repair rows imported before the fix. Idempotent; skips un-parseable manual REF entries. Guarded by `server/src/controllers/inventory.reparse.test.ts`.
- **Fixed item-number (REF) search.** Inventory search ignored the REF code, so searching `SO-SPFN-0380-10L-30` returned nothing (scanned items store only the gtinShort). Search now also matches `rawBarcode` and resolves a REF (full or partial) back to its gtinShort(s) via the catalog (`findGtinShortsByItemNumber`). Covered in `server/src/controllers/inventory.list.test.ts`.

## v3.22 — 2026-06-03
- **Fixed distributor detail item count/visibility.** The Distributor Detail page hardcoded `limit: 100` and rendered `Assigned Items ({items.length})`, so a distributor with more than 100 assigned items showed only 100 and an incorrect total (the list-page `_count` badge and the Excel export were already correct — no data was lost).
  - `client/src/pages/DistributorDetail.tsx` now uses the same server-side paging + sorting as the main Inventory page: the header shows the true `meta.total`, columns sort across the full set, and a **Prev/Next** control pages through everything. No server change — `/api/inventory` already returns `meta.total` and supports `page`/`limit`/`sortBy`/`sortDir`.
  - Regression guard `server/src/controllers/inventory.list.test.ts`: asserts `meta.total` comes from `count()` (105) and is independent of the returned page length (100), and that the list and count use the same `where` filter so the badge and detail always agree.

## v3.21 — 2026-06-03
- **Consolidated Batch Upload into Receive.** The standalone Batch Upload page and its More-menu item are gone; everything it did now lives in the **Receive** screen, which already housed scanning, photo batch upload, and manual entry. This removes the two-places-called-"Batch Upload" confusion.
  - Receive gains a **"Receive into" distributor selector** (defaults to Home Office) — received items, batch photos, and spreadsheet imports all land in the chosen distributor's inventory. Previously Receive was hardcoded to Home Office and only the standalone page could target other distributors.
  - Receive gains **Import CSV / Excel** (server-side parsing via the existing `/inventory/parse-spreadsheet`, so `.csv`/`.txt`/`.xlsx` all work on desktop and mobile). Each imported barcode is received immediately, consistent with Receive's scan flow.
  - Bank-assignment prompt now follows the selected distributor's banks rather than Home Office's.
  - `/batch` route redirects to `/receive` so existing links/bookmarks keep working; `client/src/pages/BatchUpload.tsx` deleted.

## v3.20 — 2026-06-02
- **New usage analytics reports** (Reports → Usage), built on consumption data (`InventoryItem.usedAt`, aggregated in-memory and bucketed by UTC month):
  - **Monthly Usage Report** — pick any month for a full itemized statement of every product consumed, grouped by distributor, with subtotals and a grand total. Item-level (one row per REF), shows each item's category. Excel export.
  - **Usage Trends** — units consumed per month by the six product categories over a selectable 3/6/12-month window, with a dependency-free bar chart + a category × month table. Optional distributor filter. Excel export.
  - **Usage by Distributor** — category × distributor matrix of units consumed over the window (mirrors Stock by Item). Excel export.
  - New endpoints `GET /api/reports/usage-trends`, `/usage-matrix`, `/monthly-usage` (+ `/export` variants). New `getProductCategory` (six Summa types + Other) and pure `utils/usageReport.ts` aggregators, both timezone-stable.
- **Navigation cleanup** so the growing feature set stays usable:
  - Bottom bar trimmed to four daily pillars — **Receive · Usage · Inventory · Reports** — plus a **grouped More** menu (Tools / Organize / Admin).
  - **Lookup** moved into More and surfaced as a **Scan** button on the Inventory page.
  - The **Reports** hub reorganized into **Stock / Usage / Movement** sections; Usage History and Transfer History now both live under Reports (More holds only actions/setup).
- New tests: `utils/usageReport.test.ts`, `utils/gtinCategory.test.ts`, `controllers/usageReports.controller.test.ts` (run under multiple timezones).

## v3.19 — 2026-06-02
- **New Usage Tickets feature** — record daily inventory consumption. Pick one distributor, scan the ticket's product stickers, and the app confirms each item is actually in that distributor's available stock before deducting it.
  - Two-phase flow: `POST /api/usage/preview` (read-only — parses each sticker and FIFO-matches it against the distributor's stock) then `POST /api/usage/commit` (consumes the confirmed units in one transaction).
  - **Matching:** by Item # + Lot within the chosen distributor's active stock; when several identical units exist, the oldest-expiry unit is consumed first (FIFO), then oldest received. Each sticker consumes exactly one unit; identical stickers on the same ticket each claim a distinct unit.
  - **Blocked, never guessed:** items not found in that distributor's stock are flagged "not in stock" and cannot be deducted. Race-safe — a unit used between preview and commit is reported as skipped, never double-consumed.
  - Consumption reuses the existing "used" status (so consumed units leave inventory) and writes a per-item audit-history entry plus a grouped **UsageTicket** record (`USE-YYYYMMDD-NNNN`).
  - New **Usage** tab (scan + confirm flow, mobile-first) and **Usage History** list + printable ticket detail.
  - New `UsageTicket` table + `InventoryItem.usageTicketId` — **run `server/prisma/migrations/0006_add_usage_ticket/migration.sql` in the Supabase SQL Editor before deploying**, then `npx prisma generate`.
  - New tests: `server/src/utils/usageMatch.test.ts` (FIFO), `server/src/controllers/usage.controller.test.ts` (preview/commit, dedup, blocking, 409).

## v3.18 — 2026-06-02
- **Properly fixed the expiry off-by-one bug.** The v3.17 server-side change (parse bare dates at *local* midnight) was a no-op on the UTC production server and never addressed the real cause, which was on the **display** side: a UTC-midnight value rendered with `toLocaleDateString()` shows the previous day in negative-offset timezones (e.g. US Eastern).
- Adopted one canonical representation end-to-end: expiry is stored as **UTC midnight** of the calendar day (`Date.UTC(...)` in both `parseDateOnly` and `parseGS1`, client and server) and always **rendered in UTC** (`{ timeZone: 'UTC' }`).
- New client helper `utils/expiry.ts` (`formatExpiry`, `daysUntilExpiry`) — the single place that knows expiry is UTC-canonical. `ExpiryBadge`, Transfer, and Transfer Detail now use it.
- `formatDateOnly` (audit notes) now reads the UTC day; the `backfill-manual-expiry` endpoint now normalizes **every** stored expiry to UTC midnight (idempotent), not just manual entries.
- Added timezone-parameterized test suites (run under America/New_York, UTC, Asia/Tokyo): `server/src/utils/date.test.ts`, `server/src/utils/parseGS1.test.ts`, `client/src/utils/expiry.test.ts`, `client/src/utils/parseGS1.test.ts`. Added a `test` script + Vitest config to the client workspace.
- **Fixed Excel (.xlsx) Batch Upload.** The client read every imported file with `file.text()` and split it as CSV — fine for .csv/.txt, but .xlsx/.xls are binary, so real Excel files parsed to nothing and behaved inconsistently across desktop/mobile pickers. Files are now parsed **server-side** with the existing `exceljs` dependency via `POST /api/inventory/parse-spreadsheet`, with **content-signature detection** (PK = xlsx, D0CF11E0 = legacy .xls) so the result never depends on the reported extension. One code path → consistent on every platform. Legacy .xls returns a clear "re-save as .xlsx or .csv" message. New `server/src/utils/spreadsheet.ts` + `spreadsheet.test.ts` (real exceljs round-trip).

## v3.17 — 2026-06-01
- Fixed: expiration dates on **manually-entered** items were displayed one day early. A bare calendar date was being interpreted as UTC midnight, then shown in local time. Manual entry (and editing) now interprets the date at local midnight, matching scanned items.
- Added a maintenance endpoint (`POST /api/inventory/backfill-manual-expiry`) to correct expiry dates on manual items that were already saved with the off-by-one value.
- Added an admin-only **Fix Manual Expiry Dates** button on the User Management page to run that correction with one click.

## v3.16 — 2026-06-01
- Fixed: after tapping **Save Receipt** for a manually-entered item, the "Assign received items to a bank?" prompt now appears as expected. Previously the still-open entry form pushed the prompt off-screen, so it looked like it was never offered. The manual entry panel now collapses on a successful save, surfacing the received items and the bank-assignment prompt (matching the post-scan flow).

## v3.15 — 2026-06-01
- Receive Inventory **Manual Entry** now offers two methods when a barcode/QR code can't be scanned:
  - **Paste QR Code Data** — paste or type the full raw GS1/QR string (existing behavior)
  - **Enter Item Info Manually** — type Item Number (Summa REF code), Lot Number, Expiration Date, and Quantity Received as individual fields
- Manual field entry resolves the REF code to a GTIN server-side and is processed exactly like a scan (same product label / UDI derivation)
- Quantity Received creates one inventory record per unit, mirroring scanning the same label multiple times
- Added `POST /api/inventory/scan-manual` endpoint to resolve manually-entered fields into a parsed item

## v3.14 — 2026-05-14
- Fixed mobile bulk reassign bar — the Reassign button and distributor dropdown are now fully visible without swiping
- User Guide rewritten for inventory staff with plain-English instructions and troubleshooting section
- User Guide download button added to the login page
- Word doc (.docx) regenerated to match updated guide

## v3.13 — 2026-05-14
- Stock by Item Number: clicking an item number now drills into only that item's inventory across all locations
- Stock by Item Number: clicking a specific count at a location now shows only that item at that location (was incorrectly showing all inventory)
- Stock by Item Number: total column is also clickable to drill into all units of that item
- Added `gtinShort` filter to inventory API for exact item-number matching
- Inventory filter chip now shows both the item and the location when arriving from Stock by Item drill-down
- Bell notification icon in the app header shows items expiring within 90 days — no need to open Reports to check
- Alerts can be dismissed individually or all at once; dismissed state persists across sessions
- New Live Scan button on the Receive page — continuous camera stream detects GS1-128 barcodes automatically without taking a photo first

## v3.12 — 2026-05-13
- Fixed Transfer History detail pages showing blank when clicked
- Added error messaging to help diagnose API failures
- Improved handling of malformed or missing transfer data

## v3.11 — 2026-05-13
- **Multiple physical units can now share a GTIN + Lot** — the schema previously enforced "one row per UDI," which incorrectly rejected legitimate same-lot units (you'd see "X already in system" when scanning the 2nd, 3rd, ... unit of a manufacturing lot). Each scan now becomes its own inventory row.
  - Schema: dropped the `@unique` constraint on `InventoryItem.udi`, replaced with a non-unique index for lookups.
  - **Migration SQL (must run in Supabase SQL Editor before deploying):**
    ```sql
    ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_udi_key";
    DROP INDEX IF EXISTS "InventoryItem_udi_key";
    CREATE INDEX IF NOT EXISTS "InventoryItem_udi_idx" ON "InventoryItem"("udi");
    ```
- Scan / parse / batch-upload no longer mark items as "duplicate" based on UDI — they always create new units.
- Receive flow no longer blocks on duplicate-UDI scans.
- Inventory item URLs are now keyed by stable item `id` (not UDI). All edit / reassign / mark-used / delete routes now look items up by `id`.
- Removed the "duplicate scan → merge prompt" logic from the Edit dialog (no longer applicable now that UDI isn't unique).
- Bank add-items / remove-items endpoints now accept `itemIds` (not `udis`).
- Transfer records now also store each item's `id` alongside the UDI label.

## v3.10 — 2026-05-13
- New **Stock by Item Number** report (Reports → Stock by Item Number) — matrix view with one row per item number and one column per location (Home Office + each active distributor) plus a Total column
- Stock matrix is sortable on every column, searchable by item number or description, and every count is a drill-in link to the matching inventory
- Stock matrix has its own Excel export (frozen header + frozen first two columns)
- Fixed Excel export coming back empty when filters were active — the export URL was sending literal `undefined` strings for unset filters
- Excel export now respects the Unassigned / Expired / Expiring-soon filters from the Reports cards
- Inventory page now defaults to sorting by Item Number; column order is Item Number → Description → Lot → Expiry → Distributor, and every column header is sortable

## v3.9 — 2026-05-13
- Exports are now Excel (.xlsx) instead of CSV — with bold header row, frozen top row, and expired dates highlighted in red
- All major lists/tables (Inventory, Distributor Detail, Reports → Transfer History, Reports → Expiring, Transfer Detail) have sortable column headers — tap to sort, tap again to reverse
- UDI replaced with Item Number (REF) across every list, card, and detail header

## v3.8 — 2026-05-13
- Report cards (Total Units / Active Distributors / Expiring <180d / Expired / Unassigned) are now clickable — they navigate to the filtered inventory list
- Inventory page reads URL filters and shows an active-filter chip with a Clear button

## v3.7 — 2026-05-13
- Single-item reassignments now create a Transfer record (visible in Reports → Transfer History)
- Each individual reassign gets its own TRF-YYYYMMDD-NNNN ID
- Batch Transfer flow unchanged — it still creates one combined Transfer for the whole batch

## v3.6 — 2026-05-13
- Edit now detects duplicate scans — if your fix matches an existing item, you're prompted to delete the duplicate and keep the original
- Merge is recorded in both items' history (the deleted one says "Merged into X", the kept one says "Duplicate merged from Y")

## v3.5 — 2026-05-13
- ESC key now closes the full-screen barcode image (and the Edit / Reassign modals)

## v3.4 — 2026-05-13
- New "Edit" button on inventory detail page — correct GTIN, Item Number (REF), Lot, Expiry, or Product Label
- Entering a known Item Number auto-resolves the canonical GTIN + product label
- All edits are logged to the assignment history with a full audit trail (who, when, what changed)
- Changing GTIN or Lot updates the UDI and navigates to the new URL automatically

## v3.3 — 2026-05-13
- Inventory detail page now shows the official Item Number (REF code)
- Item Number is master: if a REF code is found on the label, it overrides the GTIN for categorization
- Self-healing for OCR'd items where GTIN was misread but REF was correctly captured
- New `extractItemNumber` and `getItemNumber` helpers + reverse REF→GTIN lookup

## v3.2 — 2026-05-13
- Complete GTIN product map from Summa Orthopedics spreadsheet (105 products)
- Fixed wrong angle values on existing nail entries (126° → 125°)
- Fixed SO-SPFS mapping (was "Short Proximal Femoral System", now correctly "Set Screw")
- Added all Short Nails (12), Long Nails (56), Lag Screws (11), Interlocking Screws (21), Cap Screws (4), Set Screw (1)
- Added REF code parsing for actual item numbers: SO-S50I-SO (interlocking), SO-SPFC (cap screw)
- Added backfill-labels endpoint to fix existing inventory items after map updates
- Product descriptions now match Summa Orthopedics official format

## v3.1 — 2026-05-13
- Fixed expiry dates not being captured from some barcode scans (OCR lot truncation bug)
- Added Short Proximal Femoral System (SO-SPFS) product category
- Added YYYY-MM-DD hourglass date format detection from labels
- Added backfill endpoint to recover missing expiry dates on existing items
- Added User Guide (Markdown + Word) with link in app header

## v3.0 — 2026-05-01
- Added Inventory Banks — group items and move them as a unit
- Expiry badges now only show when within 6 months (red <90 days, yellow <180 days)
- Bank assignment prompt when receiving items at Home Office
- Bank items restricted to same distributor as the bank
- Auto-categorization from REF codes (SO-SPFN = Short Femoral Nail, etc.)

## v2.6 — 2026-04-15
- PWA support — install as app on iPhone and Android
- Wider desktop layouts
- iOS standalone mode (eliminates Safari browser bar overlay)

## v2.5 — 2026-04-01
- Multi-barcode detection — up to 4 barcodes per photo
- CSV / Excel batch upload
- App renamed from Summa Inventory to Nail Tracker

## v2.0 — 2026-03-15
- Transfer system with auto-generated IDs (TRF-YYYYMMDD-NNNN)
- Transfer detail view and printable reports
- Help banners on each page
- Case-insensitive login, password visibility toggle
- Deleted items can be re-added by scanning again
- Fixed inventory count mismatches across reports and distributors

## v1.5 — 2026-03-01
- Initial barcode scanning with OCR fallback
- Inventory management across distributors
- User management (admin/user roles)
- Batch upload of barcode images
