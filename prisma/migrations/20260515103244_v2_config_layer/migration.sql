-- CreateTable
CREATE TABLE "OperationZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "centerLatitude" REAL NOT NULL,
    "centerLongitude" REAL NOT NULL,
    "bboxMinLatitude" REAL,
    "bboxMinLongitude" REAL,
    "bboxMaxLatitude" REAL,
    "bboxMaxLongitude" REAL,
    "externalProviderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Intersection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roadName" TEXT,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "defaultSpeedLimit" INTEGER NOT NULL DEFAULT 60,
    "congestionThreshold" INTEGER NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Intersection_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "OperationZone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "defaultPayload" TEXT NOT NULL DEFAULT '{}',
    "severityHint" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SeverityPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "lowThreshold" REAL,
    "mediumThreshold" REAL,
    "highThreshold" REAL,
    "criticalThreshold" REAL,
    "payloadField" TEXT NOT NULL DEFAULT 'speed_kmh',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IncidentRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "incidentType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "groupingWindowMinutes" INTEGER NOT NULL DEFAULT 30,
    "minimumEvents" INTEGER NOT NULL DEFAULT 1,
    "escalationThreshold" INTEGER NOT NULL DEFAULT 5,
    "autoClearEventType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QueuePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "incomingRate" INTEGER NOT NULL DEFAULT 500,
    "processingRate" INTEGER NOT NULL DEFAULT 80,
    "queueLimit" INTEGER NOT NULL DEFAULT 10000,
    "evictionPolicy" TEXT NOT NULL DEFAULT 'Drop least important first; if same priority, drop oldest',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExternalProviderConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'TOMTOM',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "zoneId" TEXT NOT NULL,
    "lastStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastCheckedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalProviderConfig_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "OperationZone" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncidentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "incidentId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IncidentEvent_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "TrafficIncident" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalTrafficSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "areaName" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "snapshotType" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fallback" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "OperatorActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actionType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TrafficCamera" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cameraCode" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "intersectionName" TEXT NOT NULL,
    "intersectionId" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "speedLimitKmh" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrafficCamera_intersectionId_fkey" FOREIGN KEY ("intersectionId") REFERENCES "Intersection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TrafficCamera" ("cameraCode", "createdAt", "id", "intersectionName", "latitude", "longitude", "speedLimitKmh", "status", "updatedAt") SELECT "cameraCode", "createdAt", "id", "intersectionName", "latitude", "longitude", "speedLimitKmh", "status", "updatedAt" FROM "TrafficCamera";
DROP TABLE "TrafficCamera";
ALTER TABLE "new_TrafficCamera" RENAME TO "TrafficCamera";
CREATE UNIQUE INDEX "TrafficCamera_cameraCode_key" ON "TrafficCamera"("cameraCode");
CREATE TABLE "new_TrafficIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intersection_name" TEXT NOT NULL,
    "incident_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "first_event_id" TEXT NOT NULL,
    "last_event_id" TEXT NOT NULL,
    "event_count" INTEGER NOT NULL DEFAULT 1,
    "external_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "external_context_summary" TEXT,
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "acknowledged_at" DATETIME,
    "cleared_at" DATETIME
);
INSERT INTO "new_TrafficIncident" ("cleared_at", "event_count", "first_event_id", "id", "incident_type", "intersection_name", "last_event_id", "opened_at", "severity", "status", "updated_at") SELECT "cleared_at", "event_count", "first_event_id", "id", "incident_type", "intersection_name", "last_event_id", "opened_at", "severity", "status", "updated_at" FROM "TrafficIncident";
DROP TABLE "TrafficIncident";
ALTER TABLE "new_TrafficIncident" RENAME TO "TrafficIncident";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
