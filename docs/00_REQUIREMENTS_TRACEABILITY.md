# Requirements Traceability Matrix

> Event-Driven Traffic Alert System — CEP Final · Phase 8

---

## CLO 3 — Design Patterns (30 marks total)

### Task 1 — EventBus (10 marks)

**Requirement**: Implement an EventBus that routes 4 event types to subscribed services.

| Item | Location | Evidence |
|---|---|---|
| EventBus class | `apps/api/src/domain/bus/EventBus.ts` | `Map<string, Set<IEventSubscriber>>` — O(1) lookup |
| Subscribe method | `EventBus.subscribe(eventType, subscriber)` | Stores interface reference, not concrete class |
| Publish method | `EventBus.publish(envelope)` | Async delivery to all matching subscribers |
| 4 Event Types | `apps/api/src/domain/events/EventTypes.ts` | `VehicleDetectedEvent`, `SpeedViolationEvent`, `CongestionAlertEvent`, `TrafficClearedEvent` |
| 5th type proof | `apps/api/tests/fifth-event-type.spec.ts` | `EmergencyVehicleEvent` routed with **zero changes** to EventBus |
| Tests | `eventbus.spec.ts` (7 tests) | subscribe, publish, unsubscribe, 5th type routing |
| UI Evidence | Dashboard → Subscriber Monitor | Flow diagram showing EventBus → 4 subscribers |
| API Evidence | `GET /api/subscribers` | Returns 4 subscribers with `processedCount` |

---

### Task 2 — Observer Pattern (5 marks)

**Requirement**: Subscribers implement `IEventSubscriber`. EventBus depends on the interface only.

| Item | Location | Evidence |
|---|---|---|
| `IEventSubscriber` interface | `apps/api/src/domain/subscribers/IEventSubscriber.ts` | `supportedEventTypes`, `handle(envelope)` |
| EventBus coupling | `EventBus.ts` line 20 | `private subscribers = new Map<string, Set<IEventSubscriber>>()` |
| AlertService | `apps/api/src/domain/subscribers/AlertService.ts` | `extends BaseIdempotentSubscriber implements IEventSubscriber` |
| LoggingService | `apps/api/src/domain/subscribers/LoggingService.ts` | Same pattern |
| DashboardService | `apps/api/src/domain/subscribers/DashboardService.ts` | Same pattern |
| ReportingService | `apps/api/src/domain/subscribers/ReportingService.ts` | Same pattern |
| UML Class Diagram | `docs/05_DESIGN_PATTERNS.md` | Mermaid diagram |
| Tests | `eventbus.spec.ts`, `idempotency.spec.ts` | Subscriber interface contract verified |
| UI Evidence | Dashboard → Subscriber Monitor | 4 cards + pattern explanation box |

---

### Task 3 — Event Envelope Pattern (5 marks)

**Requirement**: Every event carries exactly 7 fields (event_id, correlation_id, schema_version, source_id, timestamp, event_type, payload).

| Item | Location | Evidence |
|---|---|---|
| `EventEnvelope` type | `apps/api/src/domain/events/EventEnvelope.ts` | Exactly 7 required fields |
| `createEnvelope()` factory | `apps/api/src/domain/events/createEnvelope.ts` | Auto-generates event_id (UUID v4), timestamp (ISO 8601), schema_version = 1 |
| All tests check 7 fields | `envelope.spec.ts` (9 tests) | Each field validated independently |
| Repository stores all 7 | `repositories.spec.ts` | `PrismaEventRepository` round-trip test |
| API returns all 7 | `POST /api/events/publish` response | 201 response shown in `API_RESPONSES.md` |
| UI Evidence | Dashboard → Event Inspector → Inspect | 7 labeled fields in sidebar |

---

### Task 4 — Idempotent Receiver Pattern (10 marks)

**Requirement**: Duplicate events with the same `event_id` must not trigger duplicate business actions.

| Item | Location | Evidence |
|---|---|---|
| `BaseIdempotentSubscriber` | `apps/api/src/domain/subscribers/BaseIdempotentSubscriber.ts` | Template Method: `handle()` → checks DB → calls `process()` → marks processed |
| `ProcessedEventRepository` | `apps/api/src/infrastructure/repositories/ProcessedEventRepository.ts` | `exists(eventId, name)` + `markProcessed()` |
| DB constraint | `prisma/schema.prisma` | `ProcessedEvent @@unique([eventId, subscriberName])` |
| Second safety net | `prisma/schema.prisma` | `Penalty @unique(eventId)` |
| Idempotency tests | `idempotency.spec.ts` (10 tests) | Duplicate blocked; counter increments; per-subscriber isolation |
| Repository tests | `repositories.spec.ts` (15 tests) | DB-level unique constraint enforced |
| Live demo endpoint | `POST /api/events/publish-duplicate-speed-violation` | Returns `published_attempts: 2`, `penalties_created_for_event: 1` |
| API Evidence | `API_RESPONSES.md` | `duplicate_ignored_by_alert: 1` in response |
| UI Evidence | Dashboard → Idempotency Demo → red button | Large "2" and "1" proof numbers displayed |

