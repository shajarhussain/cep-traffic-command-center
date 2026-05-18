# Figure 6: Bounded Queue / Event Flood Scenario

> **Requirement covered:** CLO 4 Scenario 2 — Event Flood / Bounded Queue Eviction
> **Code evidence:** `BoundedEventQueue.ts` (`calculateSecondsUntilFull`, `EVENT_PRIORITY`)

---

## Diagram

```mermaid
flowchart TD
    subgraph Inputs["Event Ingestion"]
        In["Incoming Rate: 500 events/sec"]
    end

    subgraph QueueSystem["BoundedEventQueue"]
        QLimit["Queue Capacity: 10,000 events"]
        Math["Backlog Growth: 500 - 80 = 420 events/sec<br/>Time to Full: 10,000 / 420 = 23.81 seconds"]
        
        subgraph Eviction["Eviction Policy (Priority-Aware)"]
            direction TB
            P4["Priority 4 (CRITICAL): CongestionAlertEvent"]
            P3["Priority 3 (HIGH): SpeedViolationEvent"]
            P2["Priority 2 (MEDIUM): TrafficClearedEvent"]
            P1["Priority 1 (LOW): VehicleDetectedEvent"]
            Note["Rule: Drop least important event first.<br/>CRITICAL alerts are preserved over routine detections."]
            
            P4 --- P3 --- P2 --- P1 --- Note
        end
        
        QLimit --- Math --- Eviction
    end

    subgraph Consumer["Slow Subscriber"]
        Out["DashboardService Processing Rate: 80 events/sec"]
    end

    In -->|500/sec| QueueSystem
    QueueSystem -->|80/sec| Consumer
```
