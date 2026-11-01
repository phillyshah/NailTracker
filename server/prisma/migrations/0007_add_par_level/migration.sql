-- CreateTable
CREATE TABLE "ParLevel" (
    "id" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "gtinShort" TEXT NOT NULL,
    "distributorId" TEXT,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParLevel_itemNumber_distributorId_key" ON "ParLevel"("itemNumber", "distributorId");

-- CreateIndex
CREATE INDEX "ParLevel_itemNumber_idx" ON "ParLevel"("itemNumber");
