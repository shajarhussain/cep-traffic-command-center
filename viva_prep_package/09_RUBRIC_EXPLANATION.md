# Rubric-Based Explanation (Primary Viva Doc)

> **Read this top to bottom before the viva.**
> Every rubric line from the CEP PDF (60 marks) is explained in 6 simple bullets:
> *what the rubric asks · what it means · why we did it · how we built it · where it lives in code · what to say in viva*.
>
> **Project:** Event-Driven Traffic Alert System · BSSE 4A/4B · Course Instructor Dr. Nida Adnan

---

## How to Use This Doc Tomorrow

- Skim once silently. Then read each "What to say in viva" line aloud twice. Those are your answers.
- If the examiner opens a file on screen, point at the **Where it lives** path — that proves you wrote the code.
- The numbers next to file paths are real line numbers. Don't memorize them; just glance.

---

# PART A — CLO 3 (30 marks)

---

## Rubric Line 1 — Build the Event Bus + 4 Event Types + 5th-Event Rule (10 marks)

**How you'll be assessed:** *"Working code + justification for each event type"*

- **What it means** — A class called `EventBus` sits between cameras and services. Cameras call `bus.publish(envelope)`, services call `bus.subscribe(eventType, me)`. The bus delivers each event to every subscriber that asked for that type. No service knows about any other service. The "5th-event rule" means: if tomorrow we invent `EmergencyVehicleEvent`, we should NOT have to modify the `EventBus` class or any existing camera code — just add the new payload type and one new subscriber.

- **Why we did it** — Cameras and services must evolve independently. If `AlertService` is offline, cameras keep working. If we add a `ReportingService` next month, cameras don't need redeploy. The bus is the only thing that knows everyone — and it stays small and stupid.

- **How we built it** (5 bullets)
  - `EventBus` stores `Map<string, Set<IEventSubscriber>>` — keyed by event type string for O(1) lookup.
  - `subscribe(eventType, subscriber)` adds the subscriber to the matching Set.
  - `publish(envelope)` looks up the Set for `envelope.event_type` and calls `subscriber.handle(envelope)` on each one. Async, so subscribers can do DB writes.
  - 4 event types defined as string constants in `EventTypes.ts` — `VehicleDetectedEvent`, `SpeedViolationEvent`, `CongestionAlertEvent`, `TrafficClearedEvent`.
  - 5th type (`EmergencyVehicleEvent`) exists ONLY in tests, to prove the rule. The bus class was never touched to support it.

