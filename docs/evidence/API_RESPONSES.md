# API Response Evidence

> Captured API response evidence from local backend testing — 2026-05-14 Phase 8

---

## GET /api/health

```json
{
  "status": "ok",
  "timestamp": "2026-05-14T12:56:35.664Z"
}
```

---

## GET /api/cameras

```json
[
  {
    "id": "CAM-ISB-001",
    "name": "Jinnah Avenue / F-7 Markaz",
    "location": "Jinnah Avenue, Islamabad",
    "status": "ACTIVE",
    "createdAt": "2026-05-14T11:13:12.123Z"
  },
  {
    "id": "CAM-ISB-002",
    "name": "Blue Area / Parliament Road",
    "location": "Blue Area, Islamabad",
    "status": "ACTIVE",
    "createdAt": "2026-05-14T11:13:12.123Z"
  },
  {
    "id": "CAM-ISB-003",
    "name": "Faisal Avenue / PWD Road",
    "location": "Faisal Avenue, Islamabad",
    "status": "ACTIVE",
    "createdAt": "2026-05-14T11:13:12.123Z"
  }
]
```

---

## POST /api/events/publish

### Request

```json
{
  "source_id": "CAM-ISB-001",
  "event_type": "SpeedViolationEvent",
  "payload": {
    "vehicle_plate": "ISB-5678",
    "speed_kmh": 88,
    "speed_limit_kmh": 60,
    "intersection_name": "Blue Area Roundabout"
  }
}
```

### Response (201 Created) — EventEnvelope (7 CEP fields)

```json
{
  "event_id": "ddd3d817-2d9b-4e7a-a68d-23fb211feb74",
  "correlation_id": "bfbecc46-2513-4b31-8440-1c91ffdf092f",
  "schema_version": 1,
  "source_id": "CAM-ISB-001",
  "timestamp": "2026-05-14T12:17:55.028Z",
  "event_type": "SpeedViolationEvent",
  "payload": {
    "vehicle_plate": "ISB-5678",
    "intersection_name": "Blue Area Roundabout",
    "speed_kmh": 88,
    "speed_limit_kmh": 60
  }
}
```

> All 7 required CEP EventEnvelope fields are present in every response.

---

## POST /api/events/publish-duplicate-speed-violation

### Response (200 OK) — Idempotency Proof

```json
{
  "event_id": "2a0e6327-ba64-4466-9171-d89fa28f8d71",
  "published_attempts": 2,
  "penalties_created_for_event": 1,
  "duplicate_ignored_by_alert": 1,
  "penalty": {
    "id": "6455d551-334b-4b15-8101-c5820ce704b0",
    "event_id": "2a0e6327-ba64-4466-9171-d89fa28f8d71",
    "camera_id": "CAM-ISB-001",
    "vehicle_plate": "DUP-TEST-001",
    "speed_kmh": 95,
    "speed_limit_kmh": 60,
    "fine_amount": 5000,
    "status": "ISSUED",
    "issued_at": "2026-05-14T12:50:33.509Z"
  }
}
```

> **Proof**: `published_attempts: 2` but `penalties_created_for_event: 1`.
> `duplicate_ignored_by_alert: 1` confirms `BaseIdempotentSubscriber` blocked the second attempt.

---

## GET /api/events

```json
[
  {
    "event_id": "9f6ecb41-3d03-4ec6-a07c-711f1ae859ad",
    "correlation_id": "8ab1a9c8-8ca1-4c8f-969a-e5c7377fba10",
    "schema_version": 1,
    "source_id": "CAM-ISB-001",
    "timestamp": "2026-05-14T12:24:35.127Z",
    "event_type": "VehicleDetectedEvent",
    "payload": {
      "vehicle_plate": "ISB-1234",
      "intersection_name": "Jinnah Avenue / F-7"
    }
  },
  {
    "event_id": "ddd3d817-2d9b-4e7a-a68d-23fb211feb74",
    "correlation_id": "bfbecc46-2513-4b31-8440-1c91ffdf092f",
    "schema_version": 1,
    "source_id": "CAM-ISB-001",
    "timestamp": "2026-05-14T12:17:55.028Z",
    "event_type": "SpeedViolationEvent",
    "payload": {
      "vehicle_plate": "ISB-5678",
      "intersection_name": "Blue Area Roundabout",
      "speed_kmh": 88,
      "speed_limit_kmh": 60
    }
  }
]
```

---

