-- CreateTable
CREATE TABLE "TrafficIncident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "intersection_name" TEXT NOT NULL,
    "incident_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "first_event_id" TEXT NOT NULL,
    "last_event_id" TEXT NOT NULL,
    "event_count" INTEGER NOT NULL DEFAULT 1,
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "cleared_at" DATETIME
);
