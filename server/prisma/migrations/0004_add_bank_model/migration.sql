-- CreateTable
CREATE TABLE "Bank" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "distributorId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bank_name_key" ON "Bank"("name");

-- CreateIndex
CREATE INDEX "Bank_distributorId_idx" ON "Bank"("distributorId");

-- AddColumn
ALTER TABLE "InventoryItem" ADD COLUMN "bankId" TEXT;

-- CreateIndex
CREATE INDEX "InventoryItem_bankId_idx" ON "InventoryItem"("bankId");