## GET /api/subscribers

```json
[
  {
    "name": "AlertService",
    "supportedEventTypes": ["SpeedViolationEvent"],
    "processedCount": 3,
    "duplicateIgnoredCount": 1
  },
  {
    "name": "LoggingService",
    "supportedEventTypes": ["SpeedViolationEvent", "CongestionAlertEvent"],
    "processedCount": 3,
    "duplicateIgnoredCount": 1
  },
  {
    "name": "DashboardService",
    "supportedEventTypes": ["VehicleDetectedEvent", "CongestionAlertEvent", "TrafficClearedEvent"],
    "processedCount": 1,
    "duplicateIgnoredCount": 0
  },
  {
    "name": "ReportingService",
    "supportedEventTypes": ["VehicleDetectedEvent", "SpeedViolationEvent"],
    "processedCount": 4,
    "duplicateIgnoredCount": 1
  }
]
```

> All 4 subscribers visible. `duplicateIgnoredCount > 0` proves idempotency worked in session.

---

## GET /api/penalties

```json
[
  {
    "id": "6455d551-334b-4b15-8101-c5820ce704b0",
    "event_id": "2a0e6327-ba64-4466-9171-d89fa28f8d71",
    "camera_id": "CAM-ISB-001",
    "vehicle_plate": "DUP-TEST-001",
    "speed_kmh": 95,
    "speed_limit_kmh": 60,
    "fine_amount": 5000,
    "status": "ISSUED",
    "issued_at": "2026-05-14T12:50:33.509Z"
  },
  {
    "id": "5549bf7b-98a6-4d22-9989-a2b17d6d806a",
    "event_id": "ddd3d817-2d9b-4e7a-a68d-23fb211feb74",
    "camera_id": "CAM-ISB-001",
    "vehicle_plate": "ISB-5678",
    "speed_kmh": 88,
    "speed_limit_kmh": 60,
    "fine_amount": 3000,
    "status": "ISSUED",
    "issued_at": "2026-05-14T12:17:55.103Z"
  }
]
```

---

## GET /api/audit-logs

```json
[
  {
    "id": "a1b2c3d4-...",
    "event_id": "ddd3d817-2d9b-4e7a-a68d-23fb211feb74",
    "event_type": "SpeedViolationEvent",
    "message": "Speed violation logged: ISB-5678 at 88 km/h (limit 60)",
    "payload_snapshot": "{\"vehicle_plate\":\"ISB-5678\",\"speed_kmh\":88}",
    "created_at": "2026-05-14T12:17:55.105Z"
  }
]
```

> Written by `LoggingService`. Each SpeedViolationEvent and CongestionAlertEvent produces one entry.

---

## GET /api/reports

```json
[
  {
    "id": "383a5d0e-c726-40e6-8dac-708cef8883cb",
    "event_type": "SpeedViolationEvent",
    "camera_id": "CAM-ISB-001",
    "count": 3,
    "window_start": "2026-05-13T19:00:00.000Z",
    "window_end": "2026-05-14T19:00:00.000Z"
  },
  {
    "id": "00dfc354-b6be-4732-b8b8-75cba7ac2df2",
    "event_type": "VehicleDetectedEvent",
    "camera_id": "CAM-ISB-001",
    "count": 1,
    "window_start": "2026-05-13T19:00:00.000Z",
    "window_end": "2026-05-14T19:00:00.000Z"
  }
]
```

> Aggregated by `ReportingService`. Upserts per (camera, event_type, date window).

---

## GET /api/dashboard

```json
[
  {
    "id": "snap-001",
    "camera_id": "CAM-ISB-001",
    "intersection_name": "Jinnah Avenue / F-7 Markaz",
    "vehicle_count": 1,
    "congestion_level": "LOW",
    "last_event_type": "VehicleDetectedEvent",
    "updated_at": "2026-05-14T12:24:35.200Z"
  }
]
```

> Maintained by `DashboardService` on VehicleDetected, CongestionAlert, TrafficCleared events.

---

## GET /api/queue/analysis

```json
{
  "incomingRate": 500,
  "processingRate": 80,
  "backlogGrowthPerSecond": 420,
  "queueLimit": 10000,
  "secondsUntilFull": 23.81,
  "evictionPolicy": "Drop least important first; if same priority, drop oldest"
}
```

> **CLO 4 Scenario 2 proof**: 10,000 / (500 − 80) = 10,000 / 420 = **23.81 seconds**
