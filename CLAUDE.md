# Nail Tracker — Project Rules for Claude

## Version Control
- **Bump the patch version on every PR merge to main** (e.g. 3.1 → 3.2)
- Version is defined in `client/src/version.ts` as `APP_VERSION`
- Update `APP_VERSION` as part of every PR that merges to main
- Major version bumps (e.g. 3.x → 4.0) are decided by the user

## Changelog
- **Maintain `CHANGELOG.md`** in the project root — append a dated entry with every PR
- **Also update the in-app changelog** in `client/src/data/changelog.ts` so users see What's New in the app
- Format: version number, date, bullet list of user-facing changes
- **`changelog.ts` must never exceed 5 entries** — drop the oldest entry whenever a new one is added

## User Guide
- Guide files: `USER_GUIDE.md` (Markdown) and `Nail_Tracker_User_Guide.docx` (Word)
- **Update BOTH files on every PR that adds or changes a feature** — bug fixes alone do not require a guide update
- **Users download the Word doc** — updating only the Markdown is not enough; always regenerate the `.docx` too
- The app header links to `Nail_Tracker_User_Guide.docx` on GitHub raw — updating it in the repo is all that's needed (no VPS deploy required)
- To regenerate the Word doc: write `generate_guide.py`, run `python3 generate_guide.py`, then delete the script before committing

## Deployment