---

## CLO 4 — Architectural Scenarios (30 marks total)

### Scenario 1 — Schema Evolution (10 marks)

**Requirement**: Analyse options for adding `lane_number` to `VehicleDetectedEvent` while 200 subscribers run on the old format.

| Item | Location | Evidence |
|---|---|---|
| Full ADR document | `docs/07_CLO4_ANALYSIS_ADR.md` → Scenario 1 | Problem → Decision → Consequences |
| Option A analysis | Same doc | Backward compatibility (optional field) — benefits and risks |
| Option B analysis | Same doc | Schema versioning (schema_version = 2) — benefits and risks |
| Decision with justification | Same doc | Schema versioning chosen; optional field acceptable for additive only |
| Implementation evidence | `apps/api/src/domain/events/EventTypes.ts` | `lane_number?: number` already present |
| `schema_version` field | `EventEnvelope.ts` | Field #3, defaults to 1 |
| Viva notes | `docs/08_VIVA_NOTES.md` | "CLO 4 — Scenario 1" section with Q&A |
| Word count | `07_CLO4_ANALYSIS_ADR.md` | ~350 words for Scenario 1 |

---

### Scenario 2 — Event Flood / Bounded Queue (10 marks)

**Requirement**: Design and implement a bounded queue for DashboardService (80 events/sec) under 500 events/sec load.

| Item | Location | Evidence |
|---|---|---|
| `BoundedEventQueue` class | `apps/api/src/domain/bus/BoundedEventQueue.ts` | Full implementation with priority-aware eviction |
| Priority map | Same file — `EVENT_PRIORITY` constant | CongestionAlert=4, Speed=3, Cleared=2, Vehicle=1 |
| `calculateSecondsUntilFull()` | Same file | `10000 / (500 - 80) = 23.81s` |
| `analyzeCapacity()` method | Same file | Returns full CLO 4 Scenario 2 object |
| Queue analysis API | `GET /api/queue/analysis` | Returns `secondsUntilFull: 23.81` |
| Tests (22 total) | `apps/api/tests/bounded-queue.spec.ts` | All 7 required test cases passing |
| Calculation test | `bounded-queue.spec.ts` Test 6 | `toBeCloseTo(23.81, 1)` ✅ |
| CLO 4 documentation | `docs/07_CLO4_ANALYSIS_ADR.md` → Scenario 2 | Full calculation, priority table, implementation evidence |
| Viva notes | `docs/08_VIVA_NOTES.md` | "CLO 4 — Scenario 2" section (9 Q&As) |

---

### Scenario 3 — Dual Write / Outbox Pattern (10 marks)

**Requirement**: Analyse the Dual Write Problem and the Outbox Pattern for traffic enforcement events.

| Item | Location | Evidence |
|---|---|---|
| `EventOutbox` DB table | `prisma/schema.prisma` | `status`, `payload`, `createdAt`, `publishedAt` fields |
| `OutboxRepository` | `apps/api/src/infrastructure/repositories/OutboxRepository.ts` | Full Prisma implementation |
| Full ADR document | `docs/07_CLO4_ANALYSIS_ADR.md` → Scenario 3 | Problem name, failure example, Outbox steps, cost table, domain judgement |
| Domain justification | Same doc | "Cost is worth paying for enforcement events" with legal reasoning |
| Viva notes | `docs/08_VIVA_NOTES.md` | "CLO 4 — Scenario 3" section |
| Word count | `07_CLO4_ANALYSIS_ADR.md` | ~250 words for Scenario 3 |

---

## Summary: Marks Coverage

| Task/Scenario | Marks | Status | Key Evidence |
|---|---|---|---|
| CLO 3 Task 1 — EventBus | 10 | ✅ Complete | `EventBus.ts` · 7 tests · API · UI |
| CLO 3 Task 2 — Observer Pattern | 5 | ✅ Complete | `IEventSubscriber.ts` · UML · 4 services · UI |
| CLO 3 Task 3 — Event Envelope | 5 | ✅ Complete | 7 fields · 9 tests · API · UI inspect |
| CLO 3 Task 4 — Idempotency | 10 | ✅ Complete | 20 tests · live demo · DB constraints |
| CLO 4 Scenario 1 — Schema | 10 | ✅ Complete | ADR · 350 words · viva notes |
| CLO 4 Scenario 2 — Queue | 10 | ✅ Complete | `BoundedEventQueue.ts` · 22 tests · 23.81s API |
| CLO 4 Scenario 3 — Outbox | 10 | ✅ Complete | Prisma model · repo · ADR · 250 words |
| **Total** | **60** | **✅** | |
