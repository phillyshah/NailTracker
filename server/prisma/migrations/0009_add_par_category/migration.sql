-- Par Levels: add a group/category scope alongside per-SKU pars.
-- Existing rows are per-SKU, so they default to scope = 'item'.
ALTER TABLE "ParLevel" ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'item';
ALTER TABLE "ParLevel" ADD COLUMN "category" TEXT;

-- Group (category) par rows carry no itemNumber/gtinShort.
ALTER TABLE "ParLevel" ALTER COLUMN "itemNumber" DROP NOT NULL;
ALTER TABLE "ParLevel" ALTER COLUMN "gtinShort" DROP NOT NULL;

-- The old unique assumed a non-null itemNumber; dedup is handled in the app now.
DROP INDEX IF EXISTS "ParLevel_itemNumber_distributorId_key";

CREATE INDEX IF NOT EXISTS "ParLevel_scope_idx" ON "ParLevel"("scope");
CREATE INDEX IF NOT EXISTS "ParLevel_category_idx" ON "ParLevel"("category");
