# Viva Notes — Predicted Questions & Bullet Answers

> **CEP — Event-Driven Traffic Alert System** · Individual Viva Cheat Sheet
> 25 predicted examiner questions, organized by topic. Each answer is 2–4 short bullets you can speak naturally.
> Companion to [09_RUBRIC_EXPLANATION.md](09_RUBRIC_EXPLANATION.md) and [11_PERSONAL_EXPLANATION.md](11_PERSONAL_EXPLANATION.md).

---

## A · Foundational Questions (5)

### Q1. What is Event-Driven Architecture?
- A style where components (publishers) emit events without knowing who consumes them, and consumers (subscribers) react to events without knowing who produced them.
- The two sides are connected only through an event channel (in our case, the EventBus).
- **Contrast:** in request-response, the caller blocks waiting for a reply. In event-driven, the publisher fires-and-forgets.

### Q2. Why use event-driven for a traffic system?
- Cameras emit at high volume; many services need the same data for different reasons (alert, log, dashboard, report).
- Decoupling: a service can crash or be added without changing the cameras.
- **Show:** point to `EventBus.ts` — it imports zero subscriber classes.

### Q3. What's the difference between event-driven and pub/sub?
- Pub/Sub is the messaging pattern; event-driven is the architectural style that uses it.
- Our `EventBus` is a Pub/Sub implementation: publishers call `publish()`, subscribers call `subscribe()`.

### Q4. Why use design patterns at all here?
- Patterns are vocabulary for known solutions. Observer + Idempotent Receiver + Event Envelope = a vocabulary the examiner already knows.
- Using them means our design choices are defensible from textbook authority, not just personal preference.

### Q5. Walk me through one event's full journey.
- Camera detects → wraps payload in `EventEnvelope` (7 fields) → calls `bus.publish(envelope)` → bus looks up `Set<IEventSubscriber>` for that event type → calls `subscriber.handle(envelope)` on each.
- Each subscriber: checks `event_id` in `ProcessedEvent` table → if new, calls `process()` → marks processed.
- **Show:** UML sequence diagram in `docs/uml/03_sequence_idempotent_duplicate.md`.

---

## B · Observer Pattern (4)

### Q6. Why interface (IEventSubscriber), not the concrete class?
- The bus would need a giant `if/else` if it knew concrete classes. With an interface, it iterates uniformly.
- Adding a new subscriber requires zero changes to the bus. That's the Open/Closed Principle in action.
- **Show:** `EventBus.ts` line 20 — `Map<string, Set<IEventSubscriber>>`. No concrete class imported.

### Q7. How would you add a 5th subscriber for ambulances?
- Create `EmergencyService extends BaseIdempotentSubscriber`, set `supportedEventTypes = ["EmergencyVehicleEvent"]`, implement `process()`.
- Wire it in `systemContext.ts` with `bus.subscribe("EmergencyVehicleEvent", emergencyService)`.
- **Zero changes** to EventBus or any other subscriber.

### Q8. Show me where the bus stores subscribers.
- Open `apps/api/src/domain/bus/EventBus.ts` line 20.
- It's `private subscribers = new Map<string, Set<IEventSubscriber>>()` — a Map keyed by event type, value is a Set of interface references.

### Q9. What if a subscriber throws an error mid-publish?
- Currently `publish()` awaits each handler in sequence — an error propagates up.
- The Outbox Pattern is our production fix: the relay retries failed publishes, and idempotency ensures retries are safe.

---

## C · Event Envelope (3)

### Q10. Why exactly 7 fields and not more?
- The CEP PDF explicitly lists 7. Adding an 8th would violate the contract.
- **Trap question:** "Why not put priority in the envelope?" → Answer: priority is queue concern, not envelope concern. Separation of concerns. `BoundedEventQueue` derives it from `event_type`.

