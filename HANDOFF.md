# Nail Tracker — Project Handoff

> Paste this into a new chat to bring an assistant up to speed. Current as of **v3.21** (2026-06-03).

## What this is

**Nail Tracker** is an inventory-tracking web app for **Summa Orthopaedics**. It tracks orthopedic implants (intramedullary nails, lag screws, interlocking screws, cap/set screws) as they move from the **Home Office** warehouse out to distributors/sales reps, get transferred between locations, and get **consumed in surgery**. Users scan GS1-128 barcodes (or enter manually) to receive stock, then record daily usage and run reports.

- **App name:** Nail Tracker · **Org:** Summa Orthopaedics
- **Users** are non-technical warehouse/field staff — keep UX simple and mobile-first.
- **User email on file:** andylash22@gmail.com

## Stack

- **Client:** React 19 + Vite + TypeScript + Tailwind CSS 4. React Router, TanStack Query. Lucide icons. ExcelJS-driven exports come from the server.
- **Server:** Express 5 + Prisma 7 + PostgreSQL (Supabase). ExcelJS for spreadsheet parse/export. Auth via cookie + `authMiddleware`.
- **Monorepo:** npm workspaces — `client/` and `server/`. `npm test` runs both. Tests are **Vitest 4**, several run under multiple timezones (`TZ=America/New_York`, `UTC`, `Asia/Tokyo`).
- **Server entry:** `server/src/index.ts` (port 3045; serves `client/dist` in production).

## Repo layout

- `client/src/pages/` — Receive, Scan (Lookup), Inventory(+Detail), Reports, StockByItem, UsageTrends, UsageMatrix, MonthlyUsage, Usage, UsageHistory(+Detail), Transfer(+Detail), Banks(+Detail), Distributors(+Detail), Users, Login
- `client/src/components/Layout.tsx` — nav (4 bottom tabs + grouped More menu)
- `client/src/version.ts` — `APP_VERSION`
- `client/src/data/changelog.ts` — in-app "What's New" (max 5 entries)
- `client/src/utils/expiry.ts` — `formatExpiry` / `daysUntilExpiry` (UTC-canonical, see Gotchas)
- `server/src/controllers/` — auth, inventory, distributors, reports, transfer, usage, bank, users (+ `.test.ts` siblings)
- `server/src/utils/` — `gtin-map.ts` (GTIN↔product, `getProductCategory`), `usageMatch.ts` (FIFO), `usageReport.ts` (pure aggregations), `spreadsheet.ts`, date/parse helpers
- `server/prisma/schema.prisma` + `server/prisma/migrations/` (latest: `0006_add_usage_ticket`)

## Core domain rules

- **Barcodes:** GS1-128 — AI `01`=GTIN, `10`=lot, `17`=expiry `YYMMDD`. Also supports `YYYY-MM-DD` hourglass format. Parsed by `parseGS1` (client + server).
- **Product categories** (6 + Other), derived from REF/GTIN by `getProductCategory`:
  - `SO-SPFN` → Short Nail; `SO-SPFN` with an L/R side suffix (or `SO-LPFN`) → Long Nail
  - `SO-SPFL-N/A/T` → Lag Screw; `SO-S50I-SO` / `SO-IS` → Interlocking Screw
  - `SO-SPFC` / `SO-EC` → Cap Screw; `SO-SPFS` / `SO-SS` → Set Screw; else → Other
- **Each physical unit = one `InventoryItem` row** (no quantity column). Receiving qty 50 creates 50 rows. Duplicate lot numbers across units are expected and correct.
- **Locations:** every item belongs to a distributor; **Home Office** is the default intake point. Items can be grouped into **Banks** (kits/trays) and moved via **Transfers**.
- **Usage (consumption):** a unit is consumed by stamping `usedAt` (it then leaves available stock). FIFO = oldest `expDate`, then oldest `createdAt`.

## Key features (current)

- **Receive** (`/receive`): scan / live-scan / photo / **batch photos** / **CSV-Excel import** / manual entry. Has a **"Receive into" distributor selector** (defaults to Home Office) — *new in v3.21, this absorbed the old standalone Batch Upload page*. Optional bank assignment after receiving.
- **Usage Tickets** (`/usage`, v3.19): pick one distributor, scan the paper ticket's product stickers; two-phase **preview → commit**. Preview FIFO-matches each sticker against that distributor's available stock (within-ticket dedup so identical stickers each claim a distinct unit); commit consumes confirmed units in one `$transaction`, writing `AssignmentHistory` + a grouped `UsageTicket` (`USE-YYYYMMDD-NNNN`). Items not in that distributor's stock are **blocked, never deducted**. Race-safe via guarded `updateMany`.
- **Reports** (`/reports`, reorganized v3.20 into Overview / Stock / Usage / Movement):
  - Stock by Item Number
  - **Monthly Usage Report** — any month, itemized by distributor + product, Excel export
  - **Usage Trends** — category × month, 3/6/12-mo window, CSS bar chart (`MiniBars`, no chart lib)
  - **Usage by Distributor** — category × distributor matrix
  - Usage History + Transfer History
  - Usage reports aggregate `InventoryItem` rows where `usedAt != null`, bucketed by **UTC month** (not the `UsageTicket.items` JSON).
