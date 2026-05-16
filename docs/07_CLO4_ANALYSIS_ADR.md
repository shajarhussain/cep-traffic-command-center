# CLO 4 Written Analysis and ADR Material

> **Status:** Complete — Phase 7 · Event-Driven Traffic Alert System

---

## Scenario 1 — Event Format Changes (Schema Evolution)

### Situation

Six months after launch, `VehicleDetectedEvent` must include a new field called `lane_number`
to support multi-lane enforcement. There are already 200 subscriber instances running on the
old format. The city authority wants the change deployed without a scheduled maintenance window.

### Option A — Backward Compatibility (Optional Field)

Add `lane_number` as an optional field. Old subscribers can safely ignore it.

```ts
// EventTypes.ts — already implemented
interface VehicleDetectedPayload {
  vehicle_plate: string;
  intersection_name: string;
  lane_number?: number;  // optional — additive only, schema_version stays 1
}
```

**Benefits**
- Old subscribers do not break; no code change required on 200 existing instances.
- Deployment is immediate and rollback is trivial.
- Suitable for non-breaking, purely additive changes.

**Risks**
- Subscribers may silently ignore `lane_number`, causing missing data in reports.
- A default or missing value may hide inaccurate enforcement records.
- Over time, accumulating optional fields makes the event contract ambiguous.
- It is impossible to distinguish "subscriber supports lane data" from "subscriber ignores it".

### Option B — Schema Versioning (New Version Type)

Introduce `VehicleDetectedEvent_v2` and set `schema_version = 2`. Old subscribers reject
or skip v2 envelopes until they are upgraded.

```ts
// EventTypes.ts — v2 example (not yet implemented; shown for ADR purposes)
interface VehicleDetectedPayloadV2 {
  vehicle_plate: string;
  intersection_name: string;
  lane_number: number;   // required in v2; no ambiguity
}
```

Subscribers that only understand v1 would check:
```ts
if (envelope.schema_version !== 1) {
  // skip or route to a v2-capable subscriber
  return;
}
```

**Benefits**
- The semantic meaning of each version is explicit and unambiguous.
- Subscribers can reject unsupported versions rather than silently processing incomplete data.
- Controlled migration path: v1 and v2 can coexist during the transition window.
- Better fit for legally important data such as enforcement records.

**Risks**
- Requires coordinated deployment: subscribers must be upgraded before v2 events arrive.
- More code paths in subscriber `handle()` methods.
- Temporary service degradation on legacy subscribers during migration.

---

### Architecture Decision Record — Schema Evolution

#### Problem

The city authority wants `VehicleDetectedEvent` to carry `lane_number`, but 200 subscriber
instances understand only the current payload format. The system must evolve without breaking
existing services or silently producing enforcement records with missing data.

#### Decision

**Use schema versioning (Option B) as the primary strategy for this project.**

For the specific `lane_number` change, Option A (optional field) is also acceptable because
it is purely additive and does not remove or rename any existing field. However, for a traffic
enforcement system where penalties are legally binding, a schema versioning approach is
architecturally safer:

- Subscribers can explicitly reject versions they do not understand.
- Lane-based enforcement is new behavior, not merely new metadata.
- The `schema_version` field is already present in every `EventEnvelope` and defaults to `1`.
  A v2 envelope sets `schema_version = 2` without any change to the envelope structure.
- A 90-day compatibility window allows phased subscriber upgrades.

The implementation in this project demonstrates the approach:
- `schema_version` is already the 3rd of the 7 required `EventEnvelope` fields.
- `VehicleDetectedPayload` already includes `lane_number?` (optional) as a Phase 1 design decision
  to support this exact evolution scenario.

#### Consequences

| Aspect | Outcome |
|---|---|
| Old subscribers | Continue to work with `schema_version = 1` envelopes |
| New subscribers | Can use `lane_number` immediately if present |
| Migration | Phased: run both versions in parallel during 90-day window |
| Risk | Minor: some services may ignore lane data during transition |
| Legal safety | High: v2 envelopes are unambiguous about required fields |

