# Viva Notes — Simple Answers

> CEP Project — Event-Driven Traffic Alert System · Phase 7 Updated

---

## Core Architecture

### What is Event-Driven Architecture in this project?
Traffic cameras publish events to an EventBus. Services subscribe to the events they care
about. The camera does not know which service will receive the event.

### Why did you use EventBus?
It decouples publishers from subscribers. Adding a new service later does not require
changing camera code.

### What are the four required event types?
1. `VehicleDetectedEvent`
2. `SpeedViolationEvent`
3. `CongestionAlertEvent`
4. `TrafficClearedEvent`

### Which services subscribe to which event?
| Event | Subscribers |
|---|---|
| VehicleDetectedEvent | DashboardService, ReportingService |
| SpeedViolationEvent | AlertService, LoggingService, ReportingService |
| CongestionAlertEvent | DashboardService, LoggingService |
| TrafficClearedEvent | DashboardService |

---

## Design Patterns

### What is Observer Pattern here?
The EventBus is the subject/publisher. Services are observers/subscribers. All subscribers
implement `IEventSubscriber`, so the bus depends on an interface instead of concrete classes.

### Why does the bus store interface references?
Because it should not depend on specific classes. This improves flexibility and follows
the Dependency Inversion Principle.

### What is Event Envelope Pattern?
It wraps the payload with metadata: event ID, correlation ID, source, timestamp, version, and
event type. Every event carries all 7 fields regardless of its content type.

### Why do we need `event_id`?
To uniquely identify an event and prevent duplicate processing by the Idempotent Receiver.

### What is Idempotent Receiver Pattern?
It means a receiver can safely receive the same event more than once without repeating the
business action. In this project, `AlertService` checks whether it already processed the
`event_id` before creating a penalty.

### How is idempotency enforced?
At two levels:
1. **Application layer**: `BaseIdempotentSubscriber.handle()` checks `ProcessedEventRepository.exists()` before calling `process()`.
2. **Database layer**: `ProcessedEvent @@unique([eventId, subscriberName])` rejects any second insert.

### What proof did you implement for idempotency?
The same `SpeedViolationEvent` with the same `event_id` is published twice. AlertService
creates only one penalty notice. The UI "Idempotency Demo" shows: 2 attempts → 1 penalty.

### How can you add a fifth event without changing camera code?
Because the camera uses a generic `publish(envelope)` method. A new event type only requires
a new payload interface and a subscriber — zero changes to CameraSimulator or EventBus.

---

## CLO 4 — Scenario 1: Schema Evolution

### What is the schema evolution scenario?
A new field `lane_number` must be added to `VehicleDetectedEvent` while 200 subscribers
still run on the old format.

### What are the two options?
1. **Backward compatibility**: add `lane_number?` as optional. Old subscribers continue.
2. **Schema versioning**: create `VehicleDetectedEvent_v2` with `schema_version = 2`.
   Old subscribers check the version and reject or skip if they do not understand it.

### Which did you choose and why?
For this project, schema versioning is the primary recommendation for a traffic enforcement
system because:
- Subscribers can **explicitly reject** unknown versions instead of silently ignoring fields.
- Lane attribution is new enforcement behavior, not just metadata.
- `schema_version` is already field #3 in every `EventEnvelope`.

The optional field approach is acceptable for purely additive changes with no behavioral
impact. But for legal enforcement events, explicit versioning is safer.

### What does the implementation show?
`VehicleDetectedPayload` already includes `lane_number?: number` (optional). The
`schema_version` field in `EventEnvelope` is designed to support this exact evolution.

---

## CLO 4 — Scenario 2: Bounded Queue

### What happens if too many events arrive?
The bounded queue stops unlimited memory growth. When full, it evicts the least important
event to make room for the incoming event.

### Show me the exact calculation.
```
Incoming rate         = 500 events/second
DashboardService rate =  80 events/second
Backlog growth        = 500 − 80 = 420 events/second
Queue limit           = 10,000 events
Time until full       = 10,000 / 420 ≈ 23.81 seconds
```

