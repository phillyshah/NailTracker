# Nail Tracker — User Guide

**Version 3.37** | Summa Orthopaedics Inventory Management System

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

**On a phone:** You'll see four tabs at the bottom of the screen — **Receive**, **Usage**, **Inventory**, and **Reports**. Tap **More** for everything else, grouped into **Tools** (Lookup, Transfer), **Organize** (Banks, Distributors), and **Admin** (User Management). Admins also see a **TrackerLabs** group for features in testing. All reports and histories — including Usage History and Transfer History — live under **Reports**.

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

This is where you bring new items into the system. When a shipment arrives, you scan each item here and the app records it automatically.

**Choosing where items go:** At the top of the Receive screen there's a **"Receive into"** selector. It defaults to **Home Office** — the usual starting point for a new shipment — but you can switch it to any distributor to receive stock directly into their inventory (handy when importing a spreadsheet of a distributor's existing stock). Everything you receive on the screen — scans, photos, and file imports — goes into whichever distributor is selected here.

---

**The ways to receive an item:**

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

#### Option C — Batch Photos *(for large shipments)*

If you have a lot of items to scan and want to do them all at once using photos already saved on your phone:

1. Tap **Batch Photos**
2. Select multiple photos from your phone's gallery — you can pick as many as you want
3. The app will work through each photo and can detect up to **4 barcodes per image**
4. All successfully scanned items are saved automatically into the selected distributor

#### Option D — Import CSV / Excel *(for spreadsheets of barcodes)*

If you have a list of barcodes in a spreadsheet — for example a stock list from a distributor:

1. Tap **Import CSV / Excel**
2. Choose a `.csv`, `.txt`, or Excel (`.xlsx`) file containing the barcode strings
3. The app reads every barcode and receives each one into the selected distributor automatically

> This works the same on desktop and mobile — the file is read on the server, so real Excel files import correctly everywhere.

#### Option E — Manual Entry

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

**Where to go:** Tap **More → Lookup**, or the **Scan** button on the Inventory page

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

**Renaming a bank or editing its description:**

You can change a bank's name and description at any time so they match the terminology you use in real life.

1. Tap **Edit** — either on the bank's card in the Banks list, or in the header on the bank's own page
2. Update the name and/or description
3. Tap **Save Changes**

The new name appears everywhere immediately. (Renaming only changes the label — the items in the bank are unaffected.)

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

**Three ways to build a transfer.** At the top of the Transfer page there's a toggle:

- **Pick from list** — browse the source distributor's items and tick the ones to move. Best when you can see what you want on screen.
- **Manual Transfer** — scan, photograph, paste, or type each item, just like the Receive page. Best for quick transfers of a few parts, or when you're working from the physical items rather than a list.
- **Import from Excel** — upload a CSV/Excel file of barcodes. Best for moving many items at once from a spreadsheet.

---

**Creating a transfer (Pick from list):**

1. Under **From**, choose where the items are coming from
2. Under **To**, choose where they're going
3. Use the **search box** to quickly narrow the list by item number, lot, or product name, then check the boxes next to the items you want to move. Tap **Select All** to select everything currently shown.
4. Add an optional note (e.g., "Returning expired stock" or "Filling new rep order")
5. Tap **Review Transfer**, then **Confirm Transfer**

The system creates a transfer record and updates every item's location automatically.

> **Quick-find everywhere:** the same search box appears wherever you pick items — the Manual Transfer staged list, the Bank "Add Items" picker, and each Distributor's detail page — so you can always type a few characters to jump to what you need.

> **Single-item reassignment also counts:** If you move one item from its detail page using the Reassign button, a transfer record is created for that too — so every move is always tracked.

---

**Printing a transfer report:**

If you need a paper record of a transfer:

1. Find the transfer in **Reports** → **Transfer History** and tap its ID (e.g., TRF-20260514-0001)
2. Tap the **Print** button
3. A clean, print-ready version opens — use Ctrl+P (Windows) or Cmd+P (Mac) to print or save as PDF

---

**Manual Transfer (scan, photo, paste, or type):**

When you're moving a handful of parts — or working from the physical items instead of a list — switch to **Manual Transfer**. It works exactly like the Receive page, so there's nothing new to learn.

1. Pick the **From** and **To** distributors
2. Tap the **Manual Transfer** toggle, then add items using whichever method suits you:
   - **Live Scan** — point the camera at each barcode in turn
   - **Take Photo / Upload Photo** — snap a label or pick an image from your gallery
   - **Batch Photos** — select several photos at once and the app reads them all
   - **Manual Entry** — paste a full QR/barcode string, or type the **Item Number**, **Lot**, **Expiration**, and **Quantity** by hand
3. As you add items, each one is checked against the **From** distributor's stock and shown as a row with a coloured badge:
   - **Ready** (green) — found at the source; will be transferred
   - **Not in stock** (amber) — the item parsed fine, but the source doesn't have it
   - **Error** (red) — the barcode/label couldn't be read
