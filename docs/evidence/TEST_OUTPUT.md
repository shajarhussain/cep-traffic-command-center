# Test Output Evidence

> Generated: 2026-05-14 | Phase 8 Final Verification

---

## Command 1: `npm run typecheck --workspace=apps/api`

```
> api@1.0.0 typecheck
> tsc --noEmit

Exit code: 0
```

✅ **0 TypeScript errors**

---

## Command 2: `npm test --workspace=apps/api`

```
> api@1.0.0 test
> vitest run

 RUN  v3.2.4 C:/Users/user/Downloads/cep_traffic_antigravity_pack/cep_traffic_antigravity_pack/apps/api

 ✓ tests/api-routes.spec.ts        (12 tests)  10563ms
 ✓ tests/repositories.spec.ts      (15 tests)  10430ms
 ✓ tests/idempotency.spec.ts       (10 tests)    37ms
 ✓ tests/eventbus.spec.ts           (7 tests)    52ms
 ✓ tests/bounded-queue.spec.ts     (22 tests)    29ms
 ✓ tests/envelope.spec.ts           (9 tests)    20ms
 ✓ tests/fifth-event-type.spec.ts   (3 tests)    51ms

 Test Files  7 passed (7)
      Tests  78 passed (78)
   Start at  17:56:07
   Duration  33.19s (transform 796ms, setup 0ms, collect 2.80s, tests 21.18s, environment 7ms, prepare 3.95s)

Exit code: 0
```

✅ **78 / 78 tests passed**

---

## Test Coverage by Phase

| Phase | Test File | Tests | What It Proves |
|---|---|---|---|
| 1–3 | `eventbus.spec.ts` | 7 | EventBus subscribe/publish/unsubscribe; adding a 5th event type requires zero bus changes |
| 3 | `idempotency.spec.ts` | 10 | `BaseIdempotentSubscriber` blocks duplicate processing; in-memory counter increments |
| 3 | `envelope.spec.ts` | 9 | All 7 CEP fields present; UUID v4 event_id; ISO 8601 timestamp; schema_version defaults |
| 3 | `fifth-event-type.spec.ts` | 3 | EmergencyVehicleEvent routed correctly without modifying EventBus or camera code |
| 4 | `repositories.spec.ts` | 15 | `ProcessedEvent @@unique([eventId, subscriberName])`; `Penalty @unique(eventId)`; all 7 fields stored |
| 5 | `api-routes.spec.ts` | 12 | All HTTP endpoints return correct status codes and shapes; Supertest integration |
| 7 | `bounded-queue.spec.ts` | 22 | Priority eviction; 23.81s calculation; CRITICAL preserved; same-priority drops oldest |
| | **Total** | **78** | |

---

## Command 3: `npm run typecheck --workspace=apps/web`

```
> web@0.0.0 typecheck
> tsc --noEmit

Exit code: 0
```

✅ **0 TypeScript errors**

---

## Command 4: `npm run build --workspace=apps/web`

```
> web@0.0.0 build
> tsc -b && vite build

vite v8.0.12 building client environment for production...

✓ 34 modules transformed.

dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-Cwbo3m0v.css   11.83 kB │ gzip:  2.99 kB
dist/assets/index-T24C7GTB.js   237.82 kB │ gzip: 69.70 kB

✓ built in 903ms

Exit code: 0
```

✅ **Production build successful** — 237KB JS bundle, 11.8KB CSS

---

## Summary

| Check | Result |
|---|---|
| API TypeScript type check | ✅ 0 errors |
| API test suite | ✅ 78 / 78 passed |
| Web TypeScript type check | ✅ 0 errors |
| Web production build | ✅ Built in 903ms |