The cost — more code paths and a deployment window — is worth paying for a traffic enforcement
system because incorrect lane attribution could make a penalty legally inadmissible.

---

## Scenario 2 — Event Flood: Bounded Queue Analysis

### Problem Definition

Under peak conditions, traffic cameras broadcast 500 events per second. The DashboardService
can process only 80 events per second due to database write overhead. Without a bounded queue,
the process would consume unlimited memory as the backlog grows.

### Capacity Calculation

```
Incoming rate          = 500 events / second
DashboardService rate  =  80 events / second
──────────────────────────────────────────────
Backlog growth         = 500 − 80 = 420 events / second

Queue limit            = 10,000 events
Time until full        = 10,000 / 420 ≈ 23.81 seconds
```

**The system queue reaches 10,000 unprocessed events in approximately 23.81 seconds.**
This calculation is reproduced by the `calculateSecondsUntilFull(500, 80, 10_000)` helper in
`BoundedEventQueue.ts` and is verified by `bounded-queue.spec.ts` Test 6.

The endpoint `GET /api/queue/analysis` returns:
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

### Bounded Queue Tactic

`BoundedEventQueue` (implemented in `apps/api/src/domain/bus/BoundedEventQueue.ts`) imposes
a hard ceiling on queue depth. When the queue is full and a new event arrives, the system
must evict one existing event before accepting the new one.

### Priority-Aware Eviction Strategy

Two candidate strategies exist:

| Strategy | Description | Weakness |
|---|---|---|
| FIFO drop (drop oldest) | Simple to implement | May discard a critical congestion alert |
| Priority-aware eviction | Preserve important events | Slightly more complex |

**This system uses priority-aware eviction** because not all events carry equal operational
or legal weight. A `CongestionAlertEvent` near a stadium or hospital has a direct safety
consequence; a routine `VehicleDetectedEvent` is informational only.

**Priority mapping** (defined in `EVENT_PRIORITY` constant — external to `EventEnvelope`):

| Priority | Level | Event Type | Reasoning |
|---|---|---|---|
| 4 | CRITICAL | `CongestionAlertEvent` | Safety-critical; congestion may indicate accidents |
| 3 | HIGH | `SpeedViolationEvent` | Legal enforcement; creates penalty notice |
| 2 | MEDIUM | `TrafficClearedEvent` | Operational state update; important but recoverable |
| 1 | LOW | `VehicleDetectedEvent` | High-volume routine detection; most expendable |

**Tiebreak rule:** If two events share the same priority, drop the **oldest** (lowest sequence
number). Newer events are more likely to reflect current road state.

**Key design decision:** Priority is not stored inside `EventEnvelope`. The 7 required CEP
fields are preserved without modification. Priority is derived externally via `getEventPriority()`
on the `event_type` field, maintaining clean separation of concerns.

### Implemented Evidence

| Item | Location |
|---|---|
| `BoundedEventQueue` class | `apps/api/src/domain/bus/BoundedEventQueue.ts` |
| `EVENT_PRIORITY` mapping | Same file — external to `EventEnvelope` |
| `calculateSecondsUntilFull()` | Same file — tested by spec |
| Queue analysis API | `GET /api/queue/analysis` → returns 23.81s |
| Tests (7 required cases) | `apps/api/tests/bounded-queue.spec.ts` — 22 tests, all passing |

---

## Scenario 3 — Dual Write Problem and Outbox Pattern

### Problem Name

This is the **Dual Write Problem**. It arises when a single logical operation must write to
two separate targets and one write succeeds while the other fails.

### Concrete Failure Example

`SpeedViolationEvent` is published. `AlertService` successfully creates a penalty notice in the
`Penalty` table. Immediately after, `LoggingService` crashes before writing the audit log to the
`AuditLog` table. The system now has:

