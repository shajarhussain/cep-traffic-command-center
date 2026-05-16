# Incident-Aware Traffic Operations Command Center

> Built with TypeScript · Node.js 22 · Express 4 · Prisma (SQLite) · React 19 · Vite 8 · Vitest

---

## System Overview

A professional **incident-aware traffic operations platform** built on an event-driven architecture. Simulated traffic cameras publish typed events to a central **EventBus**. Five independent subscriber services react to those events — creating enforcement tickets, writing audit logs, updating live intersection state, producing reports, and managing incidents — without knowing about each other.

### V2 Enhancements

The V2 upgrade adds a **user-driven configuration layer** on top of the original event-driven engine:

- **No hardcoded cameras, intersections, or thresholds** — all values are configurable from the database and UI
- **Configurable alert templates** — operators define event templates for the simulator
- **Configurable severity policies** — thresholds are driven by database policies with sensible defaults
- **Configurable incident rules** — incident grouping logic is defined in the database
- **Configurable queue policies** — bounded queue parameters are runtime-configurable
- **Optional external traffic context** — TomTom Traffic API integration with automatic fallback
- **Incident operations** — group related alerts into operational incidents with acknowledge/close workflow
- **Traffic risk assessment** — combines internal events, incidents, queue analysis, and external context

### Core Patterns

| Pattern | Purpose |
|---|---|
| **Observer Pattern** | `EventBus` delivers events to `IEventSubscriber` references — no concrete class coupling |
| **Event Envelope Pattern** | Every event carries 7 required fields (event_id, correlation_id, schema_version, source_id, timestamp, event_type, payload) |
| **Idempotent Receiver Pattern** | `BaseIdempotentSubscriber` uses Template Method to prevent duplicate processing |
| **Bounded Queue** | `BoundedEventQueue` enforces capacity ceiling with priority-aware eviction |
| **Outbox Pattern** (prototype) | `EventOutbox` table + repository for reliable event delivery analysis |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5 (strict mode) |
| Runtime | Node.js 22 |
| API Framework | Express 4 |
| ORM / Database | Prisma + SQLite |
| Frontend | React 19 + Vite 8 |
| Testing | Vitest 3 + Supertest |
| External Provider | TomTom Traffic API (optional) |
| Package Manager | npm workspaces (monorepo) |

---

## Setup and Installation

### Prerequisites

- Node.js 22+
- npm 10+

### 1. One-command setup

```bash
npm run setup
```

This installs dependencies, generates the Prisma client, applies all pending migrations against `prisma/dev.db`, and seeds demo data + default FinePolicy rows. Safe to re-run.

### 2. Optional — configure external API keys

```bash
cp .env.example apps/api/.env       # template; system runs in fallback mode without keys
```

Every key is **optional** — the system boots and runs in fallback mode without them. See [`EXTERNAL_APIS.md`](./EXTERNAL_APIS.md) for free-tier signup steps for:

- **TomTom Traffic API** — 2,500 calls/day free, no card. `TOMTOM_API_KEY=...`
- **Open-Meteo (weather)** — no key required at all.

> **Note:** API keys live in `.env` only — read on the server, never exposed to the browser.

### 3. Start dev servers

```bash
npm run dev
```

API on http://localhost:4000, web on http://localhost:5173.

### What `npm run setup` puts in the database
- 1 operation zone (Islamabad Traffic Zone)
- 3 intersections with GPS coordinates
- 3 traffic cameras linked to intersections
- 6 alert templates
- 2 severity policies
- 2 incident rules
- 1 queue policy (500/80/10000 → 23.81s)
- 1 external provider config (TomTom, disabled by default)
- 3 fine policies (Rs 5000 / 3000 / 1500 for excess > 30 / 15 / 0 km/h — user-editable in Config Center)

---

## Running the Application

```bash
# Start API server (port 4000)
npm run dev:api

# Start React dashboard (port 5173)
npm run dev:web
```

