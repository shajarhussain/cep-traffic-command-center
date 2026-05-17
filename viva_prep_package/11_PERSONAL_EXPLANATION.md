# Personal Explanation — Just for You

> **This is NOT a submission doc.** It's a calm, plain-English walkthrough of the whole system, written so you can explain it confidently in your own words. No jargon-first. No rubric headings. Just the story.

---

## The Story (Imagine This)

A city has **100 traffic cameras** mounted at intersections. Each camera watches the road and notices things:

- A car passed by → that's a **VehicleDetected** event.
- A car went too fast → that's a **SpeedViolation** event.
- Too many cars at one intersection → that's a **CongestionAlert** event.
- The crowd cleared up → that's a **TrafficCleared** event.

Each event is just a **message** the camera shouts out. The camera doesn't know who's listening. It just shouts.

There are **four listeners** in our city's traffic control room:

- **AlertService** — listens for SpeedViolations and prints a penalty ticket.
- **LoggingService** — listens for SpeedViolations and CongestionAlerts and writes everything to an audit log book.
- **DashboardService** — listens for VehicleDetected, CongestionAlert, and TrafficCleared events and updates a giant live map on the control-room wall.
- **ReportingService** — listens for VehicleDetected and SpeedViolation events and keeps running totals for the monthly report.

Between the cameras (shouters) and the services (listeners) sits a **middleman** called the **EventBus**. It's basically a phone exchange: cameras call the bus, the bus calls every listener that asked for that kind of message.

That's the whole system. Everything else is details that solve problems we already know will happen.

---

## The 4 Real Problems We Had to Solve

The CEP PDF doesn't just ask you to build a postal system. It asks you to handle 4 real-world things that go wrong:

| Problem | What goes wrong | Our fix |
|---|---|---|
| **Decoupling** | If cameras and listeners are tightly coupled, every new feature breaks something. | EventBus + IEventSubscriber interface. Cameras don't import any listener; the bus stores interface references only. |
| **Extensibility** | Adding a 5th event type or 5th listener shouldn't force us to rewrite the cameras. | Bus is `Map<string, Set<IEventSubscriber>>` — it doesn't care what types or services exist. Add a new one, the bus is untouched. |
| **Duplicates** | Network glitches can deliver the same event twice → two penalties for one speeding car. | Idempotent Receiver: each listener checks `event_id` against a `ProcessedEvent` table before acting. DB unique constraint as a safety net. |
| **Overload** | Football match → 500 events/sec arrive but DashboardService only handles 80/sec → memory explodes. | BoundedEventQueue with max size 10,000 and priority-aware eviction (drop routine events first, keep CRITICAL congestion alerts). |

And one big architectural problem on top:

| Problem | What goes wrong | Our fix |
|---|---|---|
| **Dual Write** | AlertService writes a penalty, then LoggingService crashes before writing the audit log → penalty exists without proof → legally inadmissible. | Outbox Pattern: write the event to a local DB table inside the SAME transaction as the business write. A background relay republishes if anything fails. |

---

## How a Single Event Travels (5 Steps)

Picture a car going 75 km/h in a 50 zone. Here's what happens:

```
1. Camera sees the violation
        │
        ▼
2. Camera wraps it in an EventEnvelope
   (event_id, correlation_id, schema_version, source_id,
    timestamp, event_type="SpeedViolationEvent", payload)
        │
        ▼
3. Camera calls bus.publish(envelope)
        │
        ▼
4. EventBus looks up Set of subscribers for "SpeedViolationEvent"
   → finds [AlertService, LoggingService, ReportingService]
   → calls handle(envelope) on each one
        │
        ▼
5. Each subscriber checks: "Have I seen this event_id before?"
   YES → silently ignore
   NO  → do its job (issue penalty / write log / increment counter)
         then mark event_id as processed
```

That's it. Every other event flows the same way.

---

## The 4 Listeners Explained Like People

Think of them as four people in the control room. Each one is wearing headphones tuned to specific channels.

| Person | Their headphones tuned to | What they do when they hear it |
|---|---|---|
| **AlertService** | SpeedViolation | Prints a penalty ticket, mails it to the car owner. |
| **LoggingService** | SpeedViolation, CongestionAlert | Writes the event details to a permanent audit log book. |
| **DashboardService** | VehicleDetected, CongestionAlert, TrafficCleared | Updates the giant live map on the wall. |
| **ReportingService** | VehicleDetected, SpeedViolation | Keeps running counts for the monthly statistics report. |

None of them know about each other. None of them know about the cameras. They only know the bus, and they only know which channels they're tuned to.

If tomorrow we hire a 5th person — say **EmergencyService** for ambulances — they just tune their headphones to `EmergencyVehicleEvent` and start working. **Nobody else has to change anything.** That's the "5th-event rule" the CEP rubric asks us to prove.

---

## The 3 Big "What-If" Problems (CLO 4 Scenarios)

These are the architectural arguments — no code, just thinking.

### What if the event format needs to change?
*(Scenario 1 — 10 marks)*