- **Where it lives**
  - [apps/api/src/domain/bus/EventBus.ts](apps/api/src/domain/bus/EventBus.ts#L18-L78) — full class, 79 lines
  - [apps/api/src/domain/events/EventTypes.ts](apps/api/src/domain/events/EventTypes.ts#L10-L15) — the 4 constants
  - [apps/api/src/domain/events/EventTypes.ts:49-53](apps/api/src/domain/events/EventTypes.ts#L49-L53) — 5th type for proof
  - Tests: [apps/api/tests/eventbus.spec.ts](apps/api/tests/eventbus.spec.ts) (7 tests) and [apps/api/tests/fifth-event-type.spec.ts](apps/api/tests/fifth-event-type.spec.ts)
  - UML diagram: [docs/uml/01_class_diagram_observer.md](docs/uml/01_class_diagram_observer.md)

- **What to say in viva**
  > "The EventBus is a tiny class — about 80 lines. Cameras don't import any subscriber. Subscribers don't import any camera. The bus only knows the `IEventSubscriber` interface. To prove the 5th-event rule I wrote `fifth-event-type.spec.ts`: it registers an `EmergencyVehicleEvent` subscriber and publishes the event. Zero lines of `EventBus.ts` had to change. That's the no-change rule satisfied."

### Justification for each event type (the rubric asks for it)

| Event type | Why it exists | Who listens |
|---|---|---|
| `VehicleDetectedEvent` | Routine — feeds the live map and report counts | Dashboard, Reporting |
| `SpeedViolationEvent` | Triggers a legal penalty | Alert, Logging, Reporting |
| `CongestionAlertEvent` | Safety-critical — too many cars at one intersection | Dashboard, Logging |
| `TrafficClearedEvent` | Resets the map after congestion ends | Dashboard |

---

## Rubric Line 2 — Apply the Observer Pattern (5 marks)

**How you'll be assessed:** *"UML diagram + subscribe/unsubscribe demonstration"*

- **What it means** — Every subscriber implements a common interface `IEventSubscriber`. The bus stores a list of these interface references, NEVER a concrete class like `AlertService`. This is the textbook Observer Pattern: the subject (bus) does not depend on the concrete observers; both depend on the interface.

- **Why we did it** — Without the interface, the bus would need an `if (subscriber instanceof AlertService) …` chain. Adding a 5th subscriber would require editing the bus. With the interface, the bus is closed for modification but open for extension (Open/Closed Principle).

- **How we built it** (4 bullets)
  - Defined `IEventSubscriber` with 3 members: `name`, `supportedEventTypes`, `handle(envelope)`.
  - `EventBus.subscribers` is typed as `Map<string, Set<IEventSubscriber>>` — strict typing means we literally cannot store a concrete class reference.
  - All 4 services (`AlertService`, `LoggingService`, `DashboardService`, `ReportingService`) extend `BaseIdempotentSubscriber`, which `implements IEventSubscriber`.
  - `subscribe()` and `unsubscribe()` work on interface references — the bus can't tell the difference between AlertService and a new subscriber.

- **Where it lives**
  - Interface: [apps/api/src/domain/subscribers/IEventSubscriber.ts](apps/api/src/domain/subscribers/IEventSubscriber.ts) (14-23 lines, fully commented)
  - Bus coupling proof: [apps/api/src/domain/bus/EventBus.ts:20](apps/api/src/domain/bus/EventBus.ts#L20) — `private subscribers = new Map<string, Set<IEventSubscriber>>()`
  - Subscribers: [apps/api/src/domain/subscribers/](apps/api/src/domain/subscribers/) — 4 files
  - **UML diagram (required deliverable):** [docs/uml/01_class_diagram_observer.md](docs/uml/01_class_diagram_observer.md)
  - subscribe/unsubscribe demo test: [apps/api/tests/eventbus.spec.ts](apps/api/tests/eventbus.spec.ts) — Test "unsubscribe removes a subscriber"

- **What to say in viva**
  > "Open `EventBus.ts` line 20. You'll see the Map is typed `Set<IEventSubscriber>` — interface only. There is not a single `import { AlertService }` in this file. That's the Observer Pattern enforced by the type system. If you ask me to unsubscribe AlertService at runtime, I just call `bus.unsubscribe('SpeedViolationEvent', alertService)` and the bus removes it from the Set."

---

## Rubric Line 3 — Apply the Event Envelope Pattern (5 marks)

**How you'll be assessed:** *"Envelope class with all 7 fields + written justification"*

- **What it means** — Every event traveling on the bus is wrapped in an `EventEnvelope`. The envelope carries metadata (who sent it, when, what version) on the outside, and the actual event data in a `payload` field. Like a postal envelope around a letter.

- **Why we did it** — Without an envelope, every subscriber would re-invent its own metadata. Duplicate detection needs `event_id`; schema evolution needs `schema_version`; audit logs need `timestamp` and `source_id`. Put them all in one place — the envelope — and every subscriber gets them for free.

- **How we built it — exactly 7 fields (matches CEP PDF table)**

  | Field | Type | What it is |
  |---|---|---|
  | `event_id` | string (UUID v4) | Unique ID for THIS event instance — drives idempotency |
  | `correlation_id` | string (UUID v4) | Groups related events together (one vehicle's full journey) |
  | `schema_version` | number (default 1) | Version of the event format — drives schema evolution (Scenario 1) |
  | `source_id` | string | Which camera sent the event |
  | `timestamp` | string (ISO 8601 UTC) | When the event was created |
  | `event_type` | string | One of the 4 type strings |
  | `payload` | generic `<P>` | The actual event data, typed per event |

  - `createEnvelope()` factory auto-generates `event_id` and `timestamp`, so cameras can't forget them.

- **Where it lives**
  - Envelope type: [apps/api/src/domain/events/EventEnvelope.ts](apps/api/src/domain/events/EventEnvelope.ts) — 32 lines, one comment per field
  - Factory: [apps/api/src/domain/events/createEnvelope.ts](apps/api/src/domain/events/createEnvelope.ts)
  - Tests: [apps/api/tests/envelope.spec.ts](apps/api/tests/envelope.spec.ts) — 9 tests, one per field + factory behavior
  - UML diagram: [docs/uml/02_class_diagram_envelope.md](docs/uml/02_class_diagram_envelope.md)
  - UI evidence: Dashboard → Event Inspector — sidebar shows all 7 fields labelled (screenshot `04-live-alert-stream-metadata.png`)

- **What to say in viva**
  > "The envelope has exactly 7 fields — the same 7 the PDF asked for. Priority is NOT an 8th field. We derive priority externally from `event_type` in `BoundedEventQueue` so the envelope stays a pure data carrier. `correlation_id` is different from `event_id`: `event_id` is unique per event, `correlation_id` groups events that belong to the same vehicle's journey across intersections."

---

## Rubric Line 4 — Apply the Idempotent Receiver Pattern (10 marks)

**How you'll be assessed:** *"Base class + passing test for duplicate event"*

- **What it means** — If the same `SpeedViolationEvent` is delivered twice (network glitch, retry), `AlertService` must NOT create two penalty notices. Each subscriber checks the incoming `event_id`: if it's been seen before, skip it; otherwise process it and remember the ID.

- **Why we did it** — A duplicate penalty is a legal nightmare. A citizen would be fined twice for the same speeding incident. The rubric explicitly calls this "a serious problem" and reserves 10 marks (the largest single-line value in CLO 3) for handling it.

- **How we built it** (5 bullets — this is the most important rubric line)
  - `BaseIdempotentSubscriber` is an abstract class implementing the **Template Method** pattern.
  - `handle(envelope)` does 3 things in order: (1) ask the `ProcessedEventRepository` "have I seen this event_id?", (2) if yes → increment `duplicateIgnoredCount` and return silently, (3) if no → call abstract `process()` and then `markProcessed()`.
  - Tracking is **per-subscriber**: AlertService and LoggingService each have their own row in the `ProcessedEvent` table, keyed `(event_id, subscriber_name)`. So if both subscribe to the same event, each gets one chance to process it.
  - **Double safety net:** DB constraint `ProcessedEvent @@unique([eventId, subscriberName])` blocks duplicates even if the in-memory check fails. Plus `Penalty @unique(eventId)` makes a duplicate penalty insert impossible.
  - **Required test passes:** [apps/api/tests/idempotency.spec.ts](apps/api/tests/idempotency.spec.ts) publishes the same `SpeedViolationEvent` twice with the same `event_id` and asserts the `Penalty` table has exactly 1 row.

- **Where it lives**
  - Template Method base class: [apps/api/src/domain/subscribers/BaseIdempotentSubscriber.ts:50-64](apps/api/src/domain/subscribers/BaseIdempotentSubscriber.ts#L50-L64)
  - Repo interface: [apps/api/src/domain/subscribers/BaseIdempotentSubscriber.ts:25-31](apps/api/src/domain/subscribers/BaseIdempotentSubscriber.ts#L25-L31)
  - Prisma impl: [apps/api/src/infrastructure/repositories/ProcessedEventRepository.ts](apps/api/src/infrastructure/repositories/ProcessedEventRepository.ts)
  - DB constraint: `prisma/schema.prisma` → `ProcessedEvent @@unique([eventId, subscriberName])`
  - Required passing test: [apps/api/tests/idempotency.spec.ts](apps/api/tests/idempotency.spec.ts) (10 tests, all green)
  - **Live demo endpoint:** `POST /api/events/publish-duplicate-speed-violation` → returns `{ published_attempts: 2, penalties_created_for_event: 1, duplicate_ignored_by_alert: 1 }`
  - UI evidence: Dashboard → "Idempotency Demo" big red button → screen shows "2 attempts → 1 penalty" (screenshot `04-duplicate-alert-safety.png` or `03-duplicate-alert-safety.png`)
  - UML sequence diagram: [docs/uml/03_sequence_idempotent_duplicate.md](docs/uml/03_sequence_idempotent_duplicate.md)

- **What to say in viva**
  > "Watch this. I'll click the red 'Publish Duplicate' button in the dashboard. The system tries to publish the same SpeedViolationEvent twice with the same event_id. The screen says: attempts = 2, penalties created = 1, duplicates ignored by AlertService = 1. That's the Idempotent Receiver Pattern working live. The proof has two layers: the Template Method in `handle()` plus the DB unique constraint on `ProcessedEvent.eventId`."

---

# PART B — CLO 4 (30 marks)

---

## Rubric Line 5 — Scenario 1: Schema Evolution + ADR (10 marks)

**How you'll be assessed:** *"Written analysis (min. 200 words) + ADR"*

- **What it means** — Six months after launch, the city wants `VehicleDetectedEvent` to carry a new field `lane_number`. But 200 subscribers are already running on the old format. You must analyze two options (backward-compatible optional field vs schema versioning) and write a short ADR (Architecture Decision Record).

- **Why we did it** — Real production systems evolve. The CEP wants you to demonstrate that you can REASON about evolution, not just code it. The 200-subscriber constraint forces you to think about deployment realities.

- **How we addressed it** (the two options summarized)

  | | **Option A — Optional Field** | **Option B — Schema Versioning** |
  |---|---|---|
  | Approach | Add `lane_number?: number` to existing payload, keep `schema_version = 1` | Release `VehicleDetectedEvent_v2`, bump `schema_version = 2` |
  | Old subscribers | Keep working — they ignore the new field | Reject v2 envelopes (`if (envelope.schema_version !== 1) return`) until upgraded |
  | Risk of Option | Silent data loss — subscribers may ignore `lane_number` without anyone noticing | Coordinated deploy needed; temporary blind spots until v2 subscribers are upgraded |
  | Best for | Purely additive, non-breaking changes | Anything legally significant or where missing data would corrupt a report |

- **Our decision** — **Use schema versioning (Option B) as the primary strategy.** For purely additive cases (like `lane_number`), Option A is acceptable. But for a traffic enforcement system where missing lane data could make a penalty legally inadmissible, Option B is architecturally safer because subscribers can EXPLICITLY reject versions they don't understand instead of silently producing incomplete records.

- **Implementation evidence already in code**
  - `schema_version` is field #3 of every envelope — already there from Phase 1.
  - `VehicleDetectedPayload` already has `lane_number?: number` (optional) so additive deploys work today.
  - The system is ready for both strategies — the choice is a deployment-time decision per change.

- **Where it lives**
  - Full ADR (Problem / Decision / Consequences): [docs/07_CLO4_ANALYSIS_ADR.md](docs/07_CLO4_ANALYSIS_ADR.md) → Scenario 1 (~350 words, exceeds 200-word minimum)
  - Envelope field: [apps/api/src/domain/events/EventEnvelope.ts:19](apps/api/src/domain/events/EventEnvelope.ts#L19) — `schema_version: number`
  - Optional field already in payload: [apps/api/src/domain/events/EventTypes.ts:24](apps/api/src/domain/events/EventTypes.ts#L24) — `lane_number?: number`

- **What to say in viva**
  > "I chose schema versioning for enforcement events because silent data loss is the bigger risk. The optional-field approach feels easier but a v1 subscriber processing a v2 event without knowing it would create incomplete penalty records — and that's a legal exposure. With `schema_version`, an old subscriber can do `if (envelope.schema_version !== 1) return` and we ship v2 events to a separate consumer group. The cost is coordinated deployment; the benefit is that nothing is silently wrong."

---

## Rubric Line 6 — Scenario 2: Event Flood + Bounded Queue (10 marks)

**How you'll be assessed:** *"Calculation + eviction policy + justification"*

- **What it means** — During a football match, cameras send 500 events/sec but DashboardService can only process 80 events/sec. Without protection, memory grows forever. You must (a) calculate when a 10,000-event queue fills, (b) implement a bounded queue, (c) decide what to drop when it's full.

- **Why we did it** — Real systems fail under unbounded growth. The CEP wants you to demonstrate capacity planning and the architectural tactic of bounding the queue.

- **The calculation (worth marks — show your working)**

  ```
  Incoming rate          = 500 events / second
  Processing rate        =  80 events / second   (DashboardService)
  ─────────────────────────────────────────────────
  Backlog growth         = 500 − 80 = 420 events / second
  Queue limit            = 10,000 events
  Time until full        = 10,000 ÷ 420 ≈ 23.81 seconds
  ```

  This calculation is in code: `calculateSecondsUntilFull(500, 80, 10000) === 23.81`.
  Verified by Test 6 in `bounded-queue.spec.ts`: `expect(...).toBeCloseTo(23.81, 1)`.
  Returned live by `GET /api/queue/analysis`.

- **The eviction policy — drop least important first (NOT oldest)**

  | Priority | Event type | Why |
  |---|---|---|
  | 4 CRITICAL | `CongestionAlertEvent` | Safety — congestion may indicate an accident |
  | 3 HIGH | `SpeedViolationEvent` | Legal — creates a penalty |
  | 2 MEDIUM | `TrafficClearedEvent` | Operational state |
  | 1 LOW | `VehicleDetectedEvent` | Routine, high-volume, expendable |

  - **Tiebreak rule:** If two events have the same priority, drop the OLDEST (lowest sequence number).
  - **Justification:** Pure FIFO (drop oldest) could discard a CRITICAL congestion alert in favor of a routine vehicle detection. That's unacceptable in an enforcement system. Priority-aware eviction keeps the events that matter; loses the events we can spare.

- **Where it lives**
  - Class: [apps/api/src/domain/bus/BoundedEventQueue.ts](apps/api/src/domain/bus/BoundedEventQueue.ts) (272 lines)
  - Priority map: [BoundedEventQueue.ts:40-45](apps/api/src/domain/bus/BoundedEventQueue.ts#L40-L45)
  - Calculation helper: [BoundedEventQueue.ts:90-98](apps/api/src/domain/bus/BoundedEventQueue.ts#L90-L98)
  - Eviction logic: [BoundedEventQueue.ts:139-162](apps/api/src/domain/bus/BoundedEventQueue.ts#L139-L162) (enqueue) + [BoundedEventQueue.ts:257-271](apps/api/src/domain/bus/BoundedEventQueue.ts#L257-L271) (findEvictionCandidate)
  - Tests: [apps/api/tests/bounded-queue.spec.ts](apps/api/tests/bounded-queue.spec.ts) — 22 tests, Test 6 verifies 23.81s
  - API endpoint: `GET /api/queue/analysis` → JSON with the 23.81 value
  - UI evidence: Dashboard → Capacity Monitor (screenshot `10-capacity-monitor.png`)
  - Full written analysis: [docs/07_CLO4_ANALYSIS_ADR.md](docs/07_CLO4_ANALYSIS_ADR.md) → Scenario 2

- **What to say in viva**
  > "23.81 seconds. The math is 10,000 divided by 420 — that's the queue limit divided by the backlog growth rate. For eviction I chose priority-aware over FIFO. The reason: dropping the oldest event might mean dropping a CRITICAL congestion alert that arrived first. So I store priority outside the envelope, in a constant called `EVENT_PRIORITY`. When the queue is full, I evict the lowest-priority event. Same priority → drop the older one. Critical alerts are preserved."

---

## Rubric Line 7 — Scenario 3: Dual Write + Outbox Pattern (10 marks)

**How you'll be assessed:** *"Written analysis + domain judgement (min. 150 words)"*

- **What it means** — `SpeedViolationEvent` is published. `AlertService` creates a penalty in DB. Then `LoggingService` crashes before writing the audit log. Now we have a penalty with no audit trail — legally inadmissible. This is the **Dual Write Problem**: one logical operation must succeed in two systems but only one did.

- **Why we did it** — Penalties without audit logs are legal liabilities. The CEP wants you to NAME the problem (Dual Write), DESCRIBE the solution (Outbox Pattern), ASSESS its cost, and JUSTIFY whether to pay that cost in this domain.

- **The Outbox Pattern in 4 bullets**
  - Instead of publishing directly to the bus, the camera writes the event to a local `EventOutbox` table inside the SAME database transaction as any business write. Both succeed or both fail (ACID).
  - A separate background process (the **OutboxRelay**) polls the `EventOutbox` for rows where `status = PENDING` and publishes each one to the EventBus.
  - On successful publish → `status = PUBLISHED`. On failure → `attemptCount++` and the row stays PENDING for retry. After max retries → `status = FAILED` for manual review.
  - Because subscribers are already idempotent (CLO 3 Task 4), the relay can safely retry — the same `event_id` published twice still creates only one penalty.

- **The cost (must be acknowledged for the rubric)**

  | Cost | What it adds |
  |---|---|
  | Extra DB table | `EventOutbox` to maintain and clean up |
  | Background worker | Relay process to build, deploy, monitor |
  | Retry policies | Exponential backoff + dead-letter handling |
  | Eventual consistency | Small delay (poll interval) before subscribers see the event |
  | More moving parts | More to test, deploy, reason about |

- **Domain judgement (150+ words — this is the marks line)**

  > For a casual dashboard update — showing vehicle counts on a screen — the Outbox Pattern is overkill. A missed dashboard refresh is unpleasant but harmless and the operational cost (extra table, background relay, retry plumbing) would outweigh the benefit. For traffic enforcement, the calculus inverts completely. A `SpeedViolationEvent` triggers a LEGAL act: a financial penalty issued to a citizen. If that penalty exists in the database without a matching audit log, the enforcement authority has created a legal liability. Pakistani administrative tribunals require evidentiary chains; a fine without an audit trail cannot be defended. The Outbox Pattern guarantees three things that matter here: (1) atomic evidence creation — penalty plus outbox row are written together or not at all; (2) guaranteed delivery — the relay retries until the audit subscriber confirms; (3) traceability — `EventOutbox.status` shows exactly what has been published and when, supporting regulatory audits. The added complexity is operational and predictable. The risk of NOT implementing it is legal and unpredictable. For any event that triggers an enforceable action, the cost of the Outbox Pattern is worth paying.

- **Where it lives**
  - Full written analysis: [docs/07_CLO4_ANALYSIS_ADR.md](docs/07_CLO4_ANALYSIS_ADR.md) → Scenario 3 (~250 words)
  - DB model: `prisma/schema.prisma` → `EventOutbox` table
  - Repository: [apps/api/src/infrastructure/repositories/OutboxRepository.ts](apps/api/src/infrastructure/repositories/OutboxRepository.ts) (148 lines)
  - Atomic enqueue: [OutboxRepository.ts:31-41](apps/api/src/infrastructure/repositories/OutboxRepository.ts#L31-L41)
  - Retry recording: [OutboxRepository.ts:58-70](apps/api/src/infrastructure/repositories/OutboxRepository.ts#L58-L70)
  - Test: [apps/api/tests/outbox-pattern.spec.ts](apps/api/tests/outbox-pattern.spec.ts) — proves atomic dual-write + retry-on-crash
  - UML sequence: [docs/uml/04_sequence_outbox_pattern.md](docs/uml/04_sequence_outbox_pattern.md)

- **What to say in viva**
  > "The problem is called the Dual Write Problem. The Outbox Pattern fixes it by writing the event to a local outbox table inside the same DB transaction as the business write — so either both succeed or both fail. Then a background relay publishes pending outbox rows to the bus. The cost is real: an extra table, a background process, retry logic, and a small publish delay. For a dashboard counter, that cost isn't worth paying. For an enforcement penalty that has to stand up in court, it absolutely is. A penalty without an audit log is a legal liability. The complexity is operational; the risk of skipping it is legal."

---

# Quick-Glance Marks Coverage

| Rubric line | Marks | Status | Single best piece of evidence |
|---|---|---|---|
| 1. EventBus + 4 types + 5th rule | 10 | ✅ | [EventBus.ts](apps/api/src/domain/bus/EventBus.ts) + [fifth-event-type.spec.ts](apps/api/tests/fifth-event-type.spec.ts) |
| 2. Observer Pattern + UML | 5 | ✅ | [IEventSubscriber.ts](apps/api/src/domain/subscribers/IEventSubscriber.ts) + [UML](docs/uml/01_class_diagram_observer.md) |
| 3. Event Envelope + 7 fields | 5 | ✅ | [EventEnvelope.ts](apps/api/src/domain/events/EventEnvelope.ts) + [UML](docs/uml/02_class_diagram_envelope.md) |
| 4. Idempotent Receiver | 10 | ✅ | [BaseIdempotentSubscriber.ts](apps/api/src/domain/subscribers/BaseIdempotentSubscriber.ts) + [idempotency.spec.ts](apps/api/tests/idempotency.spec.ts) |
| 5. Scenario 1 — Schema ADR | 10 | ✅ | [ADR](docs/07_CLO4_ANALYSIS_ADR.md) |
| 6. Scenario 2 — Bounded Queue | 10 | ✅ | [BoundedEventQueue.ts](apps/api/src/domain/bus/BoundedEventQueue.ts) + 23.81s |
| 7. Scenario 3 — Outbox | 10 | ✅ | [OutboxRepository.ts](apps/api/src/infrastructure/repositories/OutboxRepository.ts) + [ADR](docs/07_CLO4_ANALYSIS_ADR.md) |
| **Total** | **60** | **✅** | 78 backend tests passing |

---

# Three Sentences That Cover the Entire Project

> "The system is event-driven. Cameras don't know who listens; listeners don't know who else listens; the EventBus is the only middleman, and it only knows the `IEventSubscriber` interface — never a concrete class. Duplicate events can't cause duplicate penalties because every subscriber checks the `event_id` against a `ProcessedEvent` table before processing, with a DB unique constraint as a safety net. Overload is handled by a `BoundedEventQueue` that drops low-priority events first, and the Dual Write Problem between penalty creation and audit logging is solved by the Outbox Pattern."

Memorize those three sentences. They answer 70% of viva questions on their own.
