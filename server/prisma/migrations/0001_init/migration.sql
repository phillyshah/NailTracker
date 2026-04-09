-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Distributor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "contact" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Distributor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "udi" TEXT NOT NULL,
    "gtin" TEXT NOT NULL,
    "gtinShort" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "expDate" TIMESTAMP(3),
    "rawBarcode" TEXT NOT NULL,
    "productLabel" TEXT,
    "distributorId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "assignedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentHistory" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "fromDistributorId" TEXT,
    "fromDistributorName" TEXT,
    "toDistributorId" TEXT,
    "toDistributorName" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "AssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Distributor_name_key" ON "Distributor"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_udi_key" ON "InventoryItem"("udi");

-- CreateIndex
CREATE INDEX "InventoryItem_distributorId_idx" ON "InventoryItem"("distributorId");

-- CreateIndex
CREATE INDEX "InventoryItem_expDate_idx" ON "InventoryItem"("expDate");

-- CreateIndex
CREATE INDEX "InventoryItem_deletedAt_idx" ON "InventoryItem"("deletedAt");

-- CreateIndex
CREATE INDEX "InventoryItem_gtinShort_idx" ON "InventoryItem"("gtinShort");

-- CreateIndex
CREATE INDEX "AssignmentHistory_itemId_idx" ON "AssignmentHistory"("itemId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentHistory" ADD CONSTRAINT "AssignmentHistory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
