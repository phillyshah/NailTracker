-- Add imageData column for storing compressed barcode photos
ALTER TABLE "InventoryItem" ADD COLUMN "imageData" TEXT;

-- Add usedAt column for marking items as used/implanted
ALTER TABLE "InventoryItem" ADD COLUMN "usedAt" TIMESTAMP(3);

-- Index for filtering by usedAt
CREATE INDEX "InventoryItem_usedAt_idx" ON "InventoryItem"("usedAt");
