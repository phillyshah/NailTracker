-- CreateTable
CREATE TABLE "OcrTrainingSample" (
    "id" TEXT NOT NULL,
    "imageData" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "parsedJson" JSONB NOT NULL,
    "correctedJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrTrainingSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrAlias" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "canonicalRef" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'training',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcrTrainingSample_status_idx" ON "OcrTrainingSample"("status");

-- CreateIndex
CREATE INDEX "OcrTrainingSample_createdAt_idx" ON "OcrTrainingSample"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OcrAlias_token_key" ON "OcrAlias"("token");

-- CreateIndex
CREATE INDEX "OcrAlias_token_idx" ON "OcrAlias"("token");
