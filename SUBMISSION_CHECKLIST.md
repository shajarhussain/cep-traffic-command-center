# Submission Checklist

> Event-Driven Traffic Alert System — CEP Final Submission
> Software Design and Architecture

---

## ✅ CLO 3 — Design Patterns

### Task 1 — EventBus (10 marks)

- [x] `EventBus.ts` implemented with `Map<string, Set<IEventSubscriber>>`
- [x] `subscribe()`, `unsubscribe()`, `publish()` methods working
- [x] All 4 event types defined in `EventTypes.ts`
- [x] 5th event type (`EmergencyVehicleEvent`) routed without any EventBus changes
- [x] 7 tests in `eventbus.spec.ts` — all passing
- [x] 3 tests in `fifth-event-type.spec.ts` — all passing
- [x] API: `GET /api/subscribers` returns 4 services with `processedCount`
- [x] UI: Subscriber Monitor shows EventBus flow diagram

### Task 2 — Observer Pattern (5 marks)

- [x] `IEventSubscriber` interface defined with `supportedEventTypes` and `handle()`
- [x] `EventBus` stores `Set<IEventSubscriber>` — no concrete class references
- [x] All 4 services implement `IEventSubscriber` via `BaseIdempotentSubscriber`
- [x] Mermaid UML class diagram in `docs/05_DESIGN_PATTERNS.md`
- [x] UI: Subscriber Monitor shows Observer Pattern flow with interface labels

### Task 3 — Event Envelope Pattern (5 marks)

- [x] `EventEnvelope` type has exactly 7 fields
- [x] `createEnvelope()` auto-generates `event_id`, `timestamp`, sets `schema_version = 1`
- [x] 9 tests in `envelope.spec.ts` — each of the 7 fields verified
- [x] `POST /api/events/publish` response shows all 7 fields
- [x] UI: Event Inspector "Inspect" sidebar labels all 7 fields individually
- [x] Evidence: `docs/evidence/API_RESPONSES.md`

### Task 4 — Idempotent Receiver Pattern (10 marks)

- [x] `BaseIdempotentSubscriber` abstract class with Template Method
- [x] `ProcessedEventRepository` with `exists()` and `markProcessed()`
- [x] DB: `ProcessedEvent @@unique([eventId, subscriberName])`
- [x] DB: `Penalty @unique(eventId)` — second safety net
- [x] 10 tests in `idempotency.spec.ts` — all passing
- [x] 6 tests in `repositories.spec.ts` for `ProcessedEventRepository`
- [x] Live demo: `POST /api/events/publish-duplicate-speed-violation` → `published_attempts: 2`, `penalties_created_for_event: 1`
- [x] UI: Idempotency Demo shows large "2" and "1" proof numbers
- [x] Evidence: screenshot of demo + API response in `API_RESPONSES.md`

---

## ✅ CLO 4 — Architectural Scenarios

### Scenario 1 — Schema Evolution (10 marks)

- [x] Two options analysed: backward compatibility vs schema versioning
- [x] ADR format: Problem → Decision → Consequences
- [x] Decision made with justification (schema versioning for enforcement systems)
- [x] Implementation evidence: `lane_number?` in `EventTypes.ts`; `schema_version` in envelope
- [x] Minimum 200 words — verified (~350 words)
- [x] Viva notes Q&A in `docs/08_VIVA_NOTES.md`
- [x] File: `docs/07_CLO4_ANALYSIS_ADR.md` → Scenario 1

### Scenario 2 — Event Flood / Bounded Queue (10 marks)

- [x] Calculation shown: 10,000 / (500 − 80) = **23.81 seconds**
- [x] `BoundedEventQueue.ts` implemented
- [x] `EVENT_PRIORITY` map defined externally (not in EventEnvelope)
- [x] Priority-aware eviction: CongestionAlert (4) → Speed (3) → Cleared (2) → Vehicle (1)
- [x] Tiebreak: same priority → drop oldest
- [x] `calculateSecondsUntilFull()` helper function
- [x] `analyzeCapacity()` method returns full analysis object
- [x] `GET /api/queue/analysis` returns `secondsUntilFull: 23.81` ← **verified live**
- [x] 22 tests in `bounded-queue.spec.ts` — all 7 required cases passing
- [x] CLO 4 documentation in `docs/07_CLO4_ANALYSIS_ADR.md` → Scenario 2
- [x] Viva notes Q&A in `docs/08_VIVA_NOTES.md`

