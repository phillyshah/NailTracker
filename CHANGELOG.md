# Changelog

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
