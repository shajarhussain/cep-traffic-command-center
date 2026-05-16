# Agent Rules for CEP Implementation

Use this as a rule file or project instruction for Antigravity.

## Academic integrity and correctness
- Do not invent requirements beyond the CEP brief.
- Do not claim tests pass unless they actually run.
- Do not create fake screenshots or fake terminal output.
- Do not hide failing tests.
- Do not add complex features that distract from the rubric.

## Code quality
- Use TypeScript strictly.
- Keep domain logic separate from HTTP routes.
- Keep UI logic separate from backend logic.
- Prefer small classes and focused functions.
- Add tests next to every design-pattern implementation.

## Required names
Use these exact names so the report and code match:
- `EventBus`
- `IEventSubscriber`
- `EventEnvelope`
- `VehicleDetectedEvent`
- `SpeedViolationEvent`
- `CongestionAlertEvent`
- `TrafficClearedEvent`
- `AlertService`
- `LoggingService`
- `DashboardService`
- `ReportingService`
- `BaseIdempotentSubscriber`
- `BoundedEventQueue`
- `EventOutbox`

## Event handling rules
- Cameras call only `publish(envelope)`.
- EventBus must not instantiate subscriber classes.
- Subscribers must not modify the envelope identity.
- Duplicate detection is based on `event_id` and `subscriber_name`.
- Penalty table must also have unique `event_id`.

## UI rules
- UI should display proof, not just decoration.
- Every major pattern should have a visible evidence panel.
- Duplicate test must be easy to run from the UI.
- Queue lab must show the `23.81 seconds` calculation.

## Documentation rules
- Keep wording academic and direct.
- Avoid AI-sounding filler.
- Every section should map to a rubric item.
- Include UML and flow diagrams in Mermaid.
- Keep final report truthful to actual implementation.

## Safety rules
- Do not run destructive terminal commands without review.
- Do not expose `.env` values.
- Do not give MCPs broad access outside workspace.
- Do not install random packages if a built-in/simple implementation works.
