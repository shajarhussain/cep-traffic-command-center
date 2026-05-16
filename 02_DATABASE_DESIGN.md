# Database Design

## Database choice
Use SQLite through Prisma for local development. It is easy to run during viva and still teaches proper schema design. If deployment is required, switch the Prisma datasource to PostgreSQL with the same table structure.

## Core tables

### `traffic_cameras`
Stores cameras that publish events.

| Field | Type | Purpose |
|---|---|---|
| `id` | string/UUID | camera identity |
| `camera_code` | string unique | readable camera code such as `CAM-ISB-001` |
| `intersection_name` | string | location name |
| `latitude` | float nullable | map display |
| `longitude` | float nullable | map display |
| `speed_limit_kmh` | int | used for speed violation simulation |
| `status` | enum | `ACTIVE`, `INACTIVE`, `MAINTENANCE` |
| `created_at` | datetime | audit |
| `updated_at` | datetime | audit |

### `event_envelopes`
Stores every published envelope for audit and replay.

| Field | Type | Purpose |
|---|---|---|
| `event_id` | string/UUID primary key | unique event instance |
| `correlation_id` | string | groups related journey events |
| `schema_version` | int | event schema version |
| `source_id` | string | camera ID |
| `timestamp` | datetime | creation time |
| `event_type` | string | event name |
| `payload_json` | JSON/text | actual event payload |
| `priority` | enum | `LOW`, `NORMAL`, `HIGH`, `CRITICAL` |
| `created_at` | datetime | database insertion time |

### `processed_events`
Stores which subscriber already processed which event. This is the core of the Idempotent Receiver Pattern.

| Field | Type | Purpose |
|---|---|---|
| `id` | string/UUID | row ID |
| `event_id` | string | envelope event ID |
| `subscriber_name` | string | e.g., `AlertService` |
| `processed_at` | datetime | processing time |

Unique constraint:

```text
UNIQUE(event_id, subscriber_name)
```

This prevents the same subscriber from processing the same event twice.

### `penalties`
Created by `AlertService` for speed violations.

| Field | Type | Purpose |
|---|---|---|
| `id` | string/UUID | penalty ID |
| `event_id` | string unique | connects penalty to exact speed event |
| `camera_id` | string | camera that detected violation |
| `vehicle_plate` | string | vehicle identity |
| `speed_kmh` | int | detected speed |
| `speed_limit_kmh` | int | legal limit |
| `fine_amount` | decimal/int | penalty amount |
| `status` | enum | `ISSUED`, `CANCELLED`, `PAID` |
| `issued_at` | datetime | penalty time |

Unique constraint on `event_id` gives a second layer of duplicate protection.

### `audit_logs`
Created by `LoggingService`.

| Field | Type | Purpose |
|---|---|---|
| `id` | string/UUID | log ID |
| `event_id` | string | event reference |
| `event_type` | string | event class name |
| `message` | string | human-readable audit message |
| `payload_snapshot` | JSON/text | snapshot for legal traceability |
| `created_at` | datetime | log time |

### `dashboard_snapshots`
Created/updated by `DashboardService`.

| Field | Type | Purpose |
|---|---|---|
| `id` | string/UUID | snapshot ID |
| `intersection_name` | string | map/list grouping |
| `congestion_level` | enum | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, `CLEARED` |
| `active_vehicle_count` | int | display value |
| `last_event_id` | string | latest event |
| `updated_at` | datetime | dashboard freshness |

### `report_aggregates`
Created/updated by `ReportingService`.

| Field | Type | Purpose |
|---|---|---|
| `id` | string/UUID | row ID |
| `event_type` | string | grouped event type |
| `camera_id` | string nullable | grouped source |
| `count` | int | total events |
| `window_start` | datetime | reporting window |
| `window_end` | datetime | reporting window |

### `event_outbox`
Optional implementation table for the Outbox Pattern.

| Field | Type | Purpose |
|---|---|---|
| `id` | string/UUID | outbox row ID |
| `event_id` | string unique | event identity |
| `envelope_json` | JSON/text | whole event envelope |
| `status` | enum | `PENDING`, `PUBLISHED`, `FAILED` |
| `attempt_count` | int | retry counter |
| `last_error` | string nullable | failure reason |
| `created_at` | datetime | row creation |
| `published_at` | datetime nullable | success time |

## Prisma-style schema sketch
```prisma
model TrafficCamera {
  id               String   @id @default(uuid())
  cameraCode       String   @unique
  intersectionName String
  latitude         Float?
  longitude        Float?
  speedLimitKmh    Int
  status           String   @default("ACTIVE")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model EventEnvelopeRecord {
  eventId       String   @id
  correlationId String
  schemaVersion Int
  sourceId      String
  timestamp     DateTime
  eventType     String
  payloadJson   String
  priority      String   @default("NORMAL")
  createdAt     DateTime @default(now())
}

model ProcessedEvent {
  id             String   @id @default(uuid())
  eventId         String
  subscriberName  String
  processedAt     DateTime @default(now())

  @@unique([eventId, subscriberName])
}

model Penalty {
  id            String   @id @default(uuid())
  eventId       String   @unique
  cameraId      String
  vehiclePlate  String
  speedKmh      Int
  speedLimitKmh Int
  fineAmount    Int
  status        String   @default("ISSUED")
  issuedAt      DateTime @default(now())
}

model AuditLog {
  id              String   @id @default(uuid())
  eventId          String
  eventType        String
  message          String
  payloadSnapshot  String
  createdAt        DateTime @default(now())
}

model DashboardSnapshot {
  id                 String   @id @default(uuid())
  intersectionName   String
  congestionLevel    String
  activeVehicleCount Int      @default(0)
  lastEventId         String
  updatedAt           DateTime @updatedAt
}

model ReportAggregate {
  id          String   @id @default(uuid())
  eventType   String
  cameraId    String?
  count       Int      @default(0)
  windowStart DateTime
  windowEnd   DateTime
}

model EventOutbox {
  id           String   @id @default(uuid())
  eventId      String   @unique
  envelopeJson String
  status       String   @default("PENDING")
  attemptCount Int      @default(0)
  lastError    String?
  createdAt    DateTime @default(now())
  publishedAt  DateTime?
}
```

## DB module responsibilities

| Module | Reads | Writes | Why it exists |
|---|---|---|---|
| `EventRepository` | `event_envelopes` | `event_envelopes` | audit and replay |
| `ProcessedEventRepository` | `processed_events` | `processed_events` | idempotency |
| `PenaltyRepository` | `penalties` | `penalties` | speed violation penalty proof |
| `AuditLogRepository` | `audit_logs` | `audit_logs` | legal audit trail |
| `DashboardRepository` | `dashboard_snapshots` | `dashboard_snapshots` | live UI |
| `ReportRepository` | `report_aggregates` | `report_aggregates` | reporting service |
| `OutboxRepository` | `event_outbox` | `event_outbox` | reliability analysis / optional prototype |

## Anti-overengineering note
Do not create tables for every possible real-world traffic feature. Keep the schema aligned with the CEP marking rubric.