- **Transfers, Banks, Distributors, User Management** (admin), Lookup/Scan.

## Navigation (v3.20)

- **Bottom bar (4 tabs):** Receive · Usage · Inventory · Reports
- **More menu, grouped:** Tools (Lookup, Transfer) · Organize (Banks, Distributors) · Admin (User Management). All histories/analytics live under **Reports**.

## Gotchas / hard-won lessons

- **Expiry off-by-one (fixed v3.18):** calendar dates are stored as **UTC midnight** (`Date.UTC(...)`) and must be **rendered in UTC** (`{ timeZone: 'UTC' }`). Rendering a UTC-midnight value with plain `toLocaleDateString()` shows the previous day in US timezones. Always use `client/src/utils/expiry.ts`. Admin has a one-time **"Fix Manual Expiry Dates"** backfill button in User Management.
- **Production server is UTC** — "fixes" that rely on local time are no-ops there. Test timezone logic under multiple `TZ` values.
- **Excel import (fixed v3.18):** `.xlsx` must be parsed **server-side** (`POST /api/inventory/parse-spreadsheet`); `file.text()` returns binary garbage for real Excel files. Receive's CSV/Excel import uses this endpoint.
- **Prisma client must be regenerated after schema changes** — `npx prisma generate` — or TS build fails with "Property X does not exist on PrismaClient".
- **Stale-head PR merges** bit us twice (PRs #31/#32 merged an old head and dropped later commits). Re-check the merged diff actually contains your latest commits.

## Conventions (from CLAUDE.md — follow these)

- **Version:** bump the **patch** in `client/src/version.ts` on every PR merged to main (e.g. 3.20 → 3.21). Major bumps are the user's call.
- **Changelog:** append a dated entry to root `CHANGELOG.md` *and* `client/src/data/changelog.ts` (the in-app "What's New"). **`changelog.ts` ≤ 5 entries** — drop the oldest each time.
- **User guide:** update **both** `USER_GUIDE.md` and `Nail_Tracker_User_Guide.docx` on any feature add/change (bug-fix-only PRs don't need it). The app header links to the `.docx` on GitHub raw, so committing it is enough. To regenerate the Word doc: write `generate_guide.py`, run `python3 generate_guide.py`, then **delete the script before committing**. (`python-docx` is available.)
- **Branching:** develop on a feature branch → PR → merge to `main`. Create PRs as **draft**.

## Database / migrations

- Prisma schema: `server/prisma/schema.prisma`. Latest model: `UsageTicket` (+ `InventoryItem.usageTicketId`), migration `0006_add_usage_ticket`.
- **Migrations are run as raw SQL in the Supabase SQL Editor** — the Prisma CLI migrate doesn't work on the VPS. After running SQL, `npx prisma generate` so the client picks up new models.
- **RLS:** Supabase enables row-level security on new tables by default, but the server connects as the `postgres` role (which has `BYPASSRLS`), so app queries are unaffected. RLS only restricts the `anon`/`authenticated` roles (e.g. the Supabase dashboard's Table Editor may look empty/restricted — the app data is fine).

## Deployment (VPS)

- Standard deploy (no schema change):
  ```bash
  cd /var/www/summa-inventory && git pull origin main && npm run build && pm2 restart summa-inventory
  ```
- If `package.json` changed, add `npm install`. If the **schema** changed: run the migration SQL in Supabase, then `cd server && npx prisma generate` before the build.
- Process manager: **pm2**, app name `summa-inventory`. (Node 20 on the box; an EBADENGINE warning about a Prisma sub-dep wanting Node 22 is benign.)
- Note: CLAUDE.md lists the historical dev branch as `claude/summa-inventory-app-g9HJi`; recent sessions have used session-specific `claude/*` branches.

## Status as of this handoff

- **main = v3.20.** **PR #36** (v3.21 — Batch Upload consolidated into Receive + distributor selector) is **open as a draft**, branch `claude/amazing-feynman-YMJGY`. Not yet merged/deployed.
- Most recent commits: Usage Tickets (#34, v3.19), Usage analytics + nav cleanup (#35, v3.20), Batch Upload consolidation (#36, v3.21, pending).
