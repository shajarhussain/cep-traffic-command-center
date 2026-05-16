# Test Plan

> Event-Driven Traffic Alert System · Phase 8 Final

---

## Test Strategy

| Concern | Strategy |
|---|---|
| Domain logic | Pure unit tests (no DB, no HTTP) |
| DB constraints | Vitest integration tests against `test.db` |
| HTTP endpoints | Supertest integration tests against real Express app |
| Bounded queue | Unit tests — pure in-memory, no dependencies |
| Types | `tsc --noEmit` on both API and Web workspaces |
| Frontend build | `tsc -b && vite build` on Web workspace |

**Database isolation**: `fileParallelism: false` in `vitest.config.ts` prevents SQLite lock
contention. Each spec file that needs the DB uses `beforeEach` → `cleanTestDb()` and
`afterAll` → `disconnectTestPrisma()`. The `hookTimeout: 60_000` prevents `prisma db push`
from timing out on first run.

---

## Test Files and Coverage

### `eventbus.spec.ts` — 7 tests

| Test | What it proves |
|---|---|
| subscribe + publish delivers to subscriber | Core bus routing |
| event not delivered to unregistered type | Type filtering |
| multiple subscribers on same type all receive event | Fan-out |
| unsubscribe stops delivery | Cleanup |
| 5th event type works without bus changes | Extensibility (CLO 3 Task 1) |
| getSubscriberCount() returns correct count | Diagnostic API |
| getRegisteredEventTypes() lists active types | Diagnostic API |

### `envelope.spec.ts` — 9 tests

| Test | What it proves |
|---|---|
| event_id is a valid UUID v4 | CEP field requirement |
| correlation_id is a valid UUID v4 | CEP field requirement |
| schema_version defaults to 1 | CEP field requirement |
| source_id matches input | CEP field requirement |
| timestamp is valid ISO 8601 | CEP field requirement |
| event_type matches input | CEP field requirement |
| payload matches input | CEP field requirement |
| custom event_id is preserved when provided | Idempotency support |
| all 7 fields present in output object | Full envelope contract |

### `idempotency.spec.ts` — 10 tests

| Test | What it proves |
|---|---|
| First handle() calls process() | Template Method — first path |
| Second handle() with same event_id skips process() | Idempotent Receiver |
| duplicateIgnoredCount increments on duplicate | In-memory counter |
| Different event_id → new process() call | Per-event tracking |
| Different subscriber → independent processing | Per-subscriber uniqueness |
| Third+ handle() still skips | Multiple duplicate resistance |
| Async process() completes before markProcessed() | Ordering guarantee |
| Error in process() does not mark as processed | Rollback safety |
| handle() awaits process() | Async contract |
| duplicateIgnoredCount starts at 0 | Initial state |

### `fifth-event-type.spec.ts` — 3 tests

| Test | What it proves |
|---|---|
| EmergencyVehicleEvent subscriber receives event | 5th type routing |
| Other subscribers do not receive it | Type isolation |
| EventBus required zero code changes | Extensibility (CLO 3 Task 1) |

### `repositories.spec.ts` — 15 tests (integration — real SQLite)

| Group | Tests | What it proves |
|---|---|---|
| PrismaProcessedEventRepository | 6 | `@@unique([eventId, subscriberName])` — same event/different sub = allowed; same = rejected |
| PrismaPenaltyRepository | 4 | `@unique(eventId)` — duplicate penalty rejected; findAll/count work |
| PrismaEventRepository | 5 | All 7 fields stored and retrieved; findById null for missing; duplicate eventId rejected |

### `api-routes.spec.ts` — 12 tests (Supertest integration)

| Endpoint | Tests |
|---|---|
| `GET /api/health` | 1 — status 200, body `{status: "ok"}` |
| `POST /api/events/publish` | 3 — valid request → 201 + envelope; missing fields → 400; invalid type → 400 |
| `POST /api/events/publish-duplicate-speed-violation` | 1 — 200, proof object |
| `GET /api/events` | 1 — array response |
| `GET /api/cameras` | 1 — array response |
| `GET /api/subscribers` | 1 — 4 subscribers with expected shape |
| `GET /api/penalties` | 1 — array response |
| `GET /api/audit-logs` | 1 — array response |
| `GET /api/reports` | 1 — array response |
| `GET /api/dashboard` | 1 — array response |

### `bounded-queue.spec.ts` — 22 tests

| Group | Tests | What it proves |
|---|---|---|
| EVENT_PRIORITY map | 5 | Correct priority values; unknown type → 0 |
| calculateSecondsUntilFull | 3 | 23.81s result; Infinity when keeping up; linear scaling |
| Constructor | 2 | Rejects non-positive maxSize; starts empty |
| Capacity enforcement (Tests 1 & 2) | 2 | Never exceeds maxSize |
| Priority-aware eviction (Test 3) | 2 | LOW evicted; LOW incoming rejected when queue full of HIGH |
| CRITICAL preservation (Test 4) | 2 | CongestionAlert not evicted when Vehicle available |
| Same-priority age (Test 5) | 1 | Oldest evicted; newest survives |
| analyzeCapacity() (Test 6) | 2 | Correct values; evictionPolicy string validated |
| Utility methods | 3 | dequeue FIFO; peek non-destructive; clear empties |

---

## Final Test Run Results (Phase 8)

```
Test Files  7 passed (7)
     Tests  78 passed (78)
  Duration  33.19s
Exit code:  0
```

**All 78 tests pass. No skipped. No failed.**

---

## Coverage Notes

- `BoundedEventQueue` is pure domain logic — 100% covered by unit tests, no mocks.
- Prisma repositories covered by real DB integration tests — no in-memory mocking.
- API routes covered by Supertest — full HTTP stack exercised.
- Frontend has no automated tests (UI verified manually via browser + screenshots).
