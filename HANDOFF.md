# Nail Tracker — Project Handoff

> Paste this into a new chat to bring an assistant up to speed. Current as of **v3.50** (2026-10-07).
>
> Read `CLAUDE.md` alongside this — it carries the binding rules (deployment, database,
> reporting semantics, code conventions). This file is the *state*: what shipped, what is
> parked, and the mistakes already made so they are not repeated. Sections tagged with an
> older version (e.g. Navigation) are unchanged since then, not stale.

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
  - Stock by Item Number — what you **have** right now, SKU × location
  - **Usage by Item Number** (v3.50) — what you **consumed**, SKU × distributor with a company-wide Total. Calendar-year picker (year-to-date, or a past full year) *or* a rolling 3/6/12-mo window; the two are mutually exclusive. Sortable on every column, searchable, drill-through to Inventory, Excel export. Server side: `buildItemMatrix` + `yearBounds` in `utils/usageReport.ts`; it is the category-level `buildMatrix` re-keyed on the SKU, and a unit test asserts the two agree on totals for the same rows.
  - **Monthly Usage Report** — any month, itemized by distributor + product, Excel export
  - **Usage Trends** — category × month, 3/6/12-mo window, CSS bar chart (`MiniBars`, no chart lib)
  - **Usage by Distributor** — category × distributor matrix
  - Usage History + Transfer History
  - Usage reports aggregate `InventoryItem` rows where `usedAt != null`, bucketed by **UTC month** (not the `UsageTicket.items` JSON).
- **Transfers, Banks, Distributors, User Management** (admin), Lookup/Scan.

## Navigation (unchanged since v3.20)

- **Bottom bar (4 tabs):** Receive · Usage · Inventory · Reports
- **More menu, grouped:** Tools (Lookup, Transfer) · Organize (Banks, Distributors) · Admin (User Management). All histories/analytics live under **Reports**.

## Gotchas / hard-won lessons

