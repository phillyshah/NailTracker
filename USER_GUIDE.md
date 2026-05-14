# Nail Tracker — User Guide

**Version 3.13** | Summa Orthopaedics Inventory Management System

---

## Getting Started

### Logging In

1. Open the app at your organization's URL (e.g., `inventory.phillyshah.com`)
2. Enter your username and password (login is case-insensitive)
3. Use the eye icon to toggle password visibility if needed
4. Sessions last 7 days before requiring re-login

### Installing as a Mobile App (Recommended)

For the best mobile experience, add Nail Tracker to your home screen:

- **iPhone/iPad (Safari):** Tap the Share button → "Add to Home Screen"
- **Android (Chrome):** Tap the three-dot menu → "Add to Home Screen"

This removes the browser toolbar and gives you a full-screen app experience.

### Navigation

- **Mobile:** Bottom tab bar with Receive, Lookup, Inventory, and Reports. Tap **More** for additional features (Banks, Transfer, Distributors, Batch Upload, User Management).
- **Desktop:** All navigation items appear in the top bar.

### What's New / Version Badge

Tap the version badge (e.g., **v3.13**) in the header to open the **What's New** panel, which shows a summary of recent changes.

---

## Expiry Alerts (Bell Icon)

The **bell icon** in the top-right header gives you instant visibility into items expiring soon — without needing to visit the Reports page.

- Tap the bell to see all items expiring within **90 days**
- Each alert shows the product name, lot, expiry date, and current location
- Tap an individual alert to dismiss it, or tap **Dismiss All** to clear everything
- Dismissed alerts are remembered across sessions

---

## Core Workflows

### 1. Receiving Inventory

**Location:** Receive tab (home screen)

This is where new items enter the system. All received items go to the Home Office distributor automatically.

**Option A — Live Scan (easiest, continuous):**
1. Tap **Live Scan**
2. Point your camera at the GS1-128 barcode label
3. The app detects the barcode automatically — no button press needed
4. A confirmation card appears immediately; keep scanning the next item

**Option B — Take a Photo:**
1. Tap the camera area or **Take Photo**
2. Capture the barcode label
3. The app parses the image and saves the item

**Option C — Batch Upload (multiple photos):**
1. Tap **Batch Upload**
2. Select multiple barcode photos from your gallery
3. Each photo is processed — up to 4 barcodes can be detected per image
4. All parsed items are saved to Home Office

**Option D — Manual Entry:**
1. Tap **Manual Entry**
2. Type or paste the barcode string, e.g., `(01)08880089459148(10)J250929-L021(17)300928`
3. Press Enter or tap **Add**

> **Note:** Multiple units of the same product and lot number (e.g., 50 identical screws from the same manufacturing batch) can each be received individually — the system creates a separate inventory record for each scan.

**Assigning to a bank after receiving:**
After scanning items, you'll see an option: *"Assign received items to a bank?"*
1. Tap the button
2. Select a bank from the dropdown (only Home Office banks are shown)
3. Tap **Assign** to add all newly received items to that bank

---

### 2. Looking Up Items

**Location:** Lookup tab

Use this to quickly check if an item is already in the system.

1. Scan or photograph a barcode
2. The app shows whether the item exists, its current distributor, lot, expiry, and full history
3. From the result you can transfer it to another distributor or mark it as used (implanted)

---

### 3. Inventory Management

**Location:** Inventory tab

Browse, search, and manage all active items in the system.

**Searching and filtering:**
- **Search bar** — find items by item number (REF code), lot number, or product name
- **Filter panel** (funnel icon) — narrow by distributor or expiry date
- **Filter chip** — when you arrive from a Reports card or Stock by Item drilldown, a blue chip at the top shows what's filtered (e.g., "Item: SO-S50I-SO-026-T @ Home Office"). Tap **Clear** to reset.

**Sorting:**
- Tap any column header to sort by that field; tap again to reverse the order
- Default sort is by Item Number