- A penalty record that says "citizen ABC was fined PKR 5,000"
- No audit trail explaining why, when, or by whom the event was processed

In a traffic enforcement context, this is a serious problem. If a citizen disputes the fine,
the enforcement authority cannot produce a complete legal record. The penalty may be
inadmissible in a tribunal without the corresponding audit evidence.

### Outbox Pattern Solution

Instead of publishing events directly to the `EventBus` (which triggers immediate, uncoordinated
writes across multiple services), the camera first writes the event to a local `EventOutbox`
table within the same database transaction as any state changes.

```
WITHIN ONE DATABASE TRANSACTION:
  1. INSERT into EventEnvelopeRecord (the event itself)
  2. INSERT into EventOutbox with status = 'PENDING'
  ↳ If this transaction fails → nothing is published; consistent state

BACKGROUND RELAY (separate process):
  3. Poll EventOutbox WHERE status = 'PENDING'
  4. Publish each pending event to the EventBus
  5. On success → UPDATE EventOutbox SET status = 'PUBLISHED'
  6. On failure → retry (with exponential backoff); row remains PENDING
```

Because the outbox write and the business data write share the same ACID transaction, they
either both succeed or both fail. The relay then handles publication separately and can retry
safely without re-creating business records.

### Cost of the Pattern

The Outbox Pattern is not free:

| Cost | Description |
|---|---|
| Extra table | `EventOutbox` must be maintained, indexed, and cleaned up |
| Background worker | A relay process must be built, deployed, and monitored |
| Retry logic | Retry policies, exponential backoff, dead-letter handling |
| Eventual consistency | Events are published with a small delay (poll interval) |
| Complexity | More components to test, deploy, and reason about |

### Domain Judgement — Why the Cost Is Justified

For casual dashboard updates — showing vehicle counts on a screen — the cost of the Outbox
Pattern may outweigh the benefit. A missed dashboard update is unpleasant but harmless.

For traffic enforcement, the calculus is different. A `SpeedViolationEvent` triggers a legal
act: a financial penalty issued to a citizen. If that act exists in the database without a
matching audit log, the enforcement authority has created a legal liability. Courts and
administrative tribunals in Pakistani traffic law require evidentiary chains. A fine without
an audit trail cannot be defended.

The Outbox Pattern provides:

1. **Atomic evidence creation** — penalty + outbox entry are written together or not at all.
2. **Guaranteed delivery** — the relay retries until the audit log subscriber confirms processing.
3. **Traceability** — the `EventOutbox.status` field shows exactly what has been published and
   when, supporting regulatory audits.
4. **Failure recovery** — a crashed `LoggingService` can re-process pending outbox rows after
   restart without any duplicate penalties, because penalty creation is idempotent.

**The implementation in this project already includes the `EventOutbox` table in the Prisma schema
and the `OutboxRepository` as prototype evidence.** Full relay logic is deferred to Phase 8
(CLO 4 Scenario 3 implementation track) but the persistence and interface layer are present.

**Conclusion:** The added complexity of the Outbox Pattern is justified for any event in this
system that triggers a legally enforceable action. The cost is operational. The risk of not
implementing it is legal and financial.

---

## Summary Table

| Scenario | CLO 4 Requirement | Decision | Implementation Evidence |
|---|---|---|---|
| 1 — Schema Evolution | Handle `lane_number` addition | Schema versioning (optional field for additive; versioning for breaking) | `EventTypes.ts lane_number?`, `schema_version` in envelope |
| 2 — Event Flood | Bounded queue with eviction | Priority-aware eviction; CRITICAL preserved; 23.81s fill calculation | `BoundedEventQueue.ts`, `bounded-queue.spec.ts`, `/api/queue/analysis` |
| 3 — Dual Write | Outbox Pattern | Worth implementing for enforcement events; lightweight approach shown | `EventOutbox` Prisma model, `OutboxRepository.ts` |
