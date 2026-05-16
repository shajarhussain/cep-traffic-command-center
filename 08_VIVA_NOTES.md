# Viva Notes — Simple Answers

## What is Event-Driven Architecture in this project?
Traffic cameras publish events to an EventBus. Services subscribe to the events they care about. The camera does not know which service will receive the event.

## Why did you use EventBus?
It decouples publishers from subscribers. Adding a new service later does not require changing camera code.

## What are the four required event types?
1. `VehicleDetectedEvent`
2. `SpeedViolationEvent`
3. `CongestionAlertEvent`
4. `TrafficClearedEvent`

## Which services subscribe to which event?
- VehicleDetectedEvent: DashboardService, ReportingService
- SpeedViolationEvent: AlertService, LoggingService, ReportingService
- CongestionAlertEvent: DashboardService, LoggingService
- TrafficClearedEvent: DashboardService

## What is Observer Pattern here?
The EventBus is the subject/publisher. Services are observers/subscribers. All subscribers implement `IEventSubscriber`, so the bus depends on an interface instead of concrete classes.

## Why does the bus store interface references?
Because it should not depend on specific classes. This improves flexibility and follows dependency inversion.

## What is Event Envelope Pattern?
It wraps the payload with metadata such as event ID, correlation ID, source, timestamp, version, and event type.

## Why do we need `event_id`?
To uniquely identify an event and prevent duplicate processing.

## What is Idempotent Receiver Pattern?
It means a receiver can safely receive the same event more than once without repeating the business action. In this project, AlertService checks whether it already processed the event ID before creating a penalty.

## What proof did you implement for idempotency?
The same `SpeedViolationEvent` with the same `event_id` is published twice. AlertService creates only one penalty notice.

## How can you add a fifth event without changing camera code?
Because the camera uses a generic `publish(envelope)` method. We can create a new event type and subscribe a new service without changing the camera's publish logic.

## What happens if too many events arrive?
The bounded queue stops unlimited memory growth. When full, it drops less important events first.

## Why not always drop the oldest event?
Because an old critical congestion alert can be more important than a new routine vehicle detection. Priority-aware dropping is safer.

## What is the queue calculation?
Incoming rate is 500 events/sec. Dashboard can process 80 events/sec. Backlog grows by 420 events/sec. A queue of 10,000 fills in 10,000 / 420 = 23.81 seconds.

## What is the Dual Write Problem?
It occurs when two related writes happen in different places and one succeeds while the other fails. Example: penalty created but audit log not written.

## What is the Outbox Pattern?
Write the event to a database outbox first. A background worker publishes it later and retries if needed. This prevents event loss.

## Is Outbox worth it here?
Yes for penalty-related events because legal traceability matters more than a small delay or extra implementation complexity.

## What is the difference between backward compatibility and schema versioning?
Backward compatibility adds optional fields so old subscribers still work. Schema versioning creates a clear new version and lets subscribers decide which versions they support.

## Which schema option did you choose for `lane_number`?
For an additive field like `lane_number`, optional backward compatibility is acceptable. For breaking changes, explicit versioning is better.
