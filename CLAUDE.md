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
- Always develop on the session's assigned feature branch, then create a PR (as a **draft**) and **squash-merge** to `main`. Bump the version + changelog as part of that PR.
- **VPS manual deploy** (this is the live path — see auto-deploy note below):
  `cd /var/www/summa-inventory && git pull origin main && npm install && npm run build && pm2 restart summa-inventory`
- **After any Prisma schema change**, the VPS build will fail unless the client is regenerated — `npm install` does NOT do this. Use:
  `cd /var/www/summa-inventory && git pull origin main && npm install && cd server && npx prisma generate --schema=prisma/schema.prisma && cd .. && npm run build && pm2 restart summa-inventory`
- Migrations must be run as raw SQL in the Supabase SQL Editor (Prisma CLI doesn't work on the VPS). Provide the SQL with the PR. RLS may be enabled; Prisma connects as table owner (`postgres`) and bypasses it.
- **Auto-deploy is currently OFF.** `.github/workflows/deploy.yml` is set to `workflow_dispatch` (manual "Run workflow" only), not push-to-main, because the `VPS_SSH_KEY` secret isn't accepted by the VPS (SSH handshake fails). Until that secret is fixed, deploys are done manually with the command above. Re-add the `push:` trigger (noted in the workflow) once the key works.
- PR bodies / commits / code must never contain the model identifier.

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
- **Testing pattern:** logic lives in pure helpers tested with Vitest (no React component test infra). Run `npm run build` + `npx vitest run` in both `client/` and `server/`; both must be green before pushing.
- **Known deferred hardening** (not yet done): reassign TOCTOU guarded-update, usage-commit snapshot under concurrent same-unit use, sequential-ID ceiling (>9999/day) + P2002 race, Inventory page-scoped "select all", bulk partial-failure reporting, zod schemas on audit/transfer routes, and a shared-Button `tailwind-merge` upgrade.

## App Info
- App name: Nail Tracker
- Org: Summa Orthopaedics
- Stack: React 19 + Vite + TypeScript + Tailwind CSS 4 (client), Express + Prisma 7 + PostgreSQL/Supabase (server)
- Barcode format: GS1-128 (AI 01=GTIN, AI 10=lot, AI 17=expiry YYMMDD; also supports YYYY-MM-DD hourglass format)
- Product categories (per GTIN spreadsheet): SO-SPFN (Short Nail & Long Nail — long nails have L/R side suffix), SO-SPFL-N/A/T (Lag Screws), SO-S50I-SO (Interlocking Screw), SO-SPFC (Cap Screw), SO-SPFS (Set Screw)
- Legacy REF prefixes also supported: SO-LPFN, SO-IS, SO-EC, SO-SS