**Actions:**
- **Bulk reassign:** Select multiple items with checkboxes, choose a destination distributor from the "Move to:" dropdown, and tap **Reassign**
- **Individual reassign:** Tap the reassign button on any item card
- **Export:** Tap the **Export** button to download an Excel (.xlsx) file — expired items are highlighted red in the spreadsheet
- Tap any item row to open its full detail page

**Item status indicators:**
- **Red badge:** expired or expiring within 90 days
- **Yellow badge:** expiring within 6 months
- No badge: more than 6 months out

---

### 4. Inventory Item Detail

**Location:** Tap any item in Inventory, Distributor Detail, or a drilldown result

Displays everything about a single item and lets you correct or act on it.

**Information shown:**
- Product label, Item Number (REF code), GTIN, GTIN Short
- Lot number, expiry date, current distributor
- Barcode photo (tap to view full screen; press **ESC** to close)
- Full assignment history with who moved it, when, and why

**Available actions:**

| Action | Description |
|--------|-------------|
| **Edit** | Fix GTIN, Item Number (REF), Lot, Expiry, or Product Label — every change is logged with your username and timestamp |
| **Reassign** | Move the item to a different distributor; a Transfer record is created automatically |
| **Mark as Used** | Flag the item as implanted; it disappears from active inventory |
| **Delete** | Remove the item from the system |

> **Tip:** Press **ESC** at any time to close the full-screen barcode image or any open modal.

---

### 5. Banks (Inventory Groups)

**Location:** More → Banks

Banks let you group items into named sets that travel together — think of a bank as a tray or kit that goes to a surgery site.

**Creating a bank:**
1. Tap **Create Bank**
2. Enter a name, optional description, and select the distributor where the bank currently lives
3. Tap **Create**

**Adding items to a bank:**
1. Open a bank → tap **Add Items**
2. Items at the same distributor as the bank are shown (items already in another bank are excluded)
3. Select items and tap **Add**

**Removing items:**
Tap the **X** next to any item in the bank to remove it. The item stays in inventory — it just leaves the bank.

**Moving a bank:**
1. Open a bank → tap **Move Bank**
2. Select the destination distributor
3. All items in the bank are reassigned to the new distributor and an audit trail is created

---

### 6. Transfers

**Location:** More → Transfer

Create formal transfer records when moving inventory between distributors.

**Creating a transfer:**
1. Select the source distributor (**From**)
2. Select the destination distributor (**To**)
3. Select items to transfer (use **Select All** for speed)
4. Add an optional note
5. Tap **Confirm Transfer** — a transfer ID is auto-generated (`TRF-YYYYMMDD-NNNN`)

> **Note:** When you reassign a single item from its detail page, a Transfer record is also created automatically and appears in Transfer History.

**Viewing and printing a transfer:**
1. Open the transfer from Reports → Transfer History (or navigate directly to its URL)
2. Tap **Print** — a clean, print-formatted report opens
3. The PDF filename defaults to the transfer ID

---

### 7. Reports

**Location:** Reports tab

**Metric cards (clickable):**
Tap any card to jump to a filtered inventory list:
- **Total Units** → all active inventory
- **Active Distributors** → distributor list
- **Expiring < 180d** → items expiring within 6 months
- **Expired** → all expired items
- **Unassigned** → items not yet at a distributor

**Stock by Item Number:**
Tap the **Stock by Item Number** card to open a full matrix view:
- Rows = every item number in your inventory
- Columns = Home Office + each distributor + Total
- **Click an item number or Total** → shows all units of that item across every location
- **Click a count** (e.g., 13 at Home Office) → shows only that item at that specific location
- Sortable by any column; searchable by item number or description
- **Export Excel** button downloads a formatted spreadsheet

**Export Inventory:**
Download the full inventory, or per-distributor breakdowns, as Excel files.

