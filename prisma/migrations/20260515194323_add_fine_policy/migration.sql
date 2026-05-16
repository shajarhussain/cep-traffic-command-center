-- CreateTable
CREATE TABLE "FinePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "excessThresholdKmh" INTEGER NOT NULL,
    "fineAmount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "FinePolicy_eventType_active_excessThresholdKmh_idx" ON "FinePolicy"("eventType", "active", "excessThresholdKmh");
