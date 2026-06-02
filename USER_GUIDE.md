# Nail Tracker — User Guide

**Version 3.13** | Summa Orthopaedics Inventory Management System

---

## What Is Nail Tracker?

Nail Tracker is the system your company uses to keep track of orthopedic implants — things like nails, screws, and caps — as they move from the Home Office warehouse out to sales reps and distributors in the field.

Every time a box of implants arrives, gets moved, or gets used in surgery, Nail Tracker records it. That way, you always know exactly what you have, where it is, and when it expires.

This guide will walk you through everything you need to know to use the system confidently.

---

## Getting Started

### Logging In

1. On your phone or computer, open the app at your company's web address (e.g., `inventory.phillyshah.com`)
2. Type your username and password — it doesn't matter if you use capital letters or not
3. If you need to see the password you typed, tap the eye icon on the right side of the password box
4. Once you're in, you'll stay logged in for 7 days before you need to sign in again

> **Forgot your login?** Ask your manager or system administrator to reset it for you.

---

### Installing the App on Your Phone (Recommended)

Nail Tracker works in a web browser, but you can also add it to your phone's home screen so it opens like a regular app — no browser bar, no extra steps.

**On an iPhone or iPad:**
1. Open the app in **Safari** (must be Safari, not Chrome)
2. Tap the **Share** button (the box with an arrow pointing up)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add** — the app icon will appear on your home screen

**On an Android phone:**
1. Open the app in **Chrome**
2. Tap the three-dot menu in the top right
3. Tap **"Add to Home Screen"** or **"Install App"**

Once installed, it opens full-screen just like any other app on your phone.

---

### Finding Your Way Around

**On a phone:** You'll see four tabs at the bottom of the screen — **Receive**, **Lookup**, **Inventory**, and **Reports**. Tap **More** to access the rest: Banks, Transfer, Distributors, Batch Upload, and User Management.

**On a computer:** All the pages are listed in the navigation bar at the top.

**Version badge:** You'll see a small button like **v3.13** near the top of the screen. Tap it to see a summary of recent changes to the app.

---

## Expiry Alerts

### The Bell Icon — Your Early Warning System

Near the top-right corner of the screen, there's a **bell icon**. This is one of the most important tools in the app — it tells you immediately if anything in your inventory is getting close to its expiration date, without you having to go looking for it.

- Tap the bell to see a list of all items expiring **within the next 90 days**
- Each alert tells you the product name, lot number, expiry date, and where it's currently located
- Once you've reviewed an alert, tap the **X** next to it to dismiss it, or tap **Dismiss All** to clear the whole list
- The app remembers which alerts you've dismissed, so they won't keep coming back

**Why this matters:** Expired implants cannot be used in surgery. Catching items early gives you time to arrange returns or replacements before they become a problem.

---

## Core Workflows

### 1. Receiving Inventory

