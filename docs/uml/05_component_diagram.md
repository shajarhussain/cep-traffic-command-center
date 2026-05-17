# UML 5 — System Component / Deployment View

> **System overview** — shows the full deployed architecture: cameras, API, EventBus, subscribers, database, and the web dashboard.

---

## Diagram

```mermaid
flowchart LR
    subgraph Field["Field Layer"]
        Cam1[Camera 1<br/>Intersection A]
        Cam2[Camera 2<br/>Intersection B]
        CamN[Camera N<br/>...]
    end

    subgraph API["API Layer — Node/Express"]
        REST["REST Endpoints<br/>POST /api/events/publish<br/>POST /api/events/publish-duplicate-speed-violation<br/>GET /api/queue/analysis<br/>GET /api/subscribers"]
        UC[PublishEventUseCase]
        Bus(((EventBus<br/>Map String → Set IEventSubscriber)))
        BQ[BoundedEventQueue<br/>maxSize=10 000<br/>priority eviction]
        Relay[OutboxRelay<br/>background poller]
    end

    subgraph Subs["Subscriber Layer (Observers)"]
        Alert[AlertService<br/>→ penalty notices]
        Log[LoggingService<br/>→ audit log]
        Dash[DashboardService<br/>→ live state]
        Rep[ReportingService<br/>→ aggregates]
    end

    subgraph DB["Persistence — Prisma + SQLite/Postgres"]
        EventDB[(EventEnvelopeRecord)]
        OutboxDB[(EventOutbox<br/>PENDING / PUBLISHED / FAILED)]
        ProcDB[(ProcessedEvent<br/>UNIQUE event_id + subscriber_name)]
        PenDB[(Penalty<br/>UNIQUE event_id)]
        AuditDB[(AuditLog)]
        DashDB[(IntersectionState)]
        RepDB[(ReportAggregates)]
    end

    subgraph UI["Web Dashboard — React"]
        CC[Command Center]
        Sim[Alert Simulator]
        Insp[Event Inspector]
        IdemUI[Idempotency Demo]
        QueueUI[Capacity Monitor]
        OutboxUI[Outbox Admin]
    end

    Cam1 --> REST
    Cam2 --> REST
    CamN --> REST
    REST --> UC
    UC -->|atomic txn| EventDB
    UC -->|atomic txn| OutboxDB
    UC -->|eager dispatch| Bus
    Relay -->|polls PENDING| OutboxDB
    Relay -->|retry publish| Bus
    Bus --> Alert
    Bus --> Log
    Bus -->|via queue| BQ --> Dash
    Bus --> Rep
    Alert --> ProcDB
    Alert --> PenDB
    Log --> ProcDB
    Log --> AuditDB
    Dash --> ProcDB
    Dash --> DashDB
    Rep --> ProcDB
    Rep --> RepDB
    UI -.->|HTTP| REST
```

---

## What to Point At in Viva

1. **Three horizontal layers:** Field (cameras), API (logic + bus), Subscribers (4 observers). Database sits behind everything.
2. **Cameras only know REST endpoint** — they don't know AlertService, LoggingService, etc. exist.
3. **EventBus in the middle** — single point of fan-out. Adding a 5th subscriber = adding one more arrow out of `Bus`.
4. **Outbox path** — `UC → atomic txn → OutboxDB` then `Relay → Bus`. This is the dual-write fix.
5. **BoundedEventQueue between Bus and DashboardService** — protects the slow consumer (80 events/sec) from the fast producer (500 events/sec).
6. **ProcessedEvent table is shared** — every subscriber writes to it; idempotency check is per `(event_id, subscriber_name)` pair.

---

## Source Files / Mapping

| Component in diagram | Code location |
|---|---|
| REST endpoints | [apps/api/src/interfaces/http/routes/](../../apps/api/src/interfaces/http/routes/) |
| PublishEventUseCase | [apps/api/src/application/usecases/PublishEventUseCase.ts](../../apps/api/src/application/usecases/PublishEventUseCase.ts) |
| EventBus | [apps/api/src/domain/bus/EventBus.ts](../../apps/api/src/domain/bus/EventBus.ts) |
| BoundedEventQueue | [apps/api/src/domain/bus/BoundedEventQueue.ts](../../apps/api/src/domain/bus/BoundedEventQueue.ts) |
| Subscribers | [apps/api/src/domain/subscribers/](../../apps/api/src/domain/subscribers/) |
| Outbox repo | [apps/api/src/infrastructure/repositories/OutboxRepository.ts](../../apps/api/src/infrastructure/repositories/OutboxRepository.ts) |
| Prisma schema | [prisma/schema.prisma](../../prisma/schema.prisma) |
| Web UI | [apps/web/src/](../../apps/web/src/) |
