# UI Modules and Screen Possibilities

The UI should make the design patterns visible to the evaluator. Avoid a generic dashboard that hides the EventBus logic. Every screen should help prove a CEP requirement.

## UI style direction
Use a clean command-center style:

- dark navy or white/green academic dashboard theme;
- top status bar showing active cameras, events/minute, queue depth, duplicate ignored count;
- cards for each subscriber;
- event timeline with envelope metadata visible;
- clear badges: `LOW`, `NORMAL`, `HIGH`, `CRITICAL`, `DUPLICATE IGNORED`.

## Screen 1 — System Overview Dashboard

### Purpose
Shows that the whole event-driven system is alive.

### Widgets
- Active cameras count
- Total events published
- Queue depth
- Dropped events count
- Penalties issued
- Duplicate events ignored
- Current congestion map/list
- Subscriber health cards

### Judge proof
The judge can see that one event can affect multiple services.

## Screen 2 — Camera Simulator

### Purpose
Lets the user publish the required event types.

### Fields
- Camera dropdown
- Event type dropdown:
  - `VehicleDetectedEvent`
  - `SpeedViolationEvent`
  - `CongestionAlertEvent`
  - `TrafficClearedEvent`
  - optional demo: `EmergencyVehicleEvent`
- Vehicle plate
- Speed
- Speed limit
- Intersection
- Vehicle count
- Congestion level
- Priority
- Button: `Publish Event`
- Button: `Publish Duplicate Speed Violation`

### Judge proof
The duplicate button must publish the same `event_id` twice and show only one penalty.

## Screen 3 — Event Envelope Inspector

### Purpose
Shows Event Envelope Pattern directly.

### Table columns
- `event_id`
- `correlation_id`
- `schema_version`
- `source_id`
- `timestamp`
- `event_type`
- `priority`
- payload preview

### Detail panel
When clicking an event, show full JSON envelope:

```json
{
  "event_id": "uuid",
  "correlation_id": "journey-123",
  "schema_version": 1,
  "source_id": "CAM-ISB-001",
  "timestamp": "2026-05-14T10:00:00.000Z",
  "event_type": "SpeedViolationEvent",
  "payload": {
    "vehicle_plate": "ABC-123",
    "speed_kmh": 92,
    "speed_limit_kmh": 60
  }
}
```

## Screen 4 — Subscriber Monitor

### Purpose
Shows Observer Pattern implementation.

### Cards
- AlertService
- LoggingService
- DashboardService
- ReportingService

Each card shows:
- subscribed event types;
- processed count;
- duplicate ignored count;
- latest processed event;
- status: online/offline.

### Actions
- Subscribe/unsubscribe service to a specific event type.
- Publish event and prove unsubscribed service no longer receives it.

## Screen 5 — Penalty Notices

### Purpose
Proves `AlertService` and idempotent receiver.

### Table columns
- penalty ID
- event ID
- vehicle plate
- speed
- limit
- fine
- status
- issued time

### Special evidence block
Show:

```text
Duplicate test result:
SpeedViolationEvent published 2 times with same event_id.
Penalty notices created: 1.
Result: PASS.
```

## Screen 6 — Audit Logs

### Purpose
Shows LoggingService and legal audit trail.

### Table columns
- log ID
- event ID
- event type
- message
- timestamp
- payload snapshot

## Screen 7 — Queue / Overload Lab

### Purpose
Supports CLO 4 Scenario 2.

### Inputs
- incoming rate: default `500 events/sec`
- DashboardService processing rate: default `80 events/sec`
- max queue size: default `10,000`
- eviction policy:
  - drop oldest
  - drop least important

### Output
- backlog growth: `420 events/sec`
- time to 10,000: `23.81 seconds`
- dropped events by priority
- queue visual progress bar

### Recommended policy
Use **priority-aware eviction**:
- never drop `CRITICAL` if a lower-priority event exists;
- prefer dropping `LOW` routine vehicle detections;
- if all are same priority, drop oldest.

## Screen 8 — Reports

### Purpose
Shows `ReportingService`.

### Charts/tables
- events by type
- events by camera
- speed violations by intersection
- congestion alerts by hour

## Screen 9 — Architecture Evidence Page

### Purpose
Makes viva easier.

### Content
- UML class diagram
- EventBus flow diagram
- EventEnvelope fields
- duplicate event test result
- fifth event type proof
- ADR summaries

## Minimal UI route map
```text
/                         System Overview
/cameras                  Camera management + simulator
/events                   Event envelope timeline
/subscribers              Observer/subscriber monitor
/penalties                Penalty notices
/logs                     Audit logs
/queue-lab                Bounded queue lab
/reports                  Reporting dashboard
/architecture             Design pattern evidence
```

## Component list
```text
StatusCard
EventTypeBadge
PriorityBadge
CameraSimulatorForm
EventTimelineTable
EnvelopeJsonViewer
SubscriberCard
PenaltyTable
AuditLogTable
QueuePressureMeter
ArchitectureDiagramPanel
DuplicateTestPanel
```
