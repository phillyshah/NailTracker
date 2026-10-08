-- v3.52 — express a par level as months of cover
--
-- NOT APPLIED BY THE PRISMA CLI (it cannot reach this database from the VPS).
-- Run this by hand in the Supabase SQL Editor. This file exists for the audit
-- trail. See CLAUDE.md > Database.
--
-- Single statement, additive, nullable with no default backfill required:
-- every existing par keeps working unchanged because NULL means "use minStock".

ALTER TABLE "ParLevel" ADD COLUMN IF NOT EXISTS "coverMonths" INTEGER;

-- Verify:
--   SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'ParLevel' ORDER BY ordinal_position;