Open [http://localhost:5173](http://localhost:5173) to access the Command Center.

---

## Running Tests

```bash
# All API tests (94 tests across 9 files)
npm test --workspace=apps/api

# TypeScript type check
npm run typecheck --workspace=apps/api
npm run typecheck --workspace=apps/web

# Production build
npm run build --workspace=apps/web
```

**Test Results: 94 / 94 passing (9 test files)**

| File | Tests |
|---|---|
| `eventbus.spec.ts` | 7 |
| `idempotency.spec.ts` | 10 |
| `envelope.spec.ts` | 9 |
| `fifth-event-type.spec.ts` | 3 |
| `repositories.spec.ts` | 15 |
| `api-routes.spec.ts` | 12 |
| `bounded-queue.spec.ts` | 22 |
| `severity.spec.ts` | 4 |
| `v2-config.spec.ts` | 12 |
| **Total** | **94** |

---

## UI Pages

| # | Page | Purpose |
|---|---|---|
| 1 | **Command Center** | KPI strip, incidents, live alerts, external context, queue capacity, risk assessment |
| 2 | **Incident Operations** | Open/Acknowledged/Cleared incidents with acknowledge/close workflow and detail drawer |
| 3 | **Live Alert Stream** | Filterable event table with search, type filter, and metadata drawer |
| 4 | **Alert Simulator** | Publish events using configurable templates and cameras with editable payload |
| 5 | **Duplicate Alert Safety** | Interactive demo of Idempotent Receiver — 2 dispatches → 1 ticket |
| 6 | **Enforcement** | Automated citation table with plate styling, speed delta, and fines |
| 7 | **Intersection Intelligence** | Camera network cards with congestion level, incident badges, and coordinates |
| 8 | **Traffic Analytics** | Event distribution bars, enforcement by camera, report aggregates |
| 9 | **Audit Trail** | Searchable audit log table |
| 10 | **Capacity Monitor** | DB-driven queue analysis with time-to-full, eviction policy, priority ladder |
| 11 | **System Reliability** | API health, EventBus, subscribers, outbox, external provider status |
| 12 | **Configuration Center** | CRUD for cameras, intersections, templates, queue policies — tabbed interface |

---

## API Endpoint Reference

Base URL: `http://localhost:4000`

### Core Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/cameras` | List cameras |
| `POST` | `/api/cameras` | Create camera |
| `PUT` | `/api/cameras/:id` | Update camera |
| `POST` | `/api/events/publish` | Publish event envelope |
| `POST` | `/api/events/publish-duplicate-speed-violation` | Idempotency demo |
| `GET` | `/api/events` | List stored events |
| `GET` | `/api/subscribers` | Subscriber status |
| `GET` | `/api/penalties` | Enforcement tickets |
| `GET` | `/api/audit-logs` | Audit log entries |
| `GET` | `/api/reports` | Report aggregates |
| `GET` | `/api/dashboard` | Intersection snapshots |
| `GET` | `/api/queue/analysis` | Queue capacity analysis (uses active DB policy) |
| `GET` | `/api/summary` | Operational summary with all KPIs |
| `GET` | `/api/incidents` | Traffic incidents (filterable by status) |
| `POST` | `/api/incidents/:id/acknowledge` | Acknowledge incident |
| `POST` | `/api/incidents/:id/close` | Close/clear incident |
| `GET` | `/api/outbox/status` | Outbox relay status |
| `POST` | `/api/outbox/relay-once` | Trigger outbox relay |

### Configuration Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/config/zones` | Operation zones |
| `PUT` | `/api/config/zones/:id` | Update zone |
| `GET/POST` | `/api/config/intersections` | Intersections |
| `PUT` | `/api/config/intersections/:id` | Update intersection |
| `GET/POST` | `/api/config/alert-templates` | Alert templates |
| `PUT` | `/api/config/alert-templates/:id` | Update template |
| `GET/POST` | `/api/config/severity-policies` | Severity policies |
| `PUT` | `/api/config/severity-policies/:id` | Update severity policy |
| `GET/POST` | `/api/config/incident-rules` | Incident rules |
| `PUT` | `/api/config/incident-rules/:id` | Update incident rule |
| `GET/POST` | `/api/config/queue-policies` | Queue policies |
| `PUT` | `/api/config/queue-policies/:id` | Update queue policy |
| `GET/PUT` | `/api/config/external-provider` | External provider config |

### External Traffic Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/external/context-status` | Provider connection status |
| `GET` | `/api/external/traffic-flow` | Live traffic flow data |
| `GET` | `/api/external/traffic-incidents` | External incident data |
| `GET` | `/api/traffic-risk` | Combined risk assessment |

---

## Database Schema (19 Models)

**Original CEP**: TrafficCamera, EventEnvelopeRecord, ProcessedEvent, Penalty, AuditLog, DashboardSnapshot, ReportAggregate, EventOutbox

**V2 Configuration**: OperationZone, Intersection, AlertTemplate, SeverityPolicy, IncidentRule, QueuePolicy, ExternalProviderConfig

**V2 Operations**: TrafficIncident, IncidentEvent, ExternalTrafficSnapshot, OperatorActionLog

---

## Key Design Decisions

1. **Custom EventBus** — Not replaced with Kafka/RabbitMQ. The custom implementation demonstrates Observer pattern clearly.
2. **User-driven configuration** — All monitoring parameters (cameras, thresholds, templates, policies) are stored in the database and configurable at runtime.
3. **Fallback-first external integration** — TomTom API key missing or invalid? System continues in fallback mode with internal data only.
4. **Simulated camera alerts** — Camera events are simulated via the Alert Simulator. The system does not claim real government camera feeds.
5. **Queue analysis uses DB policy** — The 23.81s calculation uses the active QueuePolicy from the database, not hardcoded values.
