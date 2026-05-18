# Figure 4: Outbox Pattern Sequence Diagram

> **Requirement covered:** CLO 4 Scenario 3 — Dual Write Problem / Outbox Pattern
> **Code evidence:** `PublishEventUseCase.ts`, `OutboxRelay.ts`, `OutboxRepository.ts`

---

## Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Camera
    participant PublishEventUseCase
    participant Database as Prisma DB
    participant OutboxRelay as Background Worker
    participant EventBus
    participant Subscriber

    Camera->>PublishEventUseCase: POST /api/events/publish
    
    rect rgb(240, 248, 255)
        note right of PublishEventUseCase: Atomic Transaction
        PublishEventUseCase->>Database: BEGIN TX
        PublishEventUseCase->>Database: INSERT EventOutbox (status: PENDING)
        PublishEventUseCase->>Database: COMMIT TX
    end

    PublishEventUseCase-->>Camera: 202 Accepted

    note right of OutboxRelay: Solves Dual Write Problem: Event is not lost if service crashes
    loop Every 5 seconds
        OutboxRelay->>Database: SELECT FROM EventOutbox WHERE status = 'PENDING'
        Database-->>OutboxRelay: Pending Records
        
        OutboxRelay->>EventBus: publish(envelope)
        EventBus->>Subscriber: handle(envelope)
        
        alt On Success
            OutboxRelay->>Database: UPDATE EventOutbox SET status = 'PUBLISHED'
        else On Failure / Crash
            OutboxRelay->>Database: INCREMENT attemptCount, remain 'PENDING' (will retry)
        end
    end
```