### Q11. Difference between event_id and correlation_id?
- `event_id` — unique to ONE event instance (UUID v4). Used for idempotency.
- `correlation_id` — same across MULTIPLE related events (e.g., one vehicle's full journey across intersections).
- **Example:** a car passes through 3 intersections → 3 events, 3 different `event_id` values, 1 shared `correlation_id`.

### Q12. Why schema_version starts at 1, not 0?
- Convention: version 0 implies "unversioned" or "pre-release". Starting at 1 makes the contract explicit from day one.
- It also gives a clean upgrade path: today's events are v1; tomorrow's `lane_number` change can ship as v2.

---

## D · Idempotency (4)

### Q13. What happens if the same SpeedViolationEvent arrives twice?
- AlertService's `handle()` checks `ProcessedEvent` table: row exists for this `event_id`.
- Returns silently, increments `duplicateIgnoredCount`. `process()` is never called.
- **Result:** only 1 penalty inserted, not 2.
- **Show:** click the red "Idempotency Demo" button in the dashboard.

### Q14. Show me the test that proves it.
- File: [apps/api/tests/idempotency.spec.ts](apps/api/tests/idempotency.spec.ts).
- The key test publishes the same envelope twice and asserts `Penalty.count() === 1`.
- 10 tests in this file; all green.

### Q15. Why per-subscriber tracking, not per-event?
- Multiple subscribers handle the same event (AlertService and LoggingService both listen to SpeedViolation).
- Per-subscriber tracking lets each one process the event exactly once, independently.
- Schema: `ProcessedEvent @@unique([eventId, subscriberName])`.

### Q16. What if the in-memory check fails (e.g., race condition)?
- Double safety net: DB constraint `Penalty @unique(eventId)` blocks the second insert at the database level.
- Even if two `handle()` calls race past the application check, the DB rejects the duplicate.

---

## E · Schema Evolution / Scenario 1 (3)

### Q17. Why did you choose Option B (schema versioning) over Option A?
- Option A (optional field) risks silent data loss — subscribers may ignore the new field without anyone noticing.
- Option B forces explicit version handling: a v1 subscriber rejects v2 events, so we KNOW we have a coverage gap.
- For enforcement, silent gaps in penalty data are a legal liability. Versioning is safer.

### Q18. What breaks if a v1 subscriber receives a v2 event?
- If we use Option A: it silently strips the unknown field → incomplete data → potentially invalid penalty records.
- If we use Option B: it does `if (envelope.schema_version !== 1) return` → explicitly skips, no silent damage.

### Q19. Show me the ADR.
- File: [docs/07_CLO4_ANALYSIS_ADR.md](07_CLO4_ANALYSIS_ADR.md) → Scenario 1.
- Three parts: Problem, Decision, Consequences. Roughly 350 words (exceeds 200-word rubric minimum).

---

## F · Bounded Queue / Scenario 2 (3)

### Q20. Calculate the 23.81 seconds on the board.
- Incoming: 500/sec. Processing: 80/sec. Backlog growth: 500 − 80 = 420/sec.
- Queue limit: 10,000. Time until full: 10,000 ÷ 420 = **23.8095… ≈ 23.81 seconds**.
- **Verified in code:** `calculateSecondsUntilFull(500, 80, 10000)` returns 23.81. Test 6 in `bounded-queue.spec.ts` asserts `toBeCloseTo(23.81, 1)`.

### Q21. Why drop least-important first instead of oldest (FIFO)?
- Pure FIFO could discard a CRITICAL CongestionAlert (e.g., a stadium emergency) in favor of a routine VehicleDetected.
- Priority-aware eviction preserves the events that matter: CongestionAlert (4) > SpeedViolation (3) > TrafficCleared (2) > VehicleDetected (1).
- **Tiebreak:** if two events share priority, drop the OLDEST. Newer events better reflect current road state.

### Q22. What if congestion alerts get evicted anyway because the queue is full of them?
- Same-priority tiebreak: drop the oldest CongestionAlert, keep newer ones (current intersection state matters more than 30-second-old state).
- Production fix would be horizontal scaling — adding more DashboardService instances to raise the 80 events/sec ceiling.

---

## G · Outbox Pattern / Scenario 3 (3)

### Q23. What is the Dual Write Problem?
- One logical operation requires TWO separate writes (e.g., create penalty + write audit log).
- If one succeeds and the other fails → inconsistent state. In our case, a fine with no audit trail → legally inadmissible.
- It's a fundamental problem in distributed systems.

### Q24. How does the Outbox Pattern fix it?
- Step 1: write the event to a local `EventOutbox` table inside the SAME database transaction as the business write. Both succeed or both fail (ACID).
- Step 2: a background relay polls the outbox for `PENDING` rows and publishes them to the bus.
- Step 3: on success → `PUBLISHED`. On failure → retry. After max retries → `FAILED` (manual replay from admin UI).
- Retry is safe because subscribers are already idempotent (Task 4 synergy).

### Q25. Is the Outbox Pattern's cost worth paying here?
- **Costs:** extra table, background worker, retry logic, eventual consistency (small publish delay).
- **For dashboard updates:** no — a missed refresh is harmless.
- **For enforcement events:** yes — a penalty without an audit log is a legal liability. The cost is operational; the risk of skipping is legal.
- See [07_CLO4_ANALYSIS_ADR.md](07_CLO4_ANALYSIS_ADR.md) → Scenario 3 for the 150+ word justification.

---

## Quick-Fire Round (Likely Surprise Questions)

| Q | A (one sentence) |
|---|---|
| How many tests pass? | **78** backend tests, all green. |
| What language? | TypeScript on the API, React on the web UI. |
| What database? | Prisma ORM over SQLite (dev) / Postgres (prod). |
| Where is the UML diagram? | [docs/uml/01_class_diagram_observer.md](uml/01_class_diagram_observer.md) — required Task 2 deliverable. |
| Where is the ADR? | [docs/07_CLO4_ANALYSIS_ADR.md](07_CLO4_ANALYSIS_ADR.md) Scenario 1. |
| Why TypeScript? | Strict interface contracts (`IEventSubscriber`) enforced at compile time. |
| Largest file? | `BoundedEventQueue.ts` at ~272 lines, fully commented. |
| Biggest mark item? | Tied: Task 1 (EventBus) and Task 4 (Idempotency) at 10 marks each. |

---

## Final Trick: If You Forget Everything Else

Say this:
> *"Cameras don't know who listens. Listeners don't know who else listens. The EventBus is the only middleman, and it only knows the IEventSubscriber interface — never a concrete class."*

It's the single sentence that demonstrates you understand the architecture. Everything else flows from there.
