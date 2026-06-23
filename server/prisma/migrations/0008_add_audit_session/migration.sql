-- CreateTable
CREATE TABLE "AuditSession" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "distributorId" TEXT,
    "distributorName" TEXT NOT NULL,
    "matchedCount" INTEGER NOT NULL,
    "missingCount" INTEGER NOT NULL,
    "extraCount" INTEGER NOT NULL,
    "items" JSONB NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuditSession_auditId_key" ON "AuditSession"("auditId");

-- CreateIndex
CREATE INDEX "AuditSession_auditId_idx" ON "AuditSession"("auditId");

-- CreateIndex
CREATE INDEX "AuditSession_createdAt_idx" ON "AuditSession"("createdAt");
