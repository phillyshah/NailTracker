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
--
-- Take that second query seriously rather than as a formality: when this file
-- was first written it predicted two indexes would show 0 scans and could be
-- dropped. They showed 70 and 229. See the note in section 4.

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
-- Each of these is redundant BY STRUCTURE, not by usage statistics, so no query
-- can regress: the first four duplicate a UNIQUE index on the identical column
-- (the constraint already provides one), and AssignmentHistory_itemId_idx is a
-- strict prefix of AssignmentHistory_itemId_changedAt_idx created above.
-- ---------------------------------------------------------------------------

DROP INDEX CONCURRENTLY IF EXISTS "Transfer_transferId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "UsageTicket_ticketId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "AuditSession_auditId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "OcrAlias_token_idx";
DROP INDEX CONCURRENTLY IF EXISTS "AssignmentHistory_itemId_idx";

-- ---------------------------------------------------------------------------
-- DO NOT DROP InventoryItem_deletedAt_idx OR InventoryItem_usedAt_idx.
--
-- An earlier revision of this file told you to. That was wrong, and production
-- statistics disproved it before it was run:
--
--     InventoryItem_deletedAt_idx   idx_scan =  70
--     InventoryItem_usedAt_idx      idx_scan = 229     (2026-10-05)
--
-- The argument for dropping them was that "deletedAt IS NULL" matches nearly
-- every live row, so a btree on that column cannot be used profitably. True for
-- the IS NULL filter -- but not for the RANGE queries. The usage reports filter
-- "usedAt >= <window start>", and since most rows have usedAt IS NULL that
-- predicate is highly selective, so the planner uses the index exactly where it
-- pays off. Dropping these would quietly slow the usage reports.
--
-- They may still be superseded by the partial indexes in section 1 over time.
-- To find out, re-run the query below and compare against the counts above: if
-- these two have stalled while InventoryItem_live_* climb, the drop becomes
-- evidence-backed. Note idx_scan is cumulative since the last stats reset.
--
--   SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes
--   WHERE relname = 'InventoryItem' ORDER BY idx_scan;
--
-- Also worth watching in that recheck: InventoryItem_usageTicketId_idx showed
-- 0 scans on 2026-10-05. Not acted on, since zero may simply reflect a recent
-- statistics reset.
-- ---------------------------------------------------------------------------
