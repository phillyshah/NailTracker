-- v3.49 performance indexes
--
-- NOT APPLIED BY THE PRISMA CLI. The CLI cannot reach this database from the
-- VPS (see CLAUDE.md), so these statements are run by hand in the Supabase SQL
-- Editor. This file exists so the change has an audit trail in the repo.
--
-- Run each statement ON ITS OWN. CREATE INDEX CONCURRENTLY cannot run inside a
-- transaction block, and the SQL Editor wraps a multi-statement script in one.
-- CONCURRENTLY means no write locks are taken, so this is safe on live data.
--
-- BEFORE RUNNING: confirm what actually exists. The migration history is known
-- to have drifted from production (User.distributorId was added by hand and
-- never recorded here), so the schema is not evidence of the live index set:
--
--   SELECT tablename, indexname, indexdef FROM pg_indexes
--   WHERE schemaname = 'public' ORDER BY tablename, indexname;
--
--   SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes
--   WHERE relname = 'InventoryItem' ORDER BY idx_scan;

-- ---------------------------------------------------------------------------
-- 1. InventoryItem: partial composite indexes over live stock.
--
-- Almost every read filters on two or three columns at once, and the two that
-- appear in nearly all of them (deletedAt, usedAt) are the LEAST selective in
-- the table -- "deletedAt IS NULL" matches essentially every live row. A btree
-- where one value covers ~99% of rows cannot be used profitably, so the two
-- single-column indexes on them cost write amplification and return nothing.
-- Restricting the index to the live subset is the standard fix.
-- ---------------------------------------------------------------------------

-- Live stock by location: distributorId filters, unassigned (IS NULL), counts.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryItem_live_dist_idx"
  ON "InventoryItem" ("distributorId")
  WHERE "deletedAt" IS NULL AND "usedAt" IS NULL;

-- FIFO match for usage + transfer preview. `lot` is currently unindexed
-- entirely, despite sitting inside the per-barcode matcher.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryItem_live_match_idx"
  ON "InventoryItem" ("gtinShort", "lot", "distributorId")
  WHERE "deletedAt" IS NULL AND "usedAt" IS NULL;

-- Expiry reports and the expiringInDays / expired list filters.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryItem_live_exp_idx"
  ON "InventoryItem" ("expDate")
  WHERE "deletedAt" IS NULL AND "usedAt" IS NULL;

-- Default inventory list ordering (gtinShort asc + skip/take) and its count(*).
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryItem_live_gtin_idx"
  ON "InventoryItem" ("gtinShort")
  WHERE "deletedAt" IS NULL AND "usedAt" IS NULL;

-- Usage analytics: the usedAt window, scoped by distributor.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryItem_used_window_idx"
  ON "InventoryItem" ("usedAt", "distributorId")
  WHERE "deletedAt" IS NULL;

-- createdAt is unindexed today despite being filtered by holdings/backup and
-- used as a sort key in six places.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "InventoryItem_createdAt_idx"
  ON "InventoryItem" ("createdAt");

-- ---------------------------------------------------------------------------
-- 2. Daily sequence generators (TRF-/USE-/AUD- ids).
--
-- These run "WHERE id LIKE 'TRF-20261005%' ORDER BY id DESC LIMIT 1" on the
-- write path. Under the default en_US.UTF-8 collation a plain btree CANNOT
-- serve a LIKE 'x%' predicate, so each one currently seq-scans and sorts the
-- whole table. text_pattern_ops makes the prefix match index-usable.
-- ---------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Transfer_transferId_pattern_idx"
  ON "Transfer" ("transferId" text_pattern_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "UsageTicket_ticketId_pattern_idx"
  ON "UsageTicket" ("ticketId" text_pattern_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditSession_auditId_pattern_idx"
  ON "AuditSession" ("auditId" text_pattern_ops);

-- ---------------------------------------------------------------------------
-- 3. AssignmentHistory: both consumers order by changedAt, and the holdings
--    point-in-time query now filters on it directly.
-- ---------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssignmentHistory_itemId_changedAt_idx"
  ON "AssignmentHistory" ("itemId", "changedAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AssignmentHistory_changedAt_idx"
  ON "AssignmentHistory" ("changedAt");

-- ---------------------------------------------------------------------------
-- 4. Drops. Run these only AFTER the creates above have completed.
--
-- The four *_idx below each duplicate an existing UNIQUE constraint, which
-- already provides an index -- they are pure write cost. The two InventoryItem
-- drops are the non-selective columns superseded by the partial indexes above;
-- verify idx_scan = 0 for them in pg_stat_user_indexes first.
-- ---------------------------------------------------------------------------

DROP INDEX CONCURRENTLY IF EXISTS "Transfer_transferId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "UsageTicket_ticketId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "AuditSession_auditId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "OcrAlias_token_idx";
DROP INDEX CONCURRENTLY IF EXISTS "AssignmentHistory_itemId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "InventoryItem_deletedAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "InventoryItem_usedAt_idx";
