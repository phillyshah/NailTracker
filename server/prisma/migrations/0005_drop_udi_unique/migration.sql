-- Multiple physical inventory units can legitimately share the same GTIN + Lot
-- (and therefore the same UDI). Drop the unique constraint and replace it with
-- a non-unique index for lookups.

ALTER TABLE "InventoryItem" DROP CONSTRAINT IF EXISTS "InventoryItem_udi_key";
DROP INDEX IF EXISTS "InventoryItem_udi_key";

CREATE INDEX IF NOT EXISTS "InventoryItem_udi_idx" ON "InventoryItem"("udi");