### Infrastructure (verified live 2026-10-07 — do not assume otherwise)
- **The reverse proxy is Traefik, NOT nginx.** There is no nginx on the VPS and no vhost for this app. Traefik terminates TLS for `inventory.phillyshah.com` and forwards to the PM2 process on `127.0.0.1:3045`. **Traefik's config lives on the VPS, not in this repo** — do not infer it from anything here. (A committed `nginx.conf.example` previously implied nginx; it was deleted because it described a deployment that was never stood up and caused a wasted debugging detour.)
- Traefik applies **no default request body cap** (unlike nginx's 1 MB) and serves **HTTP/2 by default**. Verified: a ~3 MB POST to `/api/ocr-training` returns 401, not 413. Do not "fix" a body-size or HTTP/2 problem here — there isn't one.
- **gzip compression and `Cache-Control` are applied by Express**, not at the edge (`server/src/index.ts`, added v3.49). They ship with a normal deploy and need no proxy change. Verified live: 87 KB → 22 KB.
- VPS is Hostinger, running **Node 20** (this container runs Node 22 — behaviour can differ; see `ecosystem.config.cjs` below). Hostinger's hPanel has a **Browser terminal** usable from a phone, which is the fallback when SSH isn't available.
- **`ecosystem.config.cjs` must keep the `.cjs` extension.** The root `package.json` has `"type": "module"`, so a `.js` file using `module.exports` is parsed as ESM and throws on Node 20. Node 22 tolerates it via CommonJS syntax detection, so this breakage will NOT reproduce in a dev container.

### Deploy
- Always develop on the session's assigned feature branch, then create a PR (as a **draft**) and **squash-merge** to `main`. Bump the version + changelog as part of that PR.
- **VPS manual deploy** (the live path — see auto-deploy note below):
  ```bash
  cd /var/www/summa-inventory && git pull origin main && npm install --include=dev && npm run db:generate --workspace=server && npm run build && pm2 restart summa-inventory
  ```
  - `--include=dev` is **required**: the build needs `vite`/`tailwindcss`/`typescript`, which are devDependencies, and a plain `npm install` silently skips them when `NODE_ENV=production` is set in that shell — the build then fails.
  - `npm run db:generate --workspace=server` regenerates the Prisma client. **After any Prisma schema change the build fails without it**, and `npm install` does not do it. Using the workspace script avoids relative `cd server && … && cd ..`, so a mid-way failure leaves you in a known directory.
- Migrations must be run as raw SQL in the Supabase SQL Editor (Prisma CLI can't reach the DB from the VPS). Provide the SQL with the PR. RLS may be enabled; Prisma connects as table owner (`postgres`) and bypasses it.
- **Auto-deploy is OFF.** `.github/workflows/deploy.yml` is `workflow_dispatch` only. The historical cause was recorded as a bad `VPS_SSH_KEY`; as of 2026-08-13 the picture is narrower: the **network block has cleared** (runs used to fail `dial tcp ***:22: i/o timeout`; they now reach a real SSH handshake), and the sole remaining blocker is **key authentication** (`ssh: handshake failed … [none publickey]`). Fixing it means putting the public half of `VPS_SSH_KEY` into `authorized_keys` for `VPS_USER` — likely culprits are a missing pubkey or an old `ssh-rsa` key, which OpenSSH 8.8+ rejects by default. Prefer ed25519. Re-add the `push:` trigger only once a manual run goes green.
- **Before enabling auto-deploy**, remove the `npx prisma migrate deploy` line from the workflow. It has never successfully executed, and migrations here are applied by hand as SQL — Prisma has no record of them, so it would try to re-apply from scratch.
- PR bodies / commits / code must never contain the model identifier.

## Database (read before touching indexes or the schema)

- **The migration history has drifted from production. `pg_indexes` is the source of truth, not `schema.prisma` and not `server/prisma/migrations/`.** Known drift: `User.distributorId` is declared in the schema but no migration ever created it — it was added by hand in the Supabase SQL Editor. Always dump the live state before proposing DDL:
  ```sql
  SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY 1,2;
  SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes WHERE relname='InventoryItem' ORDER BY idx_scan;
  ```
- **Prisma cannot express partial indexes.** Production carries several (`InventoryItem_live_*`, filtered on `deletedAt IS NULL AND usedAt IS NULL`) plus `text_pattern_ops` prefix indexes. **Never run `prisma migrate diff` against the schema and apply the result** — it will propose dropping every one of them. See `server/prisma/migrations/0011_perf_indexes/migration.sql` (recorded for audit only; the CLI never applies it).
- **Do NOT drop `InventoryItem_deletedAt_idx` or `InventoryItem_usedAt_idx`.** An earlier audit predicted they were dead weight because `deletedAt IS NULL` matches ~every live row. Production disproved it: 70 and 229 scans respectively (2026-10-05). The reasoning held for the `IS NULL` filter but not for range queries — the usage reports filter `usedAt >= <window>`, which IS selective since most rows are null.
- Index-usage baseline recorded **2026-10-05**, for comparison on any later recheck: `deletedAt` 70, `usedAt` 229, `usageTicketId` **0**, `udi` 5, `bankId` 200, `expDate` 5566, `gtinShort` 7550, `distributorId` 7847.
- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, and the Supabase SQL Editor wraps multi-statement scripts in one — so **give index SQL one statement at a time**.

## Reporting semantics

- **"Sold" / "used" means a unit was *consumed*** — recorded on a usage ticket, stamped on `InventoryItem.usedAt`. It does **not** mean shipped or transferred to a distributor. All usage reports measure consumption; confirmed with the user 2026-10-06.
- Report routes are mounted behind `authMiddleware` + `denyDistributor` (`server/src/routes/reports.ts`), so scoped distributor accounts cannot reach any of them.
- Product **category** and **item number** are derived in Node from the catalogue (`utils/gtin-map.ts`), not stored in the database — so SQL cannot `GROUP BY` them directly. Pivots group by `gtinShort` and label with the item number (see `buildItemMatrix`, `buildStockRows`).

## UI Conventions
- **Shared components — use these, don't hand-roll:** `client/src/components/Button.tsx` (`variant`: primary | secondary | danger | warning; `size`: sm | md | lg; defaults `type="button"` so it can't submit a form by accident) and `client/src/components/SuccessCard.tsx` (the terminal "done" screen for multi-step flows).
- **Button `className` is layout-only** (`w-full`, `flex-1`, `shrink-0`, margins). `cn` is plain `clsx` (no tailwind-merge) — never pass colour/padding utilities that fight the variant/size; add a variant/size instead.
- **Colour convention:** primary-blue = advance / confirm / submit (the main action). Secondary = back / cancel. Danger (red) = destructive. Warning (amber) = cautionary/reversible. **Green is reserved for success/done states only — never an action button.** (Exception kept on purpose: Scan's "Mark as Used" uses solid amber for emphasis.)
- **Primary CTA discoverability:** in flows with a long list, render the primary action inline near the top of the list, not only in a sticky bottom bar (which gets missed on desktop). Sticky bars use `sticky bottom-20 lg:bottom-4 z-30` (clears the mobile tab bar).
- **Explain, don't hide:** when an action can't proceed, show a short amber hint saying what's missing (e.g. "Pick a To Distributor to continue") instead of silently hiding/disabling the button.

## Features / Architecture (hand-off notes)
- **TrackerLabs** (`/labs`) — admin-only (gated by `AdminRoute` + `buildMoreGroups`), "Beta" experiments. Hosts Par Levels & Reorder, Cycle Count, and Audit History (all three linked from the Labs hub).
- **Par Levels** (`ParLevel` table; `scope` = `item` | `category`): effective par resolves most-specific-first — per-distributor SKU override → SKU global → **product-group (category) global**. A group par applies to every SKU in that group. Groups merge Short+Long nails into "Proximal Femur Nail". Setting a par to 0 clears it (falls back to the next level). **Par levels apply to field distributors only — never Home Office** (the reorder report excludes a distributor named "Home Office").
- **Reorder Report**: lists every catalog SKU below its effective par, by distributor; suggested order = par − on-hand; recent usage/mo as context; Excel export.
- **Cycle Count** (`AuditSession` table, `AUD-YYYYMMDD-NNNN`): scan a distributor's shelf → reconcile into matched / missing / extra → one-tap fixes commit atomically (create extras, soft-delete missing, write the audit). Missing units are re-scoped at commit time so an item moved/used between preview and commit isn't wrongly removed.
- **OCR label reading** (the implant stickers have no barcode): the Take Photo / Upload Photo path reads printed REF / lot / expiry text. `parseLabelsFromText` finds each Summa REF (fuzzy-matched against the catalog, tolerating O/0, I/1, S/5, B/8, Z/2), maps it to its GTIN, pairs it with the lot + the EXP-labeled-or-latest date, and emits a GS1 string — multiple stickers per photo supported. A persisted **OCR debug** toggle under the scanner shows the raw OCR text. Manual fallback takes Item # / Lot / Expiry (`buildBarcodeFromFields`).
- **Transfer** has three modes: Pick from list, Manual, Import from Excel. Manual + Excel share the staged-preview + commit path (`canReviewTransfer` gates the Review step for all three). Inventory moves go through `reassign` (transactional with `AssignmentHistory`); the consolidated `Transfer` record is `TRF-YYYYMMDD-NNNN`.
- **Error handling / data safety (v3.49):** an `ErrorBoundary` wraps the routed `<Outlet />` in `Layout` — a page crash shows a recovery screen with the error *name*, component stack and a **Copy error details** button, never a blank app. List endpoints are normalised through `asArray()` at the API boundary (`client/src/utils/asArray.ts`): `const { data: xs = [] } = useQuery(...)` only falls back on `undefined`, so a `null` or non-array payload used to reach `.map()` and blank the page. Object-returning endpoints instead use `res.data!` plus `?? []` at each call site.
- **Memoize `?? []` defaults that feed a hook.** `useSortable` holds its `getters` in a ref (v3.49) so an inline literal is fine, but `items` is still a memo dependency — a bare `data?.rows ?? []` mints a new array identity every render and silently defeats the memo. Wrap it in `useMemo`.
- **`react-hooks/rules-of-hooks` is an ESLint error.** It exists because v3.48 shipped a blank-screen crash: `useSortable` was called *after* an `isLoading` early return, so the hook count changed between renders and React unmounted the tree. Never call a hook after a conditional return.
- **Lint/test baselines** (so a regression is visible): `npx vitest run` = **255 passing**; `npm run lint` = **0 errors, 51 warnings** (pre-existing `no-explicit-any` + `exhaustive-deps`); `tsc -p server` = **37 errors**, all pre-existing `TS7006`/`TS2339` caused by the Prisma client being ungeneratable in a dev container without DB access. Compare against these rather than assuming zero.
- **Routes are lazy-loaded** (v3.49): 24 `React.lazy` routes behind a single `<Suspense>` in `Layout`. A new rarely-used page should follow suit; landing pages (`Login`, `Receive`, `Usage`, `Inventory`, `Reports`, `DistributorHome`) stay eager. `html5-qrcode` is dynamically imported inside `barcodeDetector.ts`/`BarcodeScanner.tsx` — it is 39% of the bundle and must never go back to a static import.
- **Testing pattern:** logic lives in pure helpers tested with Vitest (no React component test infra). Run `npm run build` + `npx vitest run` in both `client/` and `server/`; both must be green before pushing.
- **Known deferred hardening** (not yet done): reassign TOCTOU guarded-update, usage-commit snapshot under concurrent same-unit use, sequential-ID ceiling (>9999/day) + P2002 race, Inventory page-scoped "select all", bulk partial-failure reporting, zod schemas on audit/transfer routes, and a shared-Button `tailwind-merge` upgrade.

## App Info
- App name: Nail Tracker
- Org: Summa Orthopaedics
- Stack: React 19 + Vite + TypeScript + Tailwind CSS 4 (client), Express + Prisma 7 + PostgreSQL/Supabase (server)
- Barcode format: GS1-128 (AI 01=GTIN, AI 10=lot, AI 17=expiry YYMMDD; also supports YYYY-MM-DD hourglass format)
- Product categories (per GTIN spreadsheet): SO-SPFN (Short Nail & Long Nail — long nails have L/R side suffix), SO-SPFL-N/A/T (Lag Screws), SO-S50I-SO (Interlocking Screw), SO-SPFC (Cap Screw), SO-SPFS (Set Screw)
- Legacy REF prefixes also supported: SO-LPFN, SO-IS, SO-EC, SO-SS
