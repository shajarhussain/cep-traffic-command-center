# UML 4 — Outbox Pattern Sequence Diagram

> **Supports CEP rubric — CLO 4 Scenario 3 (10 marks)**
> Shows how the Outbox Pattern fixes the **Dual Write Problem**: the event is written to a local DB inside the same transaction, then a background relay publishes it to the bus.

---

## Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Camera
    participant UC as PublishEventUseCase
    participant TX as DB Transaction
    participant Outbox as EventOutbox table
    participant Relay as OutboxRelay (background)
    participant Bus as EventBus
    participant Subs as Subscribers

    Note over Camera,Subs: ── Step 1: Atomic dual-write (ACID transaction) ──
    Camera->>UC: publishEvent(envelope)
    UC->>TX: BEGIN TRANSACTION
    UC->>TX: INSERT EventEnvelopeRecord
    UC->>Outbox: INSERT row (status=PENDING)
    UC->>TX: COMMIT
    Note right of TX: Either BOTH writes succeed, or NEITHER.<br/>No more dual-write problem.

    Note over Camera,Subs: ── Step 2: Eager dispatch attempt (best-effort) ──
    UC->>Bus: publish(envelope)
    Bus->>Subs: handle(envelope)
    Subs-->>Bus: OK
    Bus-->>UC: success
    UC->>Outbox: markPublished(event_id) → status=PUBLISHED

    Note over Camera,Subs: ── If subscriber CRASHES during step 2 ──
    UC->>Bus: publish(envelope)
    Bus->>Subs: handle(envelope) 💥 CRASH
    Bus-->>UC: error
    UC->>Outbox: recordFailure(event_id, error)<br/>attemptCount++, status stays PENDING

    Note over Camera,Subs: ── Step 3: Background relay retries ──
    loop Every poll interval
        Relay->>Outbox: findPending() ORDER BY created_at
        Outbox-->>Relay: [pending rows]
        Relay->>Bus: publish(envelope) for each
        Bus->>Subs: handle(envelope)
        Subs-->>Bus: OK (idempotent — already-processed events are skipped)
        Bus-->>Relay: success
        Relay->>Outbox: markPublished(event_id)
    end

    Note over Outbox: After max retries → status=FAILED (visible in admin UI for replay)
```

---

## What to Point At in Viva

1. **Step 1 (transaction box):** The business record AND the outbox row are written **inside the same DB transaction**. This is the atomic guarantee that kills the Dual Write Problem.
2. **Step 2 (eager dispatch):** Optimistic publish — keeps latency low when everything is healthy.
3. **Crash branch:** If a subscriber crashes, the outbox row **stays PENDING** with an incremented `attemptCount`. Nothing is lost.
4. **Step 3 (relay):** Background process retries every PENDING row until it succeeds. This is what makes delivery **guaranteed**.
5. **Idempotency synergy:** The relay's retry is safe because subscribers already use the Idempotent Receiver Pattern (CLO 3 Task 4). Same `event_id` published twice → still only one penalty.
6. **FAILED state:** After `maxAttempts`, the row flips to terminal FAILED. Visible in the admin UI for manual replay.

---

## Source Files

- Repository: [apps/api/src/infrastructure/repositories/OutboxRepository.ts](../../apps/api/src/infrastructure/repositories/OutboxRepository.ts)
- DB schema: [prisma/schema.prisma](../../prisma/schema.prisma) → `EventOutbox` model
- Test: [apps/api/tests/outbox-pattern.spec.ts](../../apps/api/tests/outbox-pattern.spec.ts) — proves atomic dual-write + retry on crash
- Written analysis: [docs/07_CLO4_ANALYSIS_ADR.md](../07_CLO4_ANALYSIS_ADR.md) → Scenario 3
