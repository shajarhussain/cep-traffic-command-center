# Figure 2: Event Envelope Pattern Class Diagram

> **Requirement covered:** CLO 3 Task 3 — Event Envelope Pattern
> **Code evidence:** `EventEnvelope.ts`, `EventTypes.ts`, `createEnvelope.ts`

---

## Diagram

```mermaid
classDiagram
    direction TB

    class EventEnvelope~TPayload~ {
        +event_id: string
        +correlation_id: string
        +schema_version: number
        +source_id: string
        +timestamp: string
        +event_type: string
        +payload: TPayload
    }

    class VehicleDetectedPayload {
        +vehicle_plate: string
        +intersection_name: string
        +lane_number?: number
    }

    class SpeedViolationPayload {
        +vehicle_plate: string
        +speed_kmh: number
        +speed_limit_kmh: number
        +intersection_name: string
    }

    class CongestionAlertPayload {
        +intersection_name: string
        +vehicle_count: number
        +congestion_level: string
    }

    class TrafficClearedPayload {
        +intersection_name: string
        +cleared_at: string
    }

    class Factory {
        <<factory>>
        +createEnvelope(params) EventEnvelope
    }

    EventEnvelope *-- VehicleDetectedPayload : contains
    EventEnvelope *-- SpeedViolationPayload : contains
    EventEnvelope *-- CongestionAlertPayload : contains
    EventEnvelope *-- TrafficClearedPayload : contains
    Factory ..> EventEnvelope : creates
```
