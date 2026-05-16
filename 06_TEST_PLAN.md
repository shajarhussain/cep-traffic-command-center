# Test Plan

The test plan must prove marks, not just test random UI behavior.

## Unit tests

### Test 1 — EventBus delivers to every subscriber
```text
Given DashboardService and ReportingService subscribe to VehicleDetectedEvent
When VehicleDetectedEvent is published
Then both subscribers process the event once
```

### Test 2 — EventBus does not deliver to unrelated subscribers
```text
Given AlertService subscribes only to SpeedViolationEvent
When VehicleDetectedEvent is published
Then AlertService does not create a penalty
```

### Test 3 — Unsubscribe works
```text
Given LoggingService is subscribed to CongestionAlertEvent
When LoggingService unsubscribes
And CongestionAlertEvent is published
Then LoggingService does not write a new audit log
```

### Test 4 — EventEnvelope contains all required fields
```text
Given a camera creates SpeedViolationEvent
When createEnvelope is called
Then the envelope has event_id, correlation_id, schema_version, source_id, timestamp, event_type, payload
```

### Test 5 — Idempotent receiver prevents duplicate penalty
```text
Given one SpeedViolationEvent envelope with fixed event_id
When EventBus publishes the exact same envelope twice
Then AlertService creates one penalty only
```

### Test 6 — Duplicate is tracked per subscriber
```text
Given SpeedViolationEvent is sent twice
Then AlertService processes it once
And LoggingService processes it once
And ReportingService processes it once
```

### Test 7 — Fifth event type requires no camera change
```text
Given a new EmergencyVehicleEvent type
When a camera publishes the generic envelope
Then EventBus accepts it without changing CameraSimulator.publish logic
```

### Test 8 — Bounded queue does not exceed maximum size
```text
Given max queue size is 10000
When 10050 events are enqueued
Then queue size remains 10000
```

### Test 9 — Priority eviction keeps critical event
```text
Given queue is full of LOW events
When one CRITICAL CongestionAlertEvent arrives
Then one LOW event is dropped
And CRITICAL event is kept
```

## Integration tests

### Flow A — Speed violation full flow
1. Create camera.
2. Publish speed violation.
3. Verify event envelope stored.
4. Verify penalty created.
5. Verify audit log created.
6. Verify report count increased.

### Flow B — Duplicate speed violation full flow
1. Publish speed violation with fixed `event_id`.
2. Publish the same envelope again.
3. Verify penalty count for that `event_id` is `1`.
4. Verify duplicate ignored count increases.

### Flow C — Congestion flow
1. Publish congestion alert.
2. Dashboard shows congestion level.
3. Audit log is written.
4. Publish traffic cleared.
5. Dashboard status becomes cleared.

## UI demo tests

| UI screen | Demo action | Expected proof |
|---|---|---|
| Camera Simulator | publish vehicle detected | event appears in timeline and report counter |
| Camera Simulator | publish speed violation | penalty appears |
| Camera Simulator | duplicate speed violation | only one penalty |
| Subscriber Monitor | unsubscribe LoggingService | logs stop receiving event |
| Queue Lab | flood queue | max size is preserved |
| Architecture page | show UML | Observer Pattern evidence |

## Suggested npm scripts
```json
{
  "scripts": {
    "dev": "concurrently "npm run dev:api" "npm run dev:web"",
    "dev:api": "cd apps/api && npm run dev",
    "dev:web": "cd apps/web && npm run dev",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

## Screenshot checklist for final report
1. Dashboard overview after events are published.
2. Event envelope inspector showing all 7 fields.
3. Subscriber monitor showing four subscribers.
4. UML class diagram.
5. Penalty table after speed violation.
6. Duplicate speed violation proof showing one penalty only.
7. Queue lab calculation and bounded queue result.
8. Test terminal output showing passing tests.