**Transfer History:**
- Searchable list of all transfers
- Sortable by Transfer ID, Date, From/To, Item Count
- Tap any Transfer ID to see the full list of items transferred

**Expiring Items table:**
Shows up to 20 items expiring within the next 180 days, sorted by days remaining. Sortable by all columns.

---

### 8. Batch Upload

**Location:** More → Batch Upload

For high-volume receiving when you have many barcode images or a spreadsheet.

**Image upload:**
- Select multiple barcode photos — up to 4 barcodes are detected per image
- Each barcode becomes a separate inventory item

**CSV/Excel upload:**
- Upload a `.csv` file with barcode strings (one per row in the first column)
- Items sharing the same GTIN and lot number are each created as individual units — no rows are skipped

**After upload:**
- A results grid shows status for each item (success / error)
- Select the items you want to keep and choose a destination distributor
- Tap **Assign** to save them

---

### 9. Distributors

**Location:** More → Distributors

View and manage your distributor network.

- See each distributor's active item count
- Tap a distributor to view all their items, download an Excel export, or share a link
- Items in the **Distributor Detail** view link back to the full inventory detail page
- The **Home Office** distributor is the central receiving location — all scanned items go here first

---

## Admin Features

### User Management

**Location:** More → User Management (admin only)

**Adding a user:**
1. Tap **Add User**
2. Enter a username (minimum 2 characters) and password (minimum 6 characters)
3. Select role: **User** or **Admin**
4. Tap **Create User**

**Managing users:**
- **Toggle role:** Tap the shield icon to switch between User and Admin (you cannot change your own role)
- **Change password:** Tap the key icon
- **Delete user:** Tap the trash icon (you cannot delete yourself or the last admin)

---

## Barcode Format

Nail Tracker reads **GS1-128** barcodes with these Application Identifiers:

| AI | Field | Format |
|----|-------|--------|
| 01 | GTIN | 14 digits |
| 10 | Lot Number | Variable length |
| 17 | Expiry Date | YYMMDD (6 digits) |

**Supported input formats:**
- Parenthesized: `(01)08880089459148(10)J250929-L021(17)300928`
- Raw stream: `010888008945914810J250929-L02117300928`
- Hourglass date format: `YYYY-MM-DD` (used on some label printers)

The system also recognizes **REF codes** to auto-categorize products:

| REF Prefix | Product |
|------------|---------|
| SO-SPFN | Short Femoral Nail |
| SO-LPFN | Long Femoral Nail |
| SO-SPFL-N | Lag Screw (Normal) |
| SO-SPFL-A | Lag Screw (Anti-Rotation) |
| SO-SPFL-T | Lag Screw (Telescopic) |
| SO-S50I-SO | Interlocking Screw |
| SO-SPFC | Cap Screw |
| SO-SPFS | Set Screw |
| SO-IS | Interlocking Screw (legacy) |
| SO-EC | End Cap (legacy) |
| SO-SS | Set Screw (legacy) |

All 105 Summa Orthopaedics products are recognized. Items not yet in the database show "Unknown — GTIN: XXXXXXXXXX" and can be corrected using the **Edit** button on the item detail page.

---

## Tips

- **Best scanning results:** Good lighting and holding the phone steady get the most reliable reads. Live Scan mode works best for continuous high-volume receiving.
- **Same lot, multiple units:** Scanning the same barcode label 10 times creates 10 individual inventory records — which is correct for tracking individual physical implants.
- **Help banners:** Dismissible help text appears on key pages. Tap **? Help** to bring them back.
- **Excel exports:** All downloads are `.xlsx` with a bold header row. Expired items are highlighted red. Open in Excel or Google Sheets.
- **Keyboard shortcut:** Press **ESC** to close full-screen images and modal dialogs.
- **Print reports:** Use Ctrl+P / Cmd+P — page headers and navigation are automatically hidden in print mode.
- **REF code auto-fill:** When editing an item, entering a known Item Number (REF code) auto-fills the correct GTIN and product description.
