# Nail Tracker — User Guide

**Version 3.0** | Summa Orthopaedics Inventory Management System

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

---

## Core Workflows

### 1. Receiving Inventory

**Location:** Receive tab (home screen)

This is where new items enter the system. All received items go to the Home Office distributor automatically.

**Scanning a barcode:**
1. Tap the camera area or the **Take Photo** button
2. Point your camera at the GS1-128 barcode label
3. The app reads the barcode, parses the GTIN, lot number, and expiry date, and saves the item immediately
4. A green confirmation card appears with the product name

**Manual entry:**
1. Tap **Manual Entry**
2. Type or paste the barcode string, e.g., `(01)08880089459148(10)J250929-L021(17)300928`
3. Press Enter or tap **Add**

**Batch upload (multiple photos):**
1. Tap **Batch Upload**
2. Select multiple barcode photos from your gallery
3. Each photo is processed — up to 4 barcodes can be detected per image

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

---

### 3. Inventory Management

**Location:** Inventory tab

Browse, search, and manage all active items in the system.

**Features:**
- **Search** by UDI, lot number, or product name
- **Filter** by distributor using the dropdown
- **Bulk reassign:** Select multiple items with checkboxes, choose a destination distributor from the "Move to:" dropdown, and tap **Reassign**
- Tap any item to view full details including barcode image, assignment history, and expiry date

**Item status indicators:**
- **Expiry badges** appear only when relevant:
  - Red badge: expired or expiring within 90 days
  - Yellow badge: expiring within 6 months
  - No badge: more than 6 months out

---

### 4. Banks (Inventory Groups)

**Location:** More → Banks

Banks let you group items into named sets that travel together. Think of a bank as a tray or kit that goes to a surgery site.

**Creating a bank:**
1. Tap **Create Bank**
2. Enter a name, optional description, and select the distributor where the bank currently lives
3. Tap **Create**

**Adding items to a bank:**
1. Open a bank → tap **Add Items**
2. You'll see available items at the *same distributor* as the bank (items already in another bank won't appear)
3. Select items and tap **Add**

**Removing items:**
Tap the **X** next to any item in the bank to remove it (the item stays in inventory, just leaves the bank).

**Moving a bank:**
1. Open a bank → tap **Move Bank**
2. Select the destination distributor
3. All items in the bank are reassigned to the new distributor and an audit trail is created

---

### 5. Transfers

**Location:** More → Transfer

Create formal transfer records when moving inventory between distributors.

**Creating a transfer:**
1. Select the source distributor (From)
2. Select the destination distributor (To)
3. Select items to transfer
4. Add an optional note
5. Submit — a transfer ID is auto-generated (format: `TRF-YYYYMMDD-NNNN`)

**Printing a transfer report:**
1. Open a transfer from the Reports page or navigate to it directly
2. Tap **Print** — the report opens in a print-friendly format
3. The PDF filename defaults to the transfer ID

---

### 6. Reports

**Location:** Reports tab

View system-wide inventory statistics and history.

**Available reports:**
- **Summary counts:** Total items, items per distributor
- **Distributor breakdown:** Tap any distributor name to see its full item list (with download CSV and share options)
- **Transfer history:** Searchable list of all transfers with clickable transfer IDs

---

### 7. Batch Upload

**Location:** More → Batch Upload

For high-volume receiving when you have many barcode images or a spreadsheet.

**Image upload:**
- Select multiple barcode photos — up to 4 barcodes are detected per image
- Each barcode becomes a separate inventory item

**CSV/Excel upload:**
- Upload a `.csv` file with barcode data
- The system parses each row and creates inventory items

---

### 8. Distributors

**Location:** More → Distributors

View and manage your distributor network.

- See each distributor's active item count
- Tap a distributor to view all their items
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
- **Toggle role:** Tap the shield icon next to a user to switch between User and Admin (you cannot change your own role)
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

The system also recognizes **REF codes** (e.g., `SO-SPFN-0180-11-25`) to auto-categorize products:

| REF Prefix | Product |
|------------|---------|
| SO-SPFN | Short Femoral Nail |
| SO-LPFN | Long Femoral Nail |
| SO-SPFL-N | Lag Screw (Normal) |
| SO-SPFL-A | Lag Screw (Anti-Rotation) |
| SO-SPFL-T | Lag Screw (Telescopic) |
| SO-IS | Interlocking Screw |
| SO-EC | End Cap |
| SO-SS | Set Screw |

---

## Tips

- **Best scanning results:** Hold the phone steady, ensure good lighting, and frame the entire barcode in the photo
- **Help banners:** Dismissible help text appears on key pages — tap "? Help" to bring them back
- **Deleted items can be re-added:** If an item was previously deleted or marked as used, scanning it again will restore it
- **Print reports:** Use your browser's print function (Ctrl+P / Cmd+P) — headers and navigation are automatically hidden in print mode