- **Expiry off-by-one (fixed v3.18):** calendar dates are stored as **UTC midnight** (`Date.UTC(...)`) and must be **rendered in UTC** (`{ timeZone: 'UTC' }`). Rendering a UTC-midnight value with plain `toLocaleDateString()` shows the previous day in US timezones. Always use `client/src/utils/expiry.ts`. Admin has a one-time **"Fix Manual Expiry Dates"** backfill button in User Management.
- **Production server is UTC** — "fixes" that rely on local time are no-ops there. Test timezone logic under multiple `TZ` values.
- **Excel import (fixed v3.18):** `.xlsx` must be parsed **server-side** (`POST /api/inventory/parse-spreadsheet`); `file.text()` returns binary garbage for real Excel files. Receive's CSV/Excel import uses this endpoint.
- **Prisma client must be regenerated after schema changes** — `npx prisma generate` — or TS build fails with "Property X does not exist on PrismaClient".
- **The reverse proxy is Traefik, not nginx (confirmed 2026-10-07).** A committed `nginx.conf.example` described a vhost that was never deployed, and reading it as fact produced a confident but wrong "OCR uploads are failing with 413" diagnosis plus a hunt for `/etc/nginx/sites-available/summa-inventory`, which doesn't exist. **Committed config examples describe intent, not reality** — verify against the live box. The decisive test took five seconds: a ~3 MB POST returning 401 (not 413) proves the body cleared the proxy.
- **Check the actual production numbers before dropping an index.** An audit argued `InventoryItem_deletedAt_idx`/`usedAt_idx` were unusable and should go; `pg_stat_user_indexes` showed 70 and 229 scans. The argument was right for `IS NULL` filters and wrong for range queries (`usedAt >= <window>` is selective because most rows are null). Measured data beats reasoning about selectivity.
- **Node 20 on the VPS vs Node 22 in dev containers.** Node 22 falls back to CommonJS syntax detection, so a `.js` config using `module.exports` under `"type": "module"` loads fine locally and throws in production. `ecosystem.config.cjs` is `.cjs` for exactly this reason — this class of bug cannot be reproduced in the container.
- **`curl -I` cannot test compression.** `HEAD` has no body, so the `compression` middleware never engages and `content-length` reports the raw size — a false negative. Use `curl -s -D - -H 'Accept-Encoding: gzip' -o /dev/null`.
- **A JSON parse error and a script parse error look alike but aren't.** Chrome's `JSON.parse` failure always appends `, "..." is not valid JSON`; a bare `Unexpected token 'x'` is a *script* parse error. A reported `Unexpected token '|'` on Reports was never reproduced from the codebase (no `eval`, no `new Function`, no dynamic `import()`, single chunk, no service worker) and resolved itself — most likely a one-off corrupted asset delivery. The ErrorBoundary now surfaces the error *name* so this is distinguishable next time.
- **Stale-head PR merges** bit us twice (PRs #31/#32 merged an old head and dropped later commits). Re-check the merged diff actually contains your latest commits.

## Conventions (from CLAUDE.md — follow these)

- **Version:** bump the **patch** in `client/src/version.ts` on every PR merged to main (e.g. 3.20 → 3.21). Major bumps are the user's call.
- **Changelog:** append a dated entry to root `CHANGELOG.md` *and* `client/src/data/changelog.ts` (the in-app "What's New"). **`changelog.ts` ≤ 5 entries** — drop the oldest each time.
- **User guide:** update **both** `USER_GUIDE.md` and `Nail_Tracker_User_Guide.docx` on any feature add/change (bug-fix-only PRs don't need it). The app header links to the `.docx` on GitHub raw, so committing it is enough. To regenerate the Word doc: write `generate_guide.py`, run `python3 generate_guide.py`, then **delete the script before committing**. (`python-docx` is available.)
- **Branching:** develop on a feature branch → PR → merge to `main`. Create PRs as **draft**.

## Database / migrations

- Prisma schema: `server/prisma/schema.prisma`. Latest migration file: `0011_perf_indexes` (performance indexes, v3.49 — **recorded for audit only, never applied by the CLI**).
- **The migration history has drifted from production — trust `pg_indexes`, not the schema.** `User.distributorId` is declared in the schema but no migration created it (added by hand). Dump the live index set before proposing any DDL. See the Database section of CLAUDE.md for the exact queries and the recorded 2026-10-05 usage baseline.
- **Applied to production 2026-10-05 (v3.49):** 11 indexes created — partial `InventoryItem_live_*` indexes over live stock, `InventoryItem_used_window_idx`, `InventoryItem_createdAt_idx`, `text_pattern_ops` prefix indexes for the `TRF-`/`USE-`/`AUD-` daily sequence generators, and two on `AssignmentHistory`. 5 redundant indexes dropped (four duplicating a `UNIQUE`, one a prefix of a new composite). **The two `InventoryItem_deletedAt_idx`/`usedAt_idx` drops were deliberately NOT run** — they are in use.
- **Migrations are run as raw SQL in the Supabase SQL Editor** — the Prisma CLI migrate doesn't work on the VPS. After running SQL, `npx prisma generate` so the client picks up new models.
- **RLS:** Supabase enables row-level security on new tables by default, but the server connects as the `postgres` role (which has `BYPASSRLS`), so app queries are unaffected. RLS only restricts the `anon`/`authenticated` roles (e.g. the Supabase dashboard's Table Editor may look empty/restricted — the app data is fine).

## Deployment (VPS)

- **Current deploy command** (use this one — the older variants omit steps that now matter):
  ```bash
  cd /var/www/summa-inventory && git pull origin main && npm install --include=dev && npm run db:generate --workspace=server && npm run build && pm2 restart summa-inventory
  ```
  `--include=dev` because the build needs devDependencies (`vite`, `typescript`) that a plain `npm install` skips under `NODE_ENV=production`; `db:generate` because the build fails after any schema change without it.
- **Reverse proxy: Traefik** (TLS + HTTP/2) → PM2 Express on `127.0.0.1:3045`. **No nginx on the box.** Traefik's config is on the VPS, not in this repo. Compression and `Cache-Control` are applied by Express, not the edge.
- Process manager: **pm2**, app name `summa-inventory`, config `ecosystem.config.cjs` (must stay `.cjs` — see Gotchas). Node 20 on the box; an EBADENGINE warning about a Prisma sub-dep wanting Node 22 is benign.
- VPS host: **Hostinger**. hPanel has a **Browser terminal** that works from a phone — the fallback when SSH isn't to hand.
- Note: CLAUDE.md lists the historical dev branch as `claude/summa-inventory-app-g9HJi`; recent sessions have used session-specific `claude/*` branches.

## Status as of this handoff (2026-10-07)

- **main = v3.50**, deployed and verified live.
- **PR #69 open as a draft** on branch `claude/amazing-feynman-YMJGY` — corrects the deployment docs (Traefik, not nginx) and deletes `nginx.conf.example`. Docs only; no deploy needed.

### Recent releases
| Version | What |
|---|---|
| **3.50** | **Usage by Item Number** report (`/reports/usage-by-item`) — units consumed per item number × distributor with a company-wide Total; calendar-year picker or rolling 3/6/12-month window; sortable, searchable, drill-through to Inventory, Excel export. New pure helpers `yearBounds` + `buildItemMatrix` in `utils/usageReport.ts`. |
| 3.49 | Reports crash fix (`asArray` at the API boundary, 17 call sites) + a system-wide performance pass: Express `compression` (969 kB → 262 kB), immutable asset caching, `html5-qrcode` deferred (39% of the bundle), 24 lazy routes, `omit: { imageData: true }` on 9 queries, `stock-by-item` via `groupBy`, DB indexes. |
| 3.48 | Blank-screen fix — `useSortable` called after an early return in `UsageDetail`/`TransferDetail`; added `ErrorBoundary` and `react-hooks/rules-of-hooks`. |
| 3.47 | README, ESLint with `no-eval`/`no-implied-eval`, TS `noImplicitReturns`. |
| 3.46 | Telescopic Lag Screw products (PFL-T085…T110). |

### Parked — agreed, not started
- **Write-path batching PR** — the largest remaining performance win, held back from v3.49 because it rewrites the code paths that count implant stock and deserves focused review:
  - per-barcode N+1 in `usage.controller.ts` / `transfer.controller.ts` (40 scanned stickers = 40 serial Supabase round trips) → one `findMany` over the distinct `(gtinShort, lot)` pairs, existing FIFO logic unchanged
  - `inventory.controller.ts` receive path creates rows one at a time inside an interactive transaction (50 units = 100 round trips) → `createManyAndReturn` + `createMany`
  - batch reassign endpoint (a 50-item transfer is currently ~200 round trips across 50 HTTP calls)
  - `backup.controller.ts` does `JSON.stringify(payload, null, 2)` over every base64 image synchronously — the worst event-loop block in the codebase
- **Index recheck, due ~2026-10-19.** Re-run the `pg_stat_user_indexes` query and compare against the 2026-10-05 baseline in CLAUDE.md. If `deletedAt`/`usedAt` have stalled while `InventoryItem_live_*` climb, the two deferred drops become evidence-backed. `usageTicketId_idx` was at 0 scans and belongs in the same recheck.

### Closed — do not re-investigate
- **nginx `client_max_body_size`** — no nginx exists; Traefik has no default body cap. Verified: a ~3 MB POST returns 401, not 413.
- **`http2 on;`** — Traefik serves HTTP/2 by default; already confirmed live.
- **`Unexpected token '|'` on Reports** — never reproduced, not a code bug (see Gotchas); self-resolved. If it recurs, use the **Copy error details** button on the error screen.