4. For any **Not in stock** row, you have two options:
   - Tap **Add to source** — the app creates that item in the source distributor and includes it in the transfer (use this when you *know* the item is physically there and the source just hasn't logged it yet)
   - Tap **Skip** — the row is dropped from the transfer
5. If there are several missing rows, tap **Add all missing items to source & include** to handle them all at once
6. Tap **Review Transfer**, then **Confirm Transfer**

> **Tip:** scan the same item twice and the app correctly stages two units — and if the source only has one, the second is flagged "Not in stock" rather than double-counting.

---

**Import from Excel (move many items from a spreadsheet):**

When you have a spreadsheet of barcodes and need to move a lot of items at once, use the **Import from Excel** tab instead of adding them one by one.

1. Pick the **From** and **To** distributors
2. Tap the **Import from Excel** tab, then **Choose CSV / Excel file**
3. The app reads every barcode and checks it against the **From** distributor's stock, showing one row per barcode with the same **Ready / Not in stock / Error** badges as Manual Transfer
4. Handle any **Not in stock** rows with **Add to source**, **Skip**, or **Add all missing items to source & include** — exactly as in Manual Transfer
5. Tap **Review Transfer**, then **Confirm Transfer**

> **Mix and match:** items you scan or type in Manual Transfer and rows from a spreadsheet feed the same staged list, so you can combine them in one transfer if you like.

> **Transfers never create new stock by themselves.** The "Add to source" buttons are the *only* way this flow adds inventory — everything else is just moving existing items between distributors.

> **Safety net:** if someone else moves one of the staged items between when you added it and when you confirmed, the app skips that row (rather than silently relocating it) and lists it in the success screen as "Skipped — moved out of source between preview and confirm".

---

### 7. Recording Daily Usage (Usage Tickets)

**Where to go:** Tap **Usage** in the bottom navigation

Use this every day to record the implants a distributor has used. You scan the product stickers from the paper usage ticket, and the app deducts those items from that distributor's inventory — but only after confirming they're actually in stock.

---

**Recording a usage ticket:**

1. **Pick the distributor** at the top. (All the items on one ticket come out of this one distributor. To record a different distributor, finish this ticket first or change the selection to start over.)
2. **Capture each sticker.** Many implant stickers on the usage ticket have **no barcode** — just printed text (REF/item number, lot, expiry). The app handles both:
   - **Live Scan** — best when the sticker has a scannable barcode.
   - **Take Photo / Upload Photo** — best for text-only stickers. The app reads the **item number, lot, and expiry** right off the printed label. You can fit **several stickers in one photo** and it will add them all at once.
   - **Enter from the label** — if a photo won't read, tap this and type the **item number, lot, and expiry** straight off the sticker (item number and lot are required; expiry is optional and accepts formats like `2030-10-20`). You can also paste a full barcode here.
3. As you capture items, each shows a status:
   - 🟢 **Available** — found in this distributor's stock and ready to deduct. If several identical units exist, the one expiring soonest is used first.
   - 🟡 **Not in stock** — this item isn't in that distributor's inventory, so it **can't** be deducted. Double-check the distributor, or that the item was received first.
   - 🔴 **Unreadable** — the sticker couldn't be read; take a sharper, well-lit photo of just that label, or use **Enter from the label**.
4. Tap **Consume N items**. Review the list, add an optional note (case number, surgeon, etc.), and tap **Consume**.
5. The items are deducted from inventory and the ticket is saved with its own number (like `USE-20260602-0001`).

> **Only in-stock items are deducted.** Anything flagged "not in stock" is left untouched — the app never guesses or deducts something a distributor doesn't have.

---

**Usage History:**

Tap **History** (top of the Usage page) or **More → Usage History** to see every ticket you've recorded. Tap a ticket to see exactly which items were consumed, and use **Print** for a paper or PDF record.

---

### 8. Reports

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

**Usage Reports (how products are being used):**

The Reports page has a **Usage** section with three reports that show what's actually being consumed — useful for planning orders and balancing stock between distributors. Each one has an **Excel** export button.

- **Monthly Usage Report** — pick *any* month and (optionally) a distributor to get a full itemized statement: every product used that month, grouped by distributor, with quantities, subtotals, and a grand total. This is your go-to "what did we use in May?" report.
- **Usage Trends** — units consumed each month by product category (Short Nail, Long Nail, Lag Screw, Interlocking Screw, Cap Screw, Set Screw) over the last 3, 6, or 12 months. A bar chart shows the monthly totals; the table breaks it down by category. Filter to one distributor to see just their usage.
- **Usage by Distributor** — a grid with product categories down the side and distributors across the top, showing how many of each were used over the window. Quickly compares who uses what.

> Usage reports fill in as you record usage tickets (Usage tab). The more you record, the more useful the trends become.

---

**Transfer History:**

A searchable list of every transfer ever created. Type a transfer ID, distributor name, or date in the search bar to find what you're looking for. Tap any transfer ID to see the full detail and print it.

---

**Expiring Items:**

A table showing up to 20 items that expire in the next 180 days, sorted by how many days are left. Tap any column header to re-sort the list.

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

**Maintenance — Repair Barcodes (Lot & Expiry):**

Also on the User Management page (admins only) is a **Repair Barcodes** button. Some items imported from a spreadsheet before a parsing fix had their lot number cut short (for example showing "…-L" instead of the full "…-L170") and an incorrect expiry date.

Tap **Repair Barcodes** and the app finds every item whose stored details don't match its original barcode, then walks you through them **one at a time** — much like Find & Replace in Word or Excel. For each item you'll see the current value crossed out next to the corrected value (lot, expiry, product, and item number), and you can:

- **Repair** — apply the correction to this item and move to the next
- **Skip** — leave this item as-is and move to the next
- **Repair all remaining** — fix every remaining item at once

A running count of repaired/skipped is shown, and a summary appears when you reach the end. Nothing changes until you tap Repair (or Repair all remaining), it only ever touches items that need it, and it leaves manually-entered items alone.

---

### TrackerLabs (Beta — Admins Only)

**Where to go:** Tap **More** → **TrackerLabs** *(only visible to admins)*

TrackerLabs is a dedicated space for **new features that are still being tested**. Features here are marked with a **Beta** badge, are only visible to admins, and may change as we refine them based on your feedback. When a feature is solid, it graduates out of TrackerLabs into the main menu.

Open TrackerLabs to see the current experiments. Each one has its own help banner explaining how it works.

> Because TrackerLabs features are in testing, try them on real data with a little caution and let us know what's working or what feels off — that feedback is exactly what shapes the final version.

**Par Levels & Reorder (Beta):**

This experiment helps you answer "what do I need to order?" instead of just "what do I have?"

1. From TrackerLabs, open **Par Levels**. Items are organized into **product groups** — Proximal Femur Nail, Lag Screw, Interlocking Screw, Cap Screw, and Set Screw
2. The fastest way to set pars is a **Group par**: one number on the group's header row that applies to *every size* in that group (e.g. set "3" on Interlocking Screw and every interlocking size now has a par of 3)
3. To fine-tune, expand a group and set a value on an **individual item** — that overrides the group par for that one item. The item's box shows the inherited group number as a faint placeholder so you can see what it would be otherwise
4. To fine-tune one site, expand an item and set a **per-distributor override**. Leave any field blank or 0 to clear it and fall back to the level above it — values save automatically as you move off each field
5. Open the **Reorder Report** to see every item that's below its par, grouped by distributor

So pars resolve from most specific to least: a per-distributor item value wins, then the item's own value, then the group par. Set a group par once and only touch the items that are exceptions.

The Reorder Report shows, for each low item: how many are **on hand**, the **par** level, a **suggested order** quantity (how many to bring it back up to par), and the recent **usage per month** for context. You can search, filter to one distributor, and **download the report as an Excel file** to use as an order sheet.

> Par levels apply to distributors (the field sites you replenish), not to Home Office — Home Office is the warehouse you reorder into.

**Cycle Count (Beta):**

This experiment lets you verify the system against the physical shelf, so the numbers in Nail Tracker stay honest.

1. From TrackerLabs, open **Cycle Count**
2. Choose the **distributor** you're counting
3. **Scan everything physically on the shelf** (use the camera, or type/paste barcodes for anything that won't scan)
4. Tap **Review count**. The app reconciles your scans against what the system says that distributor has, and sorts everything into three groups:
   - **Matched** — scanned items the system already knew about (nothing to do)
   - **Missing** — items the system has at this site but that you didn't scan (maybe they're gone)
   - **Extra** — items you scanned that the system doesn't have here (untracked stock)
5. Resolve the differences: check the **Extra** items you want to **add** as stock at this distributor, and check the **Missing** items you want to **remove** from inventory
6. Tap **Finish**. Your fixes are applied together, and the count is saved as an audit record

You can review every past count under **Audit History**, each with its own ID (AUD-…) and a breakdown of how many items were matched, added, and removed.

> Removing a "missing" item doesn't delete its history — the record of where it had been is kept. And if a unit gets used or moved between Review and Finish, the app won't remove it by mistake.

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

**A text-only sticker won't read?**
- Take a sharper, well-lit photo of just that one label, then try again
- Use **Enter from the label** (on the Usage page) to type the item number, lot, and expiry directly
- To help us improve reading, turn on the small **OCR debug** switch beneath the photo buttons, retake the photo, and tap **Copy** — that copies the exact text the app read off the label so you can send it to your administrator

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
