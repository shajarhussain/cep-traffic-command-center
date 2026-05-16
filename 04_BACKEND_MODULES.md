# Backend Modules

## Recommended backend stack
Use TypeScript with Express or Fastify. Keep the backend small and testable. The goal is to prove design patterns, not to build a huge production platform.

## Module map
```text
apps/api/src/
  main.ts
  app.ts
  domain/
    events/
      EventEnvelope.ts
      EventTypes.ts
      EventPriority.ts
      createEnvelope.ts
    subscribers/
      IEventSubscriber.ts
      BaseIdempotentSubscriber.ts
      AlertService.ts
      LoggingService.ts
      DashboardService.ts
      ReportingService.ts
    bus/
      EventBus.ts
      BoundedEventQueue.ts
  application/
    CameraSimulator.ts
    PublishEventUseCase.ts
    DuplicateSpeedViolationUseCase.ts
    bootstrapSubscribers.ts
  infrastructure/
    repositories/
      EventRepository.ts
      ProcessedEventRepository.ts
      PenaltyRepository.ts
      AuditLogRepository.ts
      DashboardRepository.ts
      ReportRepository.ts
      OutboxRepository.ts
  interfaces/http/
    camera.routes.ts
    event.routes.ts
    subscriber.routes.ts
    penalty.routes.ts
    log.routes.ts
    report.routes.ts
    queue.routes.ts
  tests/
    eventbus.spec.ts
    idempotency.spec.ts
    envelope.spec.ts
    bounded-queue.spec.ts
    fifth-event-type.spec.ts
```

## Domain event types
```ts
export type EventType =
  | "VehicleDetectedEvent"
  | "SpeedViolationEvent"
  | "CongestionAlertEvent"
  | "TrafficClearedEvent";

export interface VehicleDetectedPayload {
  vehicle_plate: string;
  intersection_name: string;
  lane_number?: number; // optional for schema evolution scenario
}

export interface SpeedViolationPayload {
  vehicle_plate: string;
  speed_kmh: number;
  speed_limit_kmh: number;
  intersection_name: string;
}

export interface CongestionAlertPayload {
  intersection_name: string;
  vehicle_count: number;
  congestion_level: "HIGH" | "CRITICAL";
}

export interface TrafficClearedPayload {
  intersection_name: string;
  cleared_at: string;
}
```

## Event envelope
```ts
export interface EventEnvelope<TPayload = unknown> {
  event_id: string;
  correlation_id: string;
  schema_version: number;
  source_id: string;
  timestamp: string;
  event_type: string;
  payload: TPayload;
  priority?: "LOW" | "NORMAL" | "HIGH" | "CRITICAL";
}
```

## Subscriber interface
```ts
export interface IEventSubscriber<TPayload = unknown> {
  readonly name: string;
  readonly supportedEventTypes: string[];
  handle(envelope: EventEnvelope<TPayload>): Promise<void>;
}
```

## Base idempotent subscriber
```ts
export abstract class BaseIdempotentSubscriber<TPayload = unknown>
  implements IEventSubscriber<TPayload> {
  abstract readonly name: string;
  abstract readonly supportedEventTypes: string[];

  constructor(private readonly processedRepo: ProcessedEventRepository) {}

  async handle(envelope: EventEnvelope<TPayload>): Promise<void> {
    const alreadyProcessed = await this.processedRepo.exists(
      envelope.event_id,
      this.name,
    );

    if (alreadyProcessed) {
      return;
    }

    await this.process(envelope);
    await this.processedRepo.markProcessed(envelope.event_id, this.name);
  }

  protected abstract process(envelope: EventEnvelope<TPayload>): Promise<void>;
}
```

## EventBus skeleton
```ts
export class EventBus {
  private subscribers = new Map<string, Set<IEventSubscriber>>();

  subscribe(eventType: string, subscriber: IEventSubscriber): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(subscriber);
  }

  unsubscribe(eventType: string, subscriber: IEventSubscriber): void {
    this.subscribers.get(eventType)?.delete(subscriber);
  }

  async publish(envelope: EventEnvelope): Promise<void> {
    const targets = this.subscribers.get(envelope.event_type) ?? new Set();
    for (const subscriber of targets) {
      await subscriber.handle(envelope);
    }
  }
}
```

## Bounded queue skeleton
```ts
export class BoundedEventQueue {
  private queue: EventEnvelope[] = [];

  constructor(private readonly maxSize: number) {}

  enqueue(envelope: EventEnvelope): void {
    if (this.queue.length < this.maxSize) {
      this.queue.push(envelope);
      return;
    }

    const dropIndex = this.findLeastImportantOldestIndex();
    this.queue.splice(dropIndex, 1);
    this.queue.push(envelope);
  }

  dequeue(): EventEnvelope | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }

  private findLeastImportantOldestIndex(): number {
    const rank = { LOW: 1, NORMAL: 2, HIGH: 3, CRITICAL: 4 } as const;
    let selectedIndex = 0;
    let selectedRank = Number.POSITIVE_INFINITY;

    this.queue.forEach((event, index) => {
      const eventRank = rank[(event.priority ?? "NORMAL") as keyof typeof rank];
      if (eventRank < selectedRank) {
        selectedRank = eventRank;
        selectedIndex = index;
      }
    });

    return selectedIndex;
  }
}
```

## HTTP endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | server health |
| `GET` | `/api/cameras` | list cameras |
| `POST` | `/api/cameras` | create camera |
| `POST` | `/api/events/publish` | publish selected event |
| `POST` | `/api/events/publish-duplicate-speed-violation` | duplicate test |
| `GET` | `/api/events` | list event envelopes |
| `GET` | `/api/subscribers` | subscriber status |
| `POST` | `/api/subscribers/:name/subscribe` | subscribe service |
| `POST` | `/api/subscribers/:name/unsubscribe` | unsubscribe service |
| `GET` | `/api/penalties` | penalty table |
| `GET` | `/api/logs` | audit logs |
| `GET` | `/api/reports` | reporting data |
| `GET` | `/api/queue/status` | queue size/dropped count |
| `POST` | `/api/queue/flood-test` | generate many events |

## Fifth event type proof
Add this event without changing camera code:

```ts
export interface EmergencyVehiclePayload {
  vehicle_plate: string;
  intersection_name: string;
  route_priority: "AMBULANCE" | "FIRE" | "POLICE";
}

const envelope = createEnvelope<EmergencyVehiclePayload>({
  source_id: "CAM-ISB-001",
  event_type: "EmergencyVehicleEvent",
  payload: {
    vehicle_plate: "AMB-101",
    intersection_name: "Stadium Road",
    route_priority: "AMBULANCE",
  },
  priority: "CRITICAL",
});

bus.publish(envelope);
```

The camera still calls the same `publish(envelope)` method. Only new subscriber behavior is added separately.
