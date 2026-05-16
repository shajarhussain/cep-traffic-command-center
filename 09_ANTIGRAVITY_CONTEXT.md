# Antigravity Context File

Paste this file into the root of the repository or give it to the Antigravity agent as project context before implementation.

## Project identity
This is a Software Design and Architecture CEP project named **Event-Driven Traffic Alert System**.

## Non-negotiable assignment requirements
The project must implement:

1. EventBus with `publish`, `subscribe`, and `unsubscribe`.
2. Four required event types:
   - `VehicleDetectedEvent`
   - `SpeedViolationEvent`
   - `CongestionAlertEvent`
   - `TrafficClearedEvent`
3. Observer Pattern:
   - common `IEventSubscriber` interface;
   - EventBus stores interface references, not concrete service references;
   - four subscribers: `AlertService`, `LoggingService`, `DashboardService`, `ReportingService`.
4. Event Envelope Pattern:
   - `event_id`
   - `correlation_id`
   - `schema_version`
   - `source_id`
   - `timestamp`
   - `event_type`
   - `payload`
5. Idempotent Receiver Pattern:
   - each subscriber checks if it already processed `event_id`;
   - duplicate `SpeedViolationEvent` with same `event_id` creates only one penalty.
6. Bounded queue tactic for overload:
   - default max queue size: `10,000`;
   - use priority-aware eviction.
7. CLO4 written analysis:
   - schema evolution and ADR;
   - event flood calculation;
   - Dual Write Problem and Outbox Pattern.

## Implementation rules for the agent
- Do not replace the custom EventBus with Kafka, RabbitMQ, or Redis. The assignment requires us to build the EventBus to show design-pattern understanding.
- Use TypeScript types clearly.
- Keep code small, readable, and testable.
- Every feature must map to the traceability matrix.
- Avoid vague placeholder features that do not support the rubric.
- Add tests immediately after implementing each pattern.
- Do not create fake screenshots or fake test outputs.
- Do not hardcode pass messages without real tests.
- Keep UI as proof of backend behavior, not decoration only.

## Preferred tech stack
- Backend: Node.js + TypeScript + Express or Fastify.
- Frontend: React + Vite + TypeScript.
- DB: Prisma + SQLite locally.
- Tests: Vitest.
- Diagrams: Mermaid markdown.

## Definition of done
The project is done when:
- `npm test` passes;
- duplicate speed violation creates one penalty only;
- event envelope table shows all required fields;
- subscriber monitor shows the four subscribers and their event subscriptions;
- bounded queue test proves size limit and priority eviction;
- docs include UML and ADR;
- viva notes are accurate to actual code.