**Where to go:** Tap the **Receive** tab (it's the home screen when you open the app)

This is where you bring new items into the system. When a shipment arrives at the Home Office warehouse, you scan each item here. The system automatically records it under "Home Office."

---

**The four ways to receive an item:**

#### Option A — Live Scan *(best for high volume)*

This is the fastest method for scanning many items in a row.

1. Tap the **Live Scan** button
2. Hold your phone camera over a barcode label
3. The app reads it automatically — you don't have to tap anything
4. A green card appears confirming what was just received
5. Move on to the next item — the camera stays ready

> **Tip:** Make sure the barcode is well-lit and fully in frame. The app will beep or show a confirmation when it successfully reads a barcode.

#### Option B — Take a Photo

Good for single items or when Live Scan isn't working.

1. Tap the camera area on screen
2. Point at the barcode label and take a photo
3. The app will analyze the photo and pull out the product details
4. You'll see a confirmation card if it was successful, or an error message if it couldn't read the barcode

#### Option C — Batch Upload *(for large shipments)*

If you have a lot of items to scan and want to do them all at once using photos already saved on your phone:

1. Tap **Batch Upload**
2. Select multiple photos from your phone's gallery — you can pick as many as you want
3. The app will work through each photo and can detect up to **4 barcodes per image**
4. All successfully scanned items are saved to Home Office automatically

#### Option D — Manual Entry

Use this when a barcode won't scan (damaged label, no scanner handy, or the details came from paperwork). Tap **Manual Entry**, then choose one of two methods:

**Method 1 — Paste QR Code Data**

Best when you already have the full barcode/QR text.

1. Make sure **Paste QR Code Data** is selected
2. Type or paste the barcode string exactly as it appears — for example: `(01)08880089459148(10)J250929-L021(17)300928`
3. Press Enter or tap **Add**

**Method 2 — Enter Item Info Manually**

Best when you can read the item details off the box or paperwork but don't have the full barcode string.

1. Tap **Enter Item Info Manually**
2. Fill in all four fields:
   - **Item Number** — the Summa REF code, e.g. `SO-SPFN-0180-10-25`
   - **Lot Number** — the lot/batch number
   - **Expiration Date** — pick the date
   - **Quantity Received** — how many of this exact item you're receiving
3. Tap **Save Receipt**

The app looks up the item number, fills in the product details automatically, and creates one inventory record for each unit in the quantity — exactly as if you'd scanned that many labels. If the item number isn't recognized, you'll see a message and nothing is saved, so double-check the REF code.

> **About duplicate lot numbers:** If you're receiving 50 screws that all came from the same manufacturing batch (same lot number), that's completely fine — scan each one individually and the system will create a separate record for each physical item. This is the correct way to do it.

---

**Assigning received items to a bank:**

After receiving items — whether by scanning or by Manual Entry — you may see a prompt: *"Assign received items to a bank?"* A "bank" is a named group of items (like a kit or tray). If these items belong to a specific kit:

1. Tap the **Assign to Bank** button
2. Choose the bank from the dropdown
3. Tap **Assign**

If they don't belong to a kit yet, just skip this step — you can always assign them later.

---

### 2. Looking Up an Item

**Where to go:** Tap **Lookup** in the bottom navigation

Use this when you want to check on a specific item — maybe you scanned something and want to know where it is, or a rep called and wants to know the status of a particular lot.

1. Scan the barcode (or type it manually)
2. The app will show you:
   - Whether the item is in the system
   - Where it currently is (which distributor has it)
   - Its lot number and expiry date
   - Its full history — every time it was moved and who moved it
3. From here, you can also **transfer it** to another location or **mark it as used** (meaning it was implanted in a patient)

---

### 3. Browsing Your Inventory

**Where to go:** Tap **Inventory** in the bottom navigation

This page shows all active items in the system — everything that hasn't been used or deleted. Think of it as a live spreadsheet of your entire stock.

---

**Finding what you're looking for:**

- **Search bar** at the top: Type a product name, lot number, or item number (REF code). The list filters as you search.
- **Filter button** (the funnel icon): Narrow down by distributor or expiry date.
- **Filter chip**: If you arrive at this page by tapping a report card or clicking through from the Stock report, you'll see a blue bar at the top showing what filter is active — for example, *"Item: SO-S50I-SO-026-T @ Home Office"*. Tap **Clear** to go back to the full list.

**Sorting the list:**

Tap any column header to sort by that column. Tap it again to reverse the order (A→Z or Z→A, newest or oldest, etc.). By default, items are sorted by Item Number.

---

**Taking action on items:**

- **Move one item:** Tap the item row to open its detail page, then use the **Reassign** button there
- **Move several items at once:** Check the box next to each item you want to move, then choose a destination from the **"Move to:"** dropdown and tap **Reassign**
- **Download to Excel:** Tap the **Export** button to get a spreadsheet of your current filtered inventory. Expired items are highlighted in red automatically.

---

**What the color badges mean:**

| Badge Color | What It Means |
|------------|---------------|
| Red | Expired, or expiring within 90 days — needs attention |
| Yellow | Expiring within 6 months — keep an eye on it |
| No badge | More than 6 months until expiry — you're fine |

---

### 4. Viewing and Editing an Item

**Where to go:** Tap any item row anywhere in the app (Inventory, Distributor page, etc.)

This page shows you everything about one specific physical item.

---

**What you'll see:**

- Product name and Item Number (the REF code, like SO-SPFN-0180-11-25)
- GTIN (the long product code), GTIN Short, lot number, and expiry date
- Which distributor currently has it
- A photo of the barcode label (tap to expand; press **ESC** or tap outside to close)
- A full history of everywhere the item has been and who moved it

---

**What you can do:**

| Button | What It Does |
|--------|-------------|
| **Edit** | Fix a mistake — wrong lot number, wrong expiry date, wrong product label. Every change is saved with your name and the time so there's a full audit trail. |
| **Reassign** | Move the item to a different distributor. A transfer record is created automatically. |
| **Mark as Used** | Record that this item was implanted in a patient. It will disappear from active inventory. |
| **Delete** | Remove the item entirely. Use with caution. |

> **Keyboard shortcut:** If you're on a computer, press **ESC** at any time to close a photo or a pop-up window.

---

### 5. Banks (Item Kits)

**Where to go:** Tap **More** → **Banks**

A "bank" is a named group of items that belong together — for example, a kit that a sales rep takes to a specific hospital, or a tray of implants for a particular surgery type. Banks make it easy to move a whole group of items at once instead of one by one.

---

**Creating a bank:**

1. Tap **Create Bank**
2. Give it a name (e.g., "Smith - General Hospital Kit") and an optional description
3. Select which distributor it belongs to
4. Tap **Create**

**Adding items to a bank:**

1. Open the bank, then tap **Add Items**
2. You'll see a list of items at the same distributor as the bank — items already in another bank won't appear here
3. Check the items you want to add, then tap **Add**

**Removing an item:**

Tap the **X** next to an item in the bank list. The item doesn't get deleted — it just leaves the bank and stays in that distributor's regular inventory.

**Moving a whole bank:**

1. Open the bank, tap **Move Bank**
2. Choose the destination distributor
3. Every item in the bank gets reassigned to that distributor, and the move is logged in the history

---

### 6. Transfers

**Where to go:** Tap **More** → **Transfer**

Use this when you need to officially move items from one distributor to another — for example, pulling items back from a rep or shipping a set of implants out to a new location. Every transfer gets its own ID (like `TRF-20260514-0001`) so you can reference it later.

---

**Creating a transfer:**

1. Under **From**, choose where the items are coming from
2. Under **To**, choose where they're going
3. Check the boxes next to the items you want to move. Tap **Select All** if you want everything.
4. Add an optional note (e.g., "Returning expired stock" or "Filling new rep order")
5. Tap **Confirm Transfer**

The system creates a transfer record and updates every item's location automatically.

> **Single-item reassignment also counts:** If you move one item from its detail page using the Reassign button, a transfer record is created for that too — so every move is always tracked.

---

**Printing a transfer report:**

If you need a paper record of a transfer:

1. Find the transfer in **Reports** → **Transfer History** and tap its ID (e.g., TRF-20260514-0001)
2. Tap the **Print** button
3. A clean, print-ready version opens — use Ctrl+P (Windows) or Cmd+P (Mac) to print or save as PDF

---

### 7. Reports

**Where to go:** Tap **Reports** in the bottom navigation

The Reports page gives you a bird's-eye view of your entire inventory at a glance.

---

**The summary cards at the top:**

There are five colored cards that each show a number. **Tap any card to see the matching list of items.**

| Card | What It Shows | Tap to See |
|------|--------------|------------|
| Total Units | How many items are in the system right now | All inventory |
| Active Distributors | How many distributors have items | Distributor list |
| Expiring < 180d | Items that expire within 6 months | Those specific items |
| Expired | Items that are already past their expiry date | Those specific items |
| Unassigned | Items at Home Office not yet sent anywhere | Those specific items |

---

**Stock by Item Number:**

Tap the **Stock by Item Number** button to open a detailed matrix view. This is one of the most useful reports in the system.

- Every row is one type of product (one item number)
- Every column is a location (Home Office, plus each distributor)
- The **Total** column on the right shows how many of that item exist across everywhere

**Drilling down:**
- Tap an **item number** in the leftmost column (or its Total) → see all units of that product across all locations
- Tap a **specific count** (e.g., the "13" under a distributor's column) → see only that product at that location

You can also search by item number or description at the top, sort by any column, and download the whole matrix as an Excel file.

---

**Transfer History:**

A searchable list of every transfer ever created. Type a transfer ID, distributor name, or date in the search bar to find what you're looking for. Tap any transfer ID to see the full detail and print it.

---

**Expiring Items:**

A table showing up to 20 items that expire in the next 180 days, sorted by how many days are left. Tap any column header to re-sort the list.

---

### 8. Batch Upload

**Where to go:** Tap **More** → **Batch Upload**

Use this when you have a large number of items to add to the system and you'd rather upload photos or a spreadsheet than scan them one at a time.

---

**Uploading photos:**

1. Tap the upload area and select images from your phone or computer
2. The app scans each photo automatically — it can find up to **4 barcodes per image**
3. You'll see results appear one by one showing what was found (or any errors)

**Uploading a CSV/Excel file:**

If your shipping documents come as a spreadsheet with barcode data:

1. Make sure the barcode strings are in the first column
2. Tap the upload area and select your file
3. Each row becomes one inventory item — items that share a lot number are each created individually, not skipped

**After uploading:**

1. A grid shows all the items that were found, with a checkmark (success) or X (failed to read)
2. Select the items you want to keep
3. Choose a destination distributor from the dropdown
4. Tap **Assign** to save them

---

### 9. Distributors

**Where to go:** Tap **More** → **Distributors**

This page shows your full list of distributors — the sales reps, hospitals, or other locations where your inventory lives.

- Each distributor card shows how many items they currently have
- Tap a distributor to see their full item list, download it as Excel, or share a link to the page
- From the distributor detail page, tap any item to open its full detail page
- **Home Office** is always the starting point — all items come here first before going anywhere else

---

## Admin Features

### User Management

**Where to go:** Tap **More** → **User Management** *(only visible to admins)*

---

**Adding a new user:**

1. Tap **Add User**
2. Enter a username (at least 2 characters) and a password (at least 6 characters)
3. Choose a role:
   - **User** — can view and manage inventory, but can't add or delete other users
   - **Admin** — full access including User Management
4. Tap **Create User**

**Managing existing users:**

- **Change role:** Tap the shield icon next to a user to switch them between User and Admin. (You can't change your own role.)
- **Reset password:** Tap the key icon next to a user and enter a new password
- **Delete user:** Tap the trash icon. You can't delete yourself or the last remaining admin.

---

**Maintenance — Fix Manual Expiry Dates:**

At the bottom of the User Management page (admins only) is a **Fix Manual Expiry Dates** button. Older manually-entered items could be saved with an expiration date that displayed one day early. Tap this button once to correct any affected items across the whole system. It's safe to run anytime — it only changes items that still need fixing, and reports how many it corrected.

---

## Barcode Format Reference

Nail Tracker reads **GS1-128 barcodes** — the standard format used on medical device packaging. Each barcode contains several pieces of information identified by a two-digit code called an Application Identifier (AI).

| AI Code | What It Contains | Example |
|---------|-----------------|---------|
| 01 | GTIN (product code, 14 digits) | 08880089459148 |
| 10 | Lot number | J250929-L021 |
| 17 | Expiry date (YYMMDD format) | 300928 = Sept 28, 2030 |

**What a full barcode string looks like:**

`(01)08880089459148(10)J250929-L021(17)300928`

The app also accepts the raw format without parentheses, and supports an alternate date format (YYYY-MM-DD) used by some label printers.

---

**Product REF Code Reference:**

Every Summa Orthopaedics product has a REF code printed on its label. The app uses this code to automatically identify the product name. Here are the prefixes and what they mean:

| REF Prefix | Product Type |
|------------|-------------|
| SO-SPFN | Short Femoral Nail |
| SO-LPFN | Long Femoral Nail |
| SO-SPFL-N | Lag Screw (Normal) |
| SO-SPFL-A | Lag Screw (Anti-Rotation) |
| SO-SPFL-T | Lag Screw (Telescopic) |
| SO-S50I-SO | Interlocking Screw |
| SO-SPFC | Cap Screw |
| SO-SPFS | Set Screw |
| SO-IS | Interlocking Screw (older label format) |
| SO-EC | End Cap (older label format) |
| SO-SS | Set Screw (older label format) |

All 105 Summa Orthopaedics products are in the database. If an item shows up as "Unknown — GTIN: XXXXXXXXXX," it means the product code isn't recognized yet. Use the **Edit** button on that item's detail page to correct it, or let your manager know so it can be added to the database.

---

## Tips and Troubleshooting

**Barcode won't scan?**
- Make sure there's good lighting — shadows on the barcode cause read failures
- Hold the phone steady and make sure the whole barcode is in the frame
- Try **Manual Entry** if the label is damaged or the barcode is smudged

**Item shows up as "Unknown" product?**
- The product code may not be in the database yet
- Tap the item to open its detail page, then tap **Edit** to assign the correct product label
- Every edit is logged so there's always a record of what was changed

**Accidentally received the same item twice?**
- If it's genuinely a different physical unit (different box), that's correct — leave both records
- If it was a duplicate scan of the same box, open one of the records and tap **Delete**

**Need to correct a lot number or expiry date?**
- Open the item's detail page and tap **Edit**
- Fix the field and save — the correction is recorded in the item's history automatically

**Exported Excel file won't open?**
- Make sure you have Microsoft Excel or Google Sheets installed
- The file is `.xlsx` format — it won't open in Notes or similar apps

**Lost your login or forgot your password?**
- You can't reset your own password — ask your system administrator

**Items expiring soon?**
- Check the bell icon at the top of the screen for a quick list
- Or go to **Reports** and tap the **Expiring < 180d** card for the full list