### Where is this verified?
- `calculateSecondsUntilFull(500, 80, 10_000)` in `BoundedEventQueue.ts` returns `23.81`.
- `bounded-queue.spec.ts` Test 6 asserts `toBeCloseTo(23.81, 1)`.
- `GET /api/queue/analysis` returns `secondsUntilFull: 23.81` at runtime.

### What is the eviction policy?
**Drop least important first. If same priority, drop oldest.**

Priority levels (not stored in EventEnvelope — derived externally from `event_type`):
| Priority | Event Type |
|---|---|
| 4 — CRITICAL | `CongestionAlertEvent` |
| 3 — HIGH | `SpeedViolationEvent` |
| 2 — MEDIUM | `TrafficClearedEvent` |
| 1 — LOW | `VehicleDetectedEvent` |

### Why not always drop the oldest event?
Because an old critical congestion alert is more important than a new routine vehicle
detection. Priority-aware eviction preserves safety-critical information.

### Why is priority NOT stored in EventEnvelope?
The 7-field `EventEnvelope` is a CEP requirement — adding an 8th field would violate the
contract. Priority is an operational concern of the queue, not of the event itself.
`getEventPriority(event_type)` maps type to priority without touching the envelope.

### Where is `BoundedEventQueue` implemented?
`apps/api/src/domain/bus/BoundedEventQueue.ts`

### How many tests cover it?
22 tests in `bounded-queue.spec.ts`, covering:
- Priority map correctness
- `calculateSecondsUntilFull` including the 23.81s result
- Constructor validation
- Capacity enforcement (never exceeds maxSize)
- LOW evicted before HIGH
- CRITICAL CongestionAlert preserved
- Same-priority drops oldest
- `analyzeCapacity()` API response
- dequeue/peek/drain/clear utility methods

---

## CLO 4 — Scenario 3: Dual Write Problem and Outbox Pattern

### What is the Dual Write Problem?
It occurs when one logical operation must write to two separate targets, and one succeeds
while the other fails.

**Concrete example:** `AlertService` creates a penalty notice successfully, then
`LoggingService` crashes before writing the audit log. A fine exists without a legal record.

### Why is that dangerous in a traffic system?
Because speed penalties are legally binding. A penalty without an audit trail may be
inadmissible in a dispute or tribunal. The enforcement authority cannot prove what happened
or when.

### What is the Outbox Pattern?
1. The camera writes the event to a local **`EventOutbox`** table in the **same DB transaction**
   as any business state change.
2. A **background relay** polls for `status = PENDING` entries and publishes them to the bus.
3. If publishing fails, the row stays PENDING and is **retried**.

Because outbox and business data share one ACID transaction:
- Both succeed, or both fail — no inconsistency.
- The relay can re-run safely — penalty creation is idempotent.

### What is the cost of the Outbox Pattern?
| Cost | Impact |
|---|---|
| Extra `EventOutbox` table | More storage and cleanup logic |
| Background relay process | More deployment complexity |
| Retry logic | More code, possible duplicate-handling |
| Slight delay | Events publish asynchronously, not immediately |

### Is it worth it here?
**Yes, for enforcement events.** The added complexity buys legal auditability and reliable
evidence chains. For casual dashboard updates, direct publishing may be acceptable.

### Where is it implemented?
- `EventOutbox` model in `prisma/schema.prisma`
- `OutboxRepository.ts` — interface and Prisma implementation
- Full relay logic is Phase 8

---

## Quick Reference — File Locations

| Component | File |
|---|---|
| EventBus | `apps/api/src/domain/bus/EventBus.ts` |
| BoundedEventQueue | `apps/api/src/domain/bus/BoundedEventQueue.ts` |
| EventEnvelope (7 fields) | `apps/api/src/domain/events/EventEnvelope.ts` |
| BaseIdempotentSubscriber | `apps/api/src/domain/subscribers/BaseIdempotentSubscriber.ts` |
| AlertService | `apps/api/src/domain/subscribers/AlertService.ts` |
| Prisma schema (8 models) | `prisma/schema.prisma` |
| CLO4 full analysis | `docs/07_CLO4_ANALYSIS_ADR.md` |
| Queue analysis endpoint | `GET http://localhost:4000/api/queue/analysis` |
| Idempotency demo UI | Dashboard → "Idempotency Demo" → red button |
