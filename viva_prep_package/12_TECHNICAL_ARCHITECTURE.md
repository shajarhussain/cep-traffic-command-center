# Technical Architecture & System Overview

> **Purpose:** This document details the technical prospects, architecture, and technology stack of the V3 Traffic Operations Command Center. It serves as a reference for the technical implementation of the frontend, backend, and database layers.

---

## 1. System Architecture Pattern

The system follows an **Event-Driven Architecture (EDA)** layered over a traditional REST API. 
Instead of direct synchronous calls between components, business workflows are decoupled:
1. **Edge Devices (Cameras)** push data to the REST API.
2. The **API Layer** acts as a Publisher, validating and wrapping the data into an `EventEnvelope`.
3. The **Event Bus** routes the envelope to interested **Subscribers** (Observer Pattern).
4. **Subscribers** independently process the events (e.g., issuing penalties, updating live maps, generating audits).

---

## 2. Technology Stack

The project is structured as a **Monorepo** using npm workspaces, allowing seamless code sharing between the frontend and backend.

### 2.1 Backend (API & Event Engine)
- **Runtime:** Node.js
- **Framework:** Express.js (REST API layer)
- **Language:** TypeScript
- **Event Engine:** Custom in-memory `EventBus`
- **Background Workers:** Native `setInterval` and asynchronous Promises.

### 2.2 Frontend (Web Dashboard)
- **Framework:** React 18
- **Build Tool:** Vite (for fast HMR and optimized production builds)
- **Language:** TypeScript (`.tsx`)
- **Routing:** Custom lightweight hash-based routing (`window.location.hash`), avoiding heavy dependencies like React Router for this specific dashboard layout.
- **Styling:** Vanilla CSS (`index.css`) utilizing CSS Variables. The UI implements a premium **"Glassmorphism"** design system (translucent surfaces, dynamic blurs, animated radial gradients, and crisp micro-interactions).
- **API Client:** Centralized fetch-based API wrapper (`api/client.ts`).

### 2.3 Persistence (Database)
- **ORM:** Prisma (Type-safe database client)
- **Database Engine:** SQLite (Currently optimized for CEP evaluation and local deployment). 
- **Migration Path:** The Prisma schema is engine-agnostic, allowing a seamless zero-code transition to **PostgreSQL** for high-concurrency production deployments.

---

## 3. Backend Technical Details

### 3.1 REST API Layer
The Express server exposes endpoints for both ingestion (cameras) and extraction (dashboard):
- `POST /api/events/publish`: The primary ingress for traffic events.
- `GET /api/dashboard`, `GET /api/penalties`, `GET /api/audit-logs`: Egress endpoints for the React dashboard.
- `GET /api/queue/analysis`: Exposes live metrics from the Bounded Event Queue.

### 3.2 The Event Bus (Observer Pattern)
The core of the system is the `EventBus`. It maintains a `Map<string, Set<IEventSubscriber>>`. When a REST endpoint triggers a publish, the bus iterates through the Set of subscribers registered for that specific event type and invokes their `handle()` method.

### 3.3 Subscribers (Business Logic)
Subscribers are isolated classes that react to events. They have no knowledge of each other:
1. **AlertService:** Reacts to `SpeedViolationEvent` to issue penalties.
2. **LoggingService:** Reacts to violations and congestion to maintain a tamper-proof audit trail.
3. **DashboardService:** Maintains the live intersection state.
4. **ReportingService:** Aggregates metrics for monthly reports.

### 3.4 Resilience & Safety Mechanisms
To elevate the system from a simple prototype to an enterprise-grade platform, several advanced architectural patterns are embedded in the backend:

- **Idempotent Receivers:** Every subscriber inherits from `BaseIdempotentSubscriber`. It checks the `ProcessedEvent` database table before processing. If an event (identified by a UUID) has already been processed by that specific subscriber, it is silently dropped. This guarantees that network retries never result in duplicate traffic fines.
- **Outbox Pattern (Dual-Write Prevention):** Instead of saving to the database and *then* publishing to the bus (which risks a crash in between), the system writes business data and an `EventOutbox` row in a single atomic Prisma transaction. A background `OutboxRelay` worker polls the outbox and guarantees the event is published to the bus.
- **Bounded Event Queue (Flood Protection):** Sits between the EventBus and the `DashboardService` (the slowest consumer). It has a strict memory limit (e.g., 10,000 events). If the system is flooded, the queue uses **Priority-Aware Eviction**, safely discarding low-priority events (routine vehicle detections) while preserving critical events (congestion alerts and speed violations).

---

## 4. Frontend Technical Details

### 4.1 Component Structure
The React application is heavily componentized. 
- **App Shell (`App.tsx`):** Manages the global layout, top navigation, and routing state.
- **Pages (`src/pages/`):** Represents entire views (e.g., `CommandCenterPage.tsx`, `SimulatorPage.tsx`).
- **Shared UI (`src/components/`):** Reusable elements like `Icon.tsx`, `ErrorBoundary.tsx`, and the `Toast.tsx` notification system.

### 4.2 State Management
State is managed using native React Hooks:
- Local state (`useState`) for form inputs and toggles.
- Lifecycle and data fetching (`useEffect`) for polling live data from the Express backend.
- Derived state (`useMemo`) for sorting and filtering data tables on the client side.

### 4.3 Data Fetching
Polling is utilized to keep the dashboard live. For example, the `CommandCenterPage` uses `setInterval` to hit `/api/dashboard` every 2 seconds, ensuring the UI reflects the real-time state of the backend database without requiring complex WebSockets.

---

## 5. Deployment Topology

1. **Development Environment:** 
   - Uses `concurrently` to run the Vite dev server (port 5173) and the Node API (port 4000) simultaneously via `npm run dev`.
2. **Production Capability:** 
   - The React app can be compiled to static HTML/JS/CSS (`npm run build:web`) and served directly by the Express server or a CDN.
   - The API is compiled from TypeScript to standard JavaScript and run via `node dist/main.js`.
