# CLO 4 Written Analysis and ADR Material

## Scenario 1 — Event format changes

### Situation
Six months after launch, `VehicleDetectedEvent` must include a new field called `lane_number`. There are already 200 subscriber instances running on the old format.

### Option A — Backward Compatibility
Add `lane_number` as an optional field with a default value.

Example:

```ts
interface VehicleDetectedPayloadV1Compatible {
  vehicle_plate: string;
  intersection_name: string;
  lane_number?: number;
}
```

#### Benefits
- Old subscribers do not break.
- Deployment is simple.
- No immediate migration is required.
- It is good for small additive changes.

#### Risks
- Subscribers may silently ignore `lane_number`.
- A default value can hide missing or inaccurate data.
- Over time, too many optional fields can make the event unclear.
- It becomes harder to know which subscribers truly support lane-based behavior.

### Option B — Schema Versioning
Create a version 2 event format and set `schema_version = 2`.

Example:

```ts
interface VehicleDetectedPayloadV2 {
  vehicle_plate: string;
  intersection_name: string;
  lane_number: number;
}
```

#### Benefits
- The meaning of the event is explicit.
- Subscribers can reject unsupported versions safely.
- Migration can be controlled.
- Better for major changes or legally important data.

#### Risks
- More code paths are needed.
- Some subscribers may stop processing v2 until upgraded.
- Deployment coordination is harder.

### Architecture Decision Record

#### Problem
The city authority wants `VehicleDetectedEvent` to include `lane_number`, but many subscribers still understand only the old format. The system must evolve without breaking existing services or silently corrupting event meaning.

#### Decision
Use backward compatibility for this specific change because `lane_number` is an additive field — it extends the payload without redefining or removing any existing key, so a subscriber that ignores it cannot misinterpret an event. Add `lane_number` as an optional field in `VehicleDetectedPayload` and keep `schema_version = 1` for compatible events. The choice is informed by the fact that `EventEnvelope` already carries a `schema_version` field, so the system retains the option to escalate to Option B (explicit versioning) at any time without re-architecting the bus or the camera. For future *breaking* changes — a rename, a type change, or the removal of a field — use explicit schema versioning with `schema_version = 2` or publish a new event type alongside the old one until subscribers migrate.

#### Consequences

**Gains.** Zero downtime across the 200 already-running subscriber instances; they continue to process `VehicleDetectedEvent` exactly as before because the field they never read remains absent from their perspective. New subscribers that need lane-aware analytics — for example a "lane-level congestion" feature — can use `payload.lane_number` immediately, without coordinating a versioned rollout. Deployments stay decoupled: each subscriber team ships its upgrade on its own timeline, which matches the reality of a city authority with multiple integrators. The bus itself is untouched, so no regression risk on routing, idempotency, or the outbox loop.

**Losses and mitigations.** First, subscribers can silently miss the new field if their tests don't assert its presence — mitigated by adding a per-subscriber assertion in each unit suite that the field is read where expected. Second, default-value drift: if a missing `lane_number` is interpreted as lane `0` by one subscriber and "unknown" by another, the same event means different things in different reports. We document the rule "absent `lane_number` means *unknown* lane, not lane 0" in `EventTypes.ts` and surface that contract in the Analytics page. Third, optional fields tend to accumulate, eroding the envelope's clarity; mitigated by a 12-month review cycle that decides whether the accumulated additive changes justify cutting a v2 envelope. **If a future change is non-additive (rename or type change), the same `schema_version` field lets us cleanly escalate to Option B without touching the bus.**

## Scenario 2 — Too many events arrive at once

### Given
- Incoming rate = 500 events/second
- DashboardService processing rate = 80 events/second
- Queue limit = 10,000 unprocessed events

### Calculation
```text
Backlog growth rate = incoming rate - processing rate
Backlog growth rate = 500 - 80 = 420 events/second
Time to reach 10,000 = 10,000 / 420 = 23.81 seconds
```

The queue reaches 10,000 unprocessed events in approximately **23.81 seconds**.

### Bounded Queue tactic
A bounded queue sets a maximum size. Once the queue is full, the system must evict an old or less important event before accepting a new event.

### Oldest vs least important
Dropping the oldest event is simple, but it may discard a legally or operationally important event. In a traffic system, not all events have equal importance. A `CRITICAL` congestion alert near a stadium matters more than a routine `VehicleDetectedEvent`. Therefore, the better policy is priority-aware eviction: drop the least important event first, and if events have equal priority, drop the oldest among them.

## Scenario 3 — One service fails after another succeeds

### Problem name
This is the **Dual Write Problem**. It happens when the system tries to update two different targets as part of one logical operation, but only one succeeds. In this scenario, `AlertService` creates a penalty notice, but `LoggingService` crashes before creating the audit log. The penalty exists, but the legal record explaining why it exists is missing.

### Outbox Pattern solution
Instead of publishing directly to the EventBus, the camera first writes the event to a local database outbox table. A background publisher reads pending outbox rows and publishes them to the bus. If publishing fails, the row stays pending and can be retried. This reduces the chance that an event is lost between local state changes and event publication.

### Cost
The Outbox Pattern adds more moving parts: an outbox table, background worker, retry policy, failure states, monitoring, and cleanup. It can also add a small delay because events are published by a worker instead of immediately.

### Domain judgement
In a traffic enforcement system, the cost is worth paying. A speed penalty is not just a dashboard notification; it may affect a citizen financially and legally. If a penalty exists without an audit trail, the system becomes difficult to defend during disputes. The outbox adds complexity, but that complexity protects evidence, improves reliability, and creates a retry path during failures. For casual dashboard updates, direct publishing may be acceptable. For legally important enforcement actions, the system should favor correctness and traceability over the smallest possible delay. Therefore, the Outbox Pattern is justified for penalty-related events and audit-critical event flows.

### Implementation status
The pattern is **fully implemented**, not just analyzed:
- [`apps/api/src/application/PublishEventUseCase.ts`](apps/api/src/application/PublishEventUseCase.ts) wraps the envelope write and the outbox enqueue in a single `prisma.$transaction(...)`. Either both writes commit or neither does — the dual-write window is closed.
- [`apps/api/src/application/OutboxRelay.ts`](apps/api/src/application/OutboxRelay.ts) is the background worker. It polls `EventOutbox` every 1 second (configurable via `OUTBOX_RELAY_INTERVAL_MS`), publishes PENDING rows to the bus, and uses `recordFailure(eventId, error, maxAttempts)` to retain PENDING status until the retry cap is hit.
- [`apps/api/src/main.ts`](apps/api/src/main.ts) starts the relay after `app.listen` and stops it cleanly on SIGINT/SIGTERM.
- The **System → Outbox** page in the UI surfaces every row with status, attempt count, last error, and a per-row **Replay** button (`POST /api/outbox/relay-one/:id`).
- Loss-prevention is verified end-to-end by [`apps/api/tests/outbox-pattern.spec.ts`](apps/api/tests/outbox-pattern.spec.ts): a throwing subscriber leaves the row PENDING with the recorded error; once the subscriber recovers, `ctx.outboxRelay.tick()` flips the row to PUBLISHED.
