-- Open orders: stock bought from the manufacturer but not yet received, so the
-- Order Planner can net it out instead of re-ordering it.
--
-- Apply this BY HAND in the Supabase SQL Editor. The migration history here has
-- drifted from production and the Prisma CLI cannot reach the database from the
-- VPS — this file is the record of what was run, not something the CLI applies.

CREATE TABLE IF NOT EXISTS "OpenOrder" (
  "id"         TEXT NOT NULL,
  "itemNumber" TEXT NOT NULL,
  "quantity"   INTEGER NOT NULL DEFAULT 0,
  "expectedAt" TIMESTAMP(3),
  "note"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OpenOrder_pkey" PRIMARY KEY ("id")
);

-- One row per item number: the planner reads it as a single "already coming"
-- quantity, and the upsert in the controller relies on this being unique.
CREATE UNIQUE INDEX IF NOT EXISTS "OpenOrder_itemNumber_key" ON "OpenOrder"("itemNumber");
