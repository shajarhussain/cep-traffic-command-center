# Figure 5: System Component / Deployment Diagram

> **Requirement covered:** High-level architecture overview
> **Code evidence:** Monorepo architecture (`apps/api`, `apps/web`), Prisma schema, EventBus layout

---

## Diagram

```mermaid
flowchart TD
    subgraph Field["Field Layer"]
        C[Traffic Cameras]
    end

    subgraph API["API Layer (Node/Express)"]
        REST[REST Endpoints]
        UC[PublishEventUseCase]
        Relay[OutboxRelay]
    end

    subgraph Core["Event Core"]
        Bus(((EventBus)))
        BQ[BoundedEventQueue]
    end

    subgraph Subscribers["Subscriber Layer (Observers)"]
        A[AlertService]
        L[LoggingService]
        D[DashboardService]
        R[ReportingService]
    end

    subgraph DB["Persistence Layer (Prisma + SQLite/Postgres)"]
        OutboxDB[(EventOutbox)]
        ProcDB[(ProcessedEvent)]
        PenDB[(Penalty)]
        AudDB[(AuditLog)]
        DashDB[(IntersectionState)]
        RepDB[(ReportAggregates)]
    end

    subgraph UI["Frontend Layer (React)"]
        Web[Web Dashboard]
    end

    C -->|HTTP POST| REST
    REST --> UC
    UC -->|atomic txn| OutboxDB
    Relay -->|polls PENDING| OutboxDB
    Relay -->|publishes| Bus
    
    Bus --> A
    Bus --> L
    Bus --> BQ --> D
    Bus --> R

    A -->|checks/inserts| ProcDB
    A -->|inserts| PenDB
    L -->|checks/inserts| ProcDB
    L -->|inserts| AudDB
    D -->|checks/inserts| ProcDB
    D -->|updates| DashDB
    R -->|checks/inserts| ProcDB
    R -->|updates| RepDB

    UI -.->|HTTP GET| REST
```
