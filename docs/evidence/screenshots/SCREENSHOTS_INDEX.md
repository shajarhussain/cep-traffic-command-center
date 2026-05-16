# Screenshots Index

> Operations Dashboard — Final Evidence
> Captured: 2026-05-14 from http://localhost:5173

All screenshots were captured via browser automation during the final verification.
The browser recording video is saved alongside these files.

---

## Screenshot Manifest

| # | Page | File | Data Visible | Status |
|---|---|---|---|---|
| 1 | Command Center | `01-command-center.png` | System stats, 3 cameras, recent alert timeline | ✅ |
| 2 | Alert Simulator | `02-alert-simulator.png` | Event type dropdown, camera selector, JSON payload form | ✅ |
| 3 | Duplicate Alert Safety | `03-duplicate-alert-safety.png` | **"2" publish attempts, "1" penalty** — key idempotency proof | ✅ |
| 4 | Live Alert Stream | `04-live-alert-stream-metadata.png` | 7 labeled metadata envelope fields in sidebar | ✅ |
| 5 | Processing Services | `05-service-processing-monitor.png` | 4 subscriber cards with mesh flow | ✅ |
| 6 | Enforcement | `06-enforcement.png` | Enforcement table with speed/fine/plate/event_id | ✅ |
| 7 | Audit Trail | `07-audit-trail.png` | LoggingService entries with event type badges | ✅ |
| 8 | Traffic Reports | `08-traffic-reports.png` | Summary stat cards + aggregates table | ✅ |
| 9 | Intersection Status | `09-intersection-status.png` | Intersection snapshot cards | ✅ |
| 10 | System Health | `10-system-health.png` | Operational flow, service status, Event Bus, storage/API health summary | ✅ |
| 11 | Capacity Monitor | `11-capacity-monitor.png` | Queue capacity cards showing 23.81s saturation calculation and eviction policy | ✅ |

---

## Key Evidence Screenshots

### Screenshot 3 — Duplicate Alert Safety (Most Important)

This is the central proof for idempotent operations:

```
Ingress Dispatches:      2
Enforcement Tickets:       1
```

The UI shows large "2" and "1" side-by-side to make the proof immediately visible.

### Screenshot 4 — Live Alert Stream with 7 Fields

Shows all 7 required `EventEnvelope` fields individually labeled:
- event_id
- correlation_id
- schema_version
- source_id
- timestamp
- event_type
- payload

### Screenshot 11 — Capacity Monitor

The Capacity Monitor UI shows queue capacity cards including incoming rate, processing rate, backlog growth, queue limit, 23.81s saturation time, and the eviction policy. The raw backend JSON response is stored separately in `docs/evidence/API_RESPONSES.md`.

---

## Browser Recording

The full interaction recording is saved as a WebP video by the browser automation system under the project brain directory.
