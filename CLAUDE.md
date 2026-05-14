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
- Development branch: `claude/summa-inventory-app-g9HJi`
- Always develop on the feature branch, then create a PR and merge to `main`
- VPS deploy command: `cd /var/www/summa-inventory && git pull origin main && npm install && npm run build && pm2 restart summa-inventory`
- Migrations must be run as raw SQL in the Supabase SQL Editor (Prisma CLI doesn't work on VPS)

## App Info
- App name: Nail Tracker
- Org: Summa Orthopaedics
- Stack: React 19 + Vite + TypeScript + Tailwind CSS 4 (client), Express + Prisma 7 + PostgreSQL/Supabase (server)
- Barcode format: GS1-128 (AI 01=GTIN, AI 10=lot, AI 17=expiry YYMMDD; also supports YYYY-MM-DD hourglass format)
- Product categories (per GTIN spreadsheet): SO-SPFN (Short Nail & Long Nail — long nails have L/R side suffix), SO-SPFL-N/A/T (Lag Screws), SO-S50I-SO (Interlocking Screw), SO-SPFC (Cap Screw), SO-SPFS (Set Screw)
- Legacy REF prefixes also supported: SO-LPFN, SO-IS, SO-EC, SO-SS
