# Figure 3: Idempotent Receiver Sequence Diagram

> **Requirement covered:** CLO 3 Task 4 — Idempotent Receiver Pattern
> **Code evidence:** `BaseIdempotentSubscriber.ts`, `ProcessedEventRepository.ts`

---

## Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Camera
    participant EventBus
    participant AlertService
    participant ProcessedEventRepository
    participant Database

    Camera->>EventBus: publish(SpeedViolationEvent, event_id: 123)
    EventBus->>AlertService: handle(envelope)
    
    rect rgb(240, 248, 255)
        note right of AlertService: First Attempt
        AlertService->>ProcessedEventRepository: exists("123", "AlertService")
        ProcessedEventRepository-->>AlertService: false (not found)
        AlertService->>Database: INSERT Penalty
        AlertService->>ProcessedEventRepository: markProcessed("123", "AlertService")
    end

    Camera->>EventBus: publish(SpeedViolationEvent, event_id: 123)
    note right of Camera: Network retry sends EXACT same event
    EventBus->>AlertService: handle(envelope)
    
    rect rgb(255, 240, 245)
        note right of AlertService: Duplicate Attempt
        AlertService->>ProcessedEventRepository: exists("123", "AlertService")
        ProcessedEventRepository-->>AlertService: true (found)
        AlertService-->>EventBus: return (skip silently)
        note right of AlertService: Result: Only ONE penalty row exists.
    end
```