Six months in, the city wants `VehicleDetectedEvent` to include `lane_number`. But 200 listener instances are running on the old format. **Two choices:** add it as an optional field (everybody keeps working but data might silently get lost) or release a new `schema_version = 2` and force upgrades (safer but harder to deploy). **We chose schema versioning** because in a legal/enforcement system, silent data loss is worse than a coordinated deployment.

### What if too many events arrive at once?
*(Scenario 2 — 10 marks)*

500 events/sec in, 80 events/sec out → queue grows by 420/sec → fills 10,000 slots in **23.81 seconds**. So we capped the queue at 10,000 and added a rule for what to drop when it's full. **We drop the least important event, not the oldest**, because losing a CRITICAL congestion alert to keep a routine vehicle detection would be backwards. Priority order: CongestionAlert > SpeedViolation > TrafficCleared > VehicleDetected.

### What if a service crashes mid-operation?
*(Scenario 3 — 10 marks)*

AlertService writes a penalty. LoggingService crashes before writing the audit log. Now we have a fine with no paper trail → legally inadmissible. **The Outbox Pattern fixes this:** write the event to a local DB table inside the SAME transaction as the business write. Either both succeed or both fail. A background process then publishes the outbox row to the bus. The cost is extra complexity. **For enforcement, it's worth paying** because a fine without an audit log is a legal liability.

---

## The Mental Model for the Viva

If the examiner asks you ANY question, fall back on this single sentence:

> **"Cameras don't know who listens. Listeners don't know who else listens. The EventBus is the only middleman, and it only knows the interface."**

Almost every viva question has an answer that starts from there:

| If they ask… | You answer… |
|---|---|
| "Why an EventBus?" | "So cameras and services can change independently." |
| "Why an interface?" | "So the bus is closed to modification but open to extension — Open/Closed Principle." |
| "What if I add a new event type?" | "Zero changes to the bus. Just define the payload and register a subscriber." |
| "What if two services subscribe to the same event?" | "Both get called. Idempotency is per-subscriber, so they don't interfere." |
| "What if the same event arrives twice?" | "Each subscriber checks its ProcessedEvent table by event_id and skips duplicates." |
| "How do you handle overload?" | "BoundedEventQueue. Max 10,000. Priority-aware eviction." |
| "How do you handle crashes?" | "Outbox Pattern. Atomic write to a local table, background relay publishes." |

---

## Confidence Reminders

- **The code is done.** 78 backend tests pass. You're not defending an idea — you're defending working software.
- **All 7 envelope fields are exactly what the PDF asked for.** No more, no less. If they count, you'll be right.
- **The 23.81 seconds calculation is correct.** It's `10,000 ÷ (500 − 80) = 10,000 ÷ 420 ≈ 23.81`. You can do it on paper if asked.
- **The duplicate-event test passes.** Same event_id → 1 penalty, not 2. There's a live red button in the dashboard that proves it on stage.
- **The UML diagram is ready.** It's in [docs/uml/01_class_diagram_observer.md](docs/uml/01_class_diagram_observer.md) — interface at top, 4 subscribers extending the base class, bus holds Set of interface.
- **The ADR is written.** Over 200 words for Scenario 1, over 150 words for Scenario 3 (rubric minimums).

---

## One-Page Summary Card (Print or Screenshot This)

```
┌────────────────────────────────────────────────────────────────┐
│  EVENT-DRIVEN TRAFFIC ALERT SYSTEM — VIVA CARD                  │
├────────────────────────────────────────────────────────────────┤
│  4 EVENT TYPES: VehicleDetected, SpeedViolation,                │
│                 CongestionAlert, TrafficCleared                 │
│  4 SUBSCRIBERS: Alert, Logging, Dashboard, Reporting            │
│  1 BUS: EventBus stores Map<string, Set<IEventSubscriber>>      │
│                                                                  │
│  ENVELOPE (7 fields): event_id, correlation_id, schema_version, │
│                       source_id, timestamp, event_type, payload │
│                                                                  │
│  IDEMPOTENCY: each subscriber checks event_id in                │
│               ProcessedEvent table BEFORE processing.           │
│               DB constraint: @@unique([eventId, subscriberName])│
│                                                                  │
│  BOUNDED QUEUE: max 10,000; priority-aware eviction.            │
│  CALC: 10,000 ÷ (500 − 80) = 23.81 seconds.                     │
│  PRIORITY: Congestion=4, Speed=3, Cleared=2, Vehicle=1          │
│                                                                  │
│  OUTBOX: write event to EventOutbox in same txn → relay         │
│          publishes to bus → on failure retry (idempotent).      │
│                                                                  │
│  SCHEMA EVOLUTION: schema_version field in envelope.            │
│  Chose Option B (versioning) for enforcement safety.            │
│                                                                  │
│  PROOF: 78 backend tests passing. Live demo button in UI.       │
└────────────────────────────────────────────────────────────────┘
```

You've got this. Read the [rubric explanation doc](09_RUBRIC_EXPLANATION.md) once more before bed and you'll walk into the viva with everything you need.
