-- CreateTable
CREATE TABLE "UsageTicket" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "distributorId" TEXT,
    "distributorName" TEXT NOT NULL,
    "note" TEXT,
    "itemCount" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageTicket_ticketId_key" ON "UsageTicket"("ticketId");

-- CreateIndex
CREATE INDEX "UsageTicket_ticketId_idx" ON "UsageTicket"("ticketId");

-- CreateIndex
CREATE INDEX "UsageTicket_createdAt_idx" ON "UsageTicket"("createdAt");

-- CreateIndex
CREATE INDEX "UsageTicket_distributorId_idx" ON "UsageTicket"("distributorId");

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "usageTicketId" TEXT;

-- CreateIndex
CREATE INDEX "InventoryItem_usageTicketId_idx" ON "InventoryItem"("usageTicketId");
