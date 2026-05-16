# Backend Enhancement Roadmap

This document outlines the strategic enhancements planned for the Event-Driven Traffic Alert System to scale from its current prototype state to a full-fledged enterprise command center.

## Core Infrastructure

### 1. Kafka/RabbitMQ Broker
- **Status:** Not implemented yet
- **Why it was not implemented:** The current prototype uses an in-memory `Map<string, Set<IEventSubscriber>>` EventBus to fulfill academic requirements without external infrastructure dependencies.
- **Backend/API/DB work needed:** Replace `EventBus` class with a provider integrating `kafkajs` or `amqplib`. Update `bootstrapSubscribers()` to connect to external queues.
- **UI page affected:** System Health
- **Priority:** High
- **Value:** Essential for distributed deployment, high availability, and persistent message queuing.

### 2. PostgreSQL Migration
- **Status:** Not implemented yet
- **Why it was not implemented:** SQLite was selected for zero-configuration local deployment and ease of testing.
- **Backend/API/DB work needed:** Update `prisma/schema.prisma` provider to `postgresql`. Add Prisma Accelerate for connection pooling.
- **UI page affected:** System Health, Traffic Reports
- **Priority:** High
- **Value:** Enables concurrent writes, horizontal scaling, and advanced analytics queries.

### 3. Outbox Relay Worker
- **Status:** Not implemented yet
- **Why it was not implemented:** The `EventOutbox` table and repository are implemented to demonstrate the pattern, but the background Cron/polling worker thread was out of scope for the prototype.
- **Backend/API/DB work needed:** Create a Node.js worker service that polls `EventOutbox` for `PENDING` status, publishes to broker, and marks `PUBLISHED`.
- **UI page affected:** System Health
- **Priority:** High
- **Value:** Fully solves the Dual Write problem and guarantees at-least-once delivery to the message broker.

### 4. Containerized Deployment
- **Status:** Not implemented yet
- **Why it was not implemented:** The project is evaluated locally via `npm run`.
- **Backend/API/DB work needed:** Create `Dockerfile` and Kubernetes manifests/helm charts.
- **UI page affected:** System Health
- **Priority:** Medium
- **Value:** Standardized production deployment and orchestration.

## Operations UI Enhancements

### 5. Real Live Map
- **Status:** Not implemented yet
- **Why it was not implemented:** Requires external mapping APIs (Mapbox/Google Maps) and WebSocket integration for live pin updates.
- **Backend/API/DB work needed:** Add WebSocket Server (`socket.io`), integrate coordinate data into `Camera` model, and stream real-time event coordinates.
- **UI page affected:** Command Center
- **Priority:** Medium
- **Value:** Provides immediate geographic context to operators.

### 6. Real Camera Heartbeat/Status
- **Status:** Not implemented yet
- **Why it was not implemented:** Cameras currently exist as static seeded database records without live health polling.
- **Backend/API/DB work needed:** Implement a `CameraHealthService` that pings camera IPs. Update API `GET /api/cameras` to reflect live status.
- **UI page affected:** Command Center
- **Priority:** Medium
- **Value:** Identifies offline or malfunctioning sensors automatically.

### 7. Real Predictive Congestion Scoring
- **Status:** Not implemented yet
- **Why it was not implemented:** Requires ML models and historical time-series data processing.
- **Backend/API/DB work needed:** Integrate Python-based ML microservice to consume `DashboardSnapshot` data and output predictive scores.
- **UI page affected:** Intersection Status
- **Priority:** Low
- **Value:** Proactive traffic routing and signal management before gridlocks occur.

### 8. Operator Incident Workflow
- **Status:** Not implemented yet
- **Why it was not implemented:** The system currently only generates automatic penalties and logs, lacking a manual "review/dismiss" flow.
- **Backend/API/DB work needed:** Add `Incident` DB model, `POST /api/incidents/:id/resolve` endpoint, and operator assignment logic.
- **UI page affected:** Live Alert Stream / Enforcement
- **Priority:** Medium
- **Value:** Allows human-in-the-loop validation for edge cases or disputed citations.

### 9. Operator Action Logs
- **Status:** Not implemented yet
- **Why it was not implemented:** System currently logs automated events, but lacks human operator audit trails.
- **Backend/API/DB work needed:** Add JWT Authentication context to requests, capture `user_id` in a new `OperatorActionLog` table.
- **UI page affected:** Audit Trail
- **Priority:** High
- **Value:** Critical for compliance and tracking which operator approved/dismissed a penalty.

### 10. Richer Analytics Endpoint
- **Status:** Not implemented yet
- **Why it was not implemented:** Current `/api/reports` provides basic hourly aggregates sufficient for the dashboard.
- **Backend/API/DB work needed:** Build parameterized reporting endpoints (e.g., filter by date range, specific camera, heatmaps).
- **UI page affected:** Traffic Reports
- **Priority:** Medium
- **Value:** Deep business intelligence and operational reporting.

### 11. Notification Service
- **Status:** Not implemented yet
- **Why it was not implemented:** Requires SMS/Email gateway integration (Twilio/SendGrid).
- **Backend/API/DB work needed:** Add a 5th subscriber (`NotificationService`) that listens to `SpeedViolationEvent` and pushes SMS to registered vehicle owners.
- **UI page affected:** Enforcement
- **Priority:** Low
- **Value:** Closes the loop with citizens by providing immediate violation feedback.
