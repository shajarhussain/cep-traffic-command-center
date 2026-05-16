-- CreateTable
CREATE TABLE "TrafficCamera" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cameraCode" TEXT NOT NULL,
    "intersectionName" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "speedLimitKmh" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EventEnvelopeRecord" (
    "eventId" TEXT NOT NULL PRIMARY KEY,
    "correlationId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "sourceId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "subscriberName" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Penalty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "cameraId" TEXT NOT NULL,
    "vehiclePlate" TEXT NOT NULL,
    "speedKmh" INTEGER NOT NULL,
    "speedLimitKmh" INTEGER NOT NULL,
    "fineAmount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payloadSnapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DashboardSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intersectionName" TEXT NOT NULL,
    "congestionLevel" TEXT NOT NULL,
    "activeVehicleCount" INTEGER NOT NULL DEFAULT 0,
    "lastEventId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReportAggregate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "cameraId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EventOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "envelopeJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "TrafficCamera_cameraCode_key" ON "TrafficCamera"("cameraCode");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_subscriberName_key" ON "ProcessedEvent"("eventId", "subscriberName");

-- CreateIndex
CREATE UNIQUE INDEX "Penalty_eventId_key" ON "Penalty"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportAggregate_eventType_cameraId_windowStart_key" ON "ReportAggregate"("eventType", "cameraId", "windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "EventOutbox_eventId_key" ON "EventOutbox"("eventId");
