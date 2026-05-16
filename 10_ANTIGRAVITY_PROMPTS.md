# Antigravity Implementation Prompts

Use these prompts one by one. Do not ask the agent to build everything in one pass. The project becomes stronger if each mission has one clear output and tests.

## First prompt — initialize the project
```text
You are helping me build my Software Design and Architecture CEP project: Event-Driven Traffic Alert System.

Read the project context and requirements in the markdown files. Build a clean TypeScript monorepo with:
- apps/api for backend
- apps/web for React dashboard
- packages/shared for shared event types
- prisma for database schema
- docs for diagrams and report material

Do not overbuild. The grading focus is EventBus, Observer Pattern, Event Envelope Pattern, Idempotent Receiver Pattern, bounded queue analysis, schema evolution ADR, and Outbox Pattern analysis.

Before coding, create an implementation plan that maps each file you will create to the CEP rubric. Wait for review before writing major code.
```

## Prompt 2 — backend domain and event envelope
```text
Implement the shared domain event types and EventEnvelope.

Create:
- EventEnvelope generic type with event_id, correlation_id, schema_version, source_id, timestamp, event_type, payload, and optional priority.
- payload types for VehicleDetectedEvent, SpeedViolationEvent, CongestionAlertEvent, TrafficClearedEvent.
- createEnvelope helper that generates UUID event_id and ISO timestamp.
- tests proving all required envelope fields exist.

Keep code readable and add comments only where they explain CEP design reasoning.
```

## Prompt 3 — Observer Pattern and EventBus
```text
Implement the Observer Pattern and EventBus.

Create:
- IEventSubscriber interface.
- EventBus class with subscribe, unsubscribe, and publish.
- The bus must store IEventSubscriber references, not concrete subscriber class references.
- Add tests showing a published event is delivered to all subscribers for that event type, unrelated subscribers do not receive it, and unsubscribe works.
- Add Mermaid UML diagram in docs showing IEventSubscriber, EventBus, AlertService, LoggingService, DashboardService, ReportingService.
```

## Prompt 4 — subscribers and idempotency
```text
Implement the Idempotent Receiver Pattern.

Create:
- BaseIdempotentSubscriber class.
- ProcessedEventRepository using Prisma or an in-memory repository for tests.
- AlertService that creates penalty for SpeedViolationEvent.
- LoggingService that writes audit log.
- DashboardService that updates live state.
- ReportingService that increments report aggregates.

Add a test where the same SpeedViolationEvent envelope with the same event_id is published twice and AlertService creates only one penalty notice.
```

## Prompt 5 — database schema
```text
Create the Prisma database schema for this CEP.

Tables/models needed:
- TrafficCamera
- EventEnvelopeRecord
- ProcessedEvent with unique event_id + subscriber_name
- Penalty with unique event_id
- AuditLog
- DashboardSnapshot
- ReportAggregate
- EventOutbox optional for analysis/prototype

Add seed data for 3 cameras around a stadium/intersection setting. Add repository classes with clean methods.
```

## Prompt 6 — HTTP API
```text
Create HTTP endpoints for the backend:
- health check
- camera list/create
- publish event
- publish duplicate speed violation demo
- event envelope list
- subscriber status
- penalties
- logs
- reports
- queue status
- queue flood test

Each endpoint should return JSON useful for the React UI. Add basic validation and helpful error messages.
```

## Prompt 7 — bounded queue
```text
Implement a BoundedEventQueue for overload handling.

Requirements:
- default max size 10,000
- enqueue and dequeue methods
- if full, evict the least important event first
- if same priority, evict the oldest
- priority order: LOW < NORMAL < HIGH < CRITICAL
- add tests proving max size and critical event preservation
- add docs showing the calculation 10,000 / (500 - 80) = 23.81 seconds
```

## Prompt 8 — frontend dashboard
```text
Build the React dashboard for the CEP.

Routes/screens:
- overview dashboard
- camera simulator
- event envelope inspector
- subscriber monitor
- penalty notices
- audit logs
- queue lab
- reports
- architecture evidence page

The UI must visibly prove the design patterns, especially envelope fields, subscriber delivery, duplicate event ignored, and queue behavior. Use simple but polished components.
```

## Prompt 9 — final docs and report material
```text
Generate and update markdown documentation for:
- requirements traceability matrix
- architecture explanation
- database design
- UI module guide
- design pattern explanation
- test plan
- CLO4 analysis with ADR
- viva notes

Make the writing academic, direct, and aligned with the assignment rubric. Do not include AI-looking disclaimers or fake results.
```

## Prompt 10 — final verification
```text
Run the full verification checklist:
- install succeeds
- database migration succeeds
- backend starts
- frontend starts
- all tests pass
- duplicate SpeedViolationEvent creates one penalty
- EventEnvelope contains all required fields
- fifth event type proof exists without camera code changes
- bounded queue max size and priority eviction tests pass
- docs contain UML and ADR

If anything fails, fix it and document the real result. Do not claim success without evidence.
```
