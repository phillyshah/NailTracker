# Changelog

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
