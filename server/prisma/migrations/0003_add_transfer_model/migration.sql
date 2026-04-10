-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "fromDistributorId" TEXT,
    "fromDistributorName" TEXT NOT NULL,
    "toDistributorId" TEXT,
    "toDistributorName" TEXT NOT NULL,
    "note" TEXT,
    "itemCount" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "transferredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_transferId_key" ON "Transfer"("transferId");

-- CreateIndex
CREATE INDEX "Transfer_transferId_idx" ON "Transfer"("transferId");

-- CreateIndex
CREATE INDEX "Transfer_createdAt_idx" ON "Transfer"("createdAt");
