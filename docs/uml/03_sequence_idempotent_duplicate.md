# UML 3 — Idempotent Receiver Sequence Diagram

> **Supports CEP rubric — CLO 3 Task 4 (10 marks)**
> Shows what happens when the SAME `SpeedViolationEvent` (same `event_id`) is published twice. AlertService must create only ONE penalty.

---

## Diagram

```mermaid
sequenceDiagram
    autonumber
    participant Camera
    participant Bus as EventBus
    participant Alert as AlertService (extends BaseIdempotentSubscriber)
    participant Repo as ProcessedEventRepository
    participant DB as Penalty Table

    Note over Camera,DB: ── First attempt — event_id = "evt-123" ──
    Camera->>Bus: publish(envelope, event_id="evt-123")
    Bus->>Alert: handle(envelope)
    Alert->>Repo: exists("evt-123", "AlertService")?
    Repo-->>Alert: false (never seen)
    Alert->>DB: INSERT Penalty(event_id="evt-123")
    DB-->>Alert: OK
    Alert->>Repo: markProcessed("evt-123", "AlertService")
    Repo-->>Alert: OK
    Alert-->>Bus: done (processedCount = 1)

    Note over Camera,DB: ── Duplicate attempt — same event_id "evt-123" ──
    Camera->>Bus: publish(envelope, event_id="evt-123")
    Bus->>Alert: handle(envelope)
    Alert->>Repo: exists("evt-123", "AlertService")?
    Repo-->>Alert: true (already processed)
    Note right of Alert: SILENTLY SKIP — no DB write
    Alert-->>Bus: done (duplicateIgnoredCount = 1)

    Note over DB: Final state: ONLY ONE Penalty row exists
```

---

## What to Point At in Viva

1. **Steps 3-4 (first attempt):** repo says "never seen" → process runs → penalty inserted.
2. **Step 7 (first attempt):** `markProcessed` records `(event_id, subscriber_name)`. **Per-subscriber tracking** — AlertService and LoggingService each have their own log.
3. **Step 11 (duplicate):** repo says "already processed" → handle returns early. **`process()` is never called the second time.**
4. **Final state box:** ONE penalty in DB. This is exactly what the CEP rubric asks the test to prove.
5. **Double safety net:** Even if the in-memory check fails, the DB unique constraint `Penalty @unique(eventId)` blocks the second insert.

---

## Source Files

- Template Method: [apps/api/src/domain/subscribers/BaseIdempotentSubscriber.ts](../../apps/api/src/domain/subscribers/BaseIdempotentSubscriber.ts) (lines 50-64)
- AlertService: [apps/api/src/domain/subscribers/AlertService.ts](../../apps/api/src/domain/subscribers/AlertService.ts)
- Test proving it: [apps/api/tests/idempotency.spec.ts](../../apps/api/tests/idempotency.spec.ts) (10 tests)
- Live demo endpoint: `POST /api/events/publish-duplicate-speed-violation` → returns `{ published_attempts: 2, penalties_created: 1, duplicate_ignored_by_alert: 1 }`
- UI demo: Dashboard → "Idempotency Demo" red button (screenshot `04-duplicate-alert-safety.png`)