### Scenario 3 — Dual Write / Outbox Pattern (10 marks)

- [x] Problem named: **Dual Write Problem**
- [x] Concrete failure example described (penalty created, audit log missing)
- [x] Outbox Pattern explained: local DB write → background relay → retry
- [x] Cost analysed: extra table, worker, retry logic, eventual consistency
- [x] Domain justification: legal auditability for enforcement events
- [x] Minimum 150 words — verified (~250 words)
- [x] `EventOutbox` model in `prisma/schema.prisma`
- [x] `OutboxRepository.ts` implemented
- [x] Viva notes Q&A in `docs/08_VIVA_NOTES.md`
- [x] File: `docs/07_CLO4_ANALYSIS_ADR.md` → Scenario 3

---

## ✅ Technical Quality

- [x] TypeScript strict mode throughout
- [x] `npm run typecheck --workspace=apps/api` → exit 0
- [x] `npm run typecheck --workspace=apps/web` → exit 0
- [x] `npm run build --workspace=apps/web` → exit 0 (built in 903ms)
- [x] `npm test --workspace=apps/api` → **78 / 78 passed**
- [x] No `any` types in domain layer
- [x] Monorepo with npm workspaces (no nested `node_modules` conflicts)
- [x] SQLite + Prisma — zero external DB dependency

---

## ✅ Documentation

- [x] `README.md` — complete setup, run, test, API reference, demo flow
- [x] `docs/00_REQUIREMENTS_TRACEABILITY.md` — full traceability matrix
- [x] `docs/01_ARCHITECTURE.md` — system architecture overview
- [x] `docs/05_DESIGN_PATTERNS.md` — UML + pattern explanations
- [x] `docs/06_TEST_PLAN.md` — every test case documented
- [x] `docs/07_CLO4_ANALYSIS_ADR.md` — all 3 CLO 4 scenarios
- [x] `docs/08_VIVA_NOTES.md` — viva Q&A reference
- [x] `docs/evidence/TEST_OUTPUT.md` — verbatim final test run output
- [x] `docs/evidence/API_RESPONSES.md` — all 11 endpoints with real responses
- [x] `SUBMISSION_CHECKLIST.md` — this file

---

## ✅ UI Dashboard (Phase 6)

- [x] Dark command-center design (not Vite default)
- [x] Command Center (Overview) with system stats and camera list
- [x] Alert Simulator — all 4 event types with realistic payloads
- [x] Duplicate Alert Safety (Idempotency) — **2 publish attempts → 1 penalty** (most important demo)
- [x] Live Alert Stream (Event Inspector) — all 7 envelope fields in labeled sidebar
- [x] Processing Services (Subscriber Monitor) — 4 cards + mesh flow
- [x] Enforcement (Penalties) — table with speed, fine, plate, event_id
- [x] Audit Trail — immutable ledger table
- [x] Traffic Reports — summary stat cards + analytics table
- [x] Intersection Status — live dashboard state cards
- [x] System Health (Architecture) — operational flow and mesh status

---

## ⚠️ Known Limitations / Out of Scope

| Item | Status |
|---|---|
| Outbox relay process | Not implemented — prototype only (table + repo exist) |
| BoundedQueue in live event pipeline | Implemented as domain class + tests; not wired into publish flow |
| Authentication | Out of scope — CEP requirement not stated |
| Production DB (PostgreSQL) | SQLite sufficient for CEP evaluation |
| Docker / cloud deployment | Out of scope |
| Automated UI tests | Manual browser verification + screenshots captured |

---

## Final Counts

| Item | Count |
|---|---|
| Test files | 7 |
| Tests passing | **78 / 78** |
| API endpoints | 11 |
| UI pages | 10 |
| Prisma models | 8 |
| Domain subscriber services | 4 |
| EventEnvelope fields | 7 |
| CLO 4 scenarios documented | 3 |
| Documentation files | 10+ |
