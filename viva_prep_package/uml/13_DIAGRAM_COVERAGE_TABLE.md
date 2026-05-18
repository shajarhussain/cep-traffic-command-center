# Diagram Coverage Table

| Diagram Name | CEP Requirement Covered | Code Files Used | Status |
| --- | --- | --- | --- |
| `01_class_diagram_observer` | CLO 3 Task 2 — Observer Pattern Class Diagram | `IEventSubscriber.ts`, `EventBus.ts`, `BaseIdempotentSubscriber.ts`, Subscriber Services | **Required** |
| `02_class_diagram_envelope` | CLO 3 Task 3 — Event Envelope Pattern | `EventEnvelope.ts`, `EventTypes.ts`, `createEnvelope.ts` | Supporting |
| `03_sequence_idempotent_duplicate` | CLO 3 Task 4 — Idempotent Receiver Pattern | `BaseIdempotentSubscriber.ts`, `ProcessedEventRepository.ts` | Supporting |
| `04_sequence_outbox_pattern` | CLO 4 Scenario 3 — Outbox Pattern | `PublishEventUseCase.ts`, `OutboxRelay.ts`, `OutboxRepository.ts` | Supporting |
| `05_component_diagram` | High-level architecture overview | System-wide structure (`apps/api`, `apps/web`) | Supporting |
| `06_bounded_queue_scenario` | CLO 4 Scenario 2 — Event Flood | `BoundedEventQueue.ts`, `EVENT_PRIORITY` map | Supporting |

---

# Missing / Unverified Information List

*   **None.** Every class, interface, database table, mathematical calculation (23.81s queue time), priority map, and code path represented in the generated UML diagrams has been strictly verified against the actual V3 TypeScript codebase. There are no missing or "invented" components.
