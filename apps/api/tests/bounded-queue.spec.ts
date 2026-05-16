import { describe, it, expect } from "vitest";
import {
  BoundedEventQueue,
  getEventPriority,
  calculateSecondsUntilFull,
  EVENT_PRIORITY,
} from "../src/domain/bus/BoundedEventQueue.js";
import { createEnvelope } from "../src/domain/events/createEnvelope.js";
import { EVENT_TYPES } from "../src/domain/events/EventTypes.js";
import type { SpeedViolationPayload, CongestionAlertPayload, VehicleDetectedPayload } from "../src/domain/events/EventTypes.js";

/**
 * BoundedEventQueue Tests — CEP Part A Task 5 / CLO 4 Scenario 2
 *
 * These tests prove:
 *   1. Queue accepts events up to maxSize.
 *   2. Queue never exceeds maxSize.
 *   3. Low-priority events evicted before high-priority events.
 *   4. CRITICAL CongestionAlertEvent preserved over routine VehicleDetectedEvent.
 *   5. Same-priority eviction drops the oldest event.
 *   6. Calculation helper returns ≈23.81 seconds for the Scenario 2 rates.
 *   7. Eviction policy string is correct.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeVehicle(plate = "ISB-001") {
  return createEnvelope<VehicleDetectedPayload>({
    source_id: "CAM-ISB-001",
    event_type: EVENT_TYPES.VehicleDetected,
    payload: { vehicle_plate: plate, intersection_name: "F-7 Markaz" },
  });
}

function makeSpeed(plate = "ISB-SPD-001") {
  return createEnvelope<SpeedViolationPayload>({
    source_id: "CAM-ISB-001",
    event_type: EVENT_TYPES.SpeedViolation,
    payload: { vehicle_plate: plate, speed_kmh: 90, speed_limit_kmh: 60, intersection_name: "F-7" },
  });
}

function makeCongestion() {
  return createEnvelope<CongestionAlertPayload>({
    source_id: "CAM-ISB-002",
    event_type: EVENT_TYPES.CongestionAlert,
    payload: { intersection_name: "Blue Area", vehicle_count: 45, congestion_level: "HIGH" },
  });
}

// ─── Priority Map Tests ──────────────────────────────────────────────────────

describe("EVENT_PRIORITY map", () => {
  it("CongestionAlertEvent has highest priority (4)", () => {
    expect(EVENT_PRIORITY.CongestionAlertEvent).toBe(4);
  });

  it("SpeedViolationEvent has priority 3", () => {
    expect(EVENT_PRIORITY.SpeedViolationEvent).toBe(3);
  });

  it("TrafficClearedEvent has priority 2", () => {
    expect(EVENT_PRIORITY.TrafficClearedEvent).toBe(2);
  });

  it("VehicleDetectedEvent has lowest priority (1)", () => {
    expect(EVENT_PRIORITY.VehicleDetectedEvent).toBe(1);
  });

  it("getEventPriority returns 0 for unknown event types", () => {
    expect(getEventPriority("UnknownEvent")).toBe(0);
  });
});

// ─── Capacity Tests ──────────────────────────────────────────────────────────

describe("calculateSecondsUntilFull", () => {
  it("returns ~23.81 seconds for 500 in, 80 out, 10 000 queue limit (CLO4 Scenario 2)", () => {
    // 10000 / (500 - 80) = 10000 / 420 = 23.8095…
    const result = calculateSecondsUntilFull(500, 80, 10_000);
    expect(result).toBeCloseTo(23.81, 1);
  });

  it("returns Infinity when processing rate >= incoming rate (no backlog growth)", () => {
    expect(calculateSecondsUntilFull(80, 80, 10_000)).toBe(Infinity);
    expect(calculateSecondsUntilFull(50, 200, 10_000)).toBe(Infinity);
  });

  it("scales linearly with queue limit", () => {
    // Half the queue limit → half the time
    const full  = calculateSecondsUntilFull(500, 80, 10_000);
    const half  = calculateSecondsUntilFull(500, 80, 5_000);
    expect(half).toBeCloseTo(full / 2, 5);
  });
});

// ─── BoundedEventQueue — Constructor ────────────────────────────────────────

describe("BoundedEventQueue constructor", () => {
  it("rejects non-positive maxSize", () => {
    expect(() => new BoundedEventQueue(0)).toThrow();
    expect(() => new BoundedEventQueue(-1)).toThrow();
  });

  it("starts with size 0 and is not full", () => {
    const q = new BoundedEventQueue(5);
    expect(q.size).toBe(0);
    expect(q.isFull).toBe(false);
  });
});

// ─── Test 1 & 2: Accepts up to maxSize, never exceeds ───────────────────────

describe("BoundedEventQueue — capacity enforcement (Tests 1 & 2)", () => {
  it("accepts events up to maxSize", () => {
    const q = new BoundedEventQueue(3);
    expect(q.enqueue(makeVehicle("A"))).toBe(true);
    expect(q.enqueue(makeVehicle("B"))).toBe(true);
    expect(q.enqueue(makeVehicle("C"))).toBe(true);
    expect(q.size).toBe(3);
    expect(q.isFull).toBe(true);
  });

  it("never exceeds maxSize after eviction", () => {
    const q = new BoundedEventQueue(3);
    // Fill with vehicle detections (low priority)
    q.enqueue(makeVehicle("A"));
    q.enqueue(makeVehicle("B"));
    q.enqueue(makeVehicle("C"));

    // Add a higher-priority speed violation — must evict one vehicle, keep size=3
    q.enqueue(makeSpeed());
    expect(q.size).toBe(3);

    // Add another — still must not exceed maxSize
    q.enqueue(makeSpeed("ISB-SPD-002"));
    expect(q.size).toBe(3);
  });
});

// ─── Test 3: Low-priority evicted before high-priority ───────────────────────

describe("BoundedEventQueue — priority-aware eviction (Test 3)", () => {
  it("evicts VehicleDetectedEvent (LOW) when a SpeedViolation (HIGH) arrives at capacity", () => {
    const q = new BoundedEventQueue(2);
    const v1 = makeVehicle("LOW-1");
    const v2 = makeVehicle("LOW-2");
    const spd = makeSpeed("SPD-1");

    q.enqueue(v1);
    q.enqueue(v2);
    // Queue full with two LOW events; now enqueue HIGH
    const accepted = q.enqueue(spd);

    expect(accepted).toBe(true);
    expect(q.size).toBe(2);

    // Drain and verify the speed violation is present
    const drained = q.drain();
    const types = drained.map((e) => e.event_type);
    expect(types).toContain(EVENT_TYPES.SpeedViolation);
    // At least one vehicle may have been kept (the newer one could survive)
    // but the older LOW event must have been removed to make room
    expect(types.length).toBe(2);
  });

  it("rejects an incoming LOW event when queue is full of HIGH events", () => {
    const q = new BoundedEventQueue(2);
    // Fill with HIGH priority
    q.enqueue(makeSpeed("SPD-1"));
    q.enqueue(makeSpeed("SPD-2"));

    // Try to add a LOW event — should be rejected (not evict any HIGH)
    const accepted = q.enqueue(makeVehicle("LOW-1"));
    expect(accepted).toBe(false);
    expect(q.size).toBe(2);

    // Ensure both speed violations are still in the queue
    const drained = q.drain();
    expect(drained.every((e) => e.event_type === EVENT_TYPES.SpeedViolation)).toBe(true);
  });
});

// ─── Test 4: CRITICAL preserved over routine ─────────────────────────────────

describe("BoundedEventQueue — CRITICAL preservation (Test 4)", () => {
  it("preserves CongestionAlertEvent (CRITICAL) and drops VehicleDetectedEvent (LOW)", () => {
    const q = new BoundedEventQueue(3);
    const v1 = makeVehicle("V1");
    const v2 = makeVehicle("V2");
    const congestion = makeCongestion();

    // Fill queue with two LOW events plus a CRITICAL
    q.enqueue(v1);
    q.enqueue(v2);
    q.enqueue(congestion);
    expect(q.size).toBe(3);

    // Add another CRITICAL — must evict a LOW, not the existing congestion
    const congestion2 = makeCongestion();
    q.enqueue(congestion2);

    expect(q.size).toBe(3);

    const drained = q.drain();
    const types = drained.map((e) => e.event_type);

    // Both congestion alerts must be present
    const congestionCount = types.filter((t) => t === EVENT_TYPES.CongestionAlert).length;
    expect(congestionCount).toBe(2);

    // At most one vehicle detection can remain
    const vehicleCount = types.filter((t) => t === EVENT_TYPES.VehicleDetected).length;
    expect(vehicleCount).toBeLessThanOrEqual(1);
  });

  it("CongestionAlertEvent is never evicted when VehicleDetectedEvent exists as eviction candidate", () => {
    const q = new BoundedEventQueue(2);
    q.enqueue(makeCongestion());  // priority 4
    q.enqueue(makeVehicle("V1")); // priority 1

    // Full: add one more HIGH event (SpeedViolation prio 3)
    // Must evict VehicleDetected (prio 1), not CongestionAlert (prio 4)
    q.enqueue(makeSpeed("SPD"));
    expect(q.size).toBe(2);

    const drained = q.drain();
    const types = drained.map((e) => e.event_type);
    expect(types).toContain(EVENT_TYPES.CongestionAlert);
    expect(types).not.toContain(EVENT_TYPES.VehicleDetected);
  });
});

// ─── Test 5: Same-priority drops oldest ──────────────────────────────────────

describe("BoundedEventQueue — same-priority age-based eviction (Test 5)", () => {
  it("when all events have equal priority, drops the oldest one", () => {
    const q = new BoundedEventQueue(2);
    const old = makeVehicle("OLDEST");
    const mid = makeVehicle("MIDDLE");

    q.enqueue(old); // sequence 0 — oldest
    q.enqueue(mid); // sequence 1

    // Queue full — add a third vehicle (same priority)
    const newest = makeVehicle("NEWEST");
    q.enqueue(newest); // should evict "old" (oldest, same priority)

    const drained = q.drain();
    const plates = drained.map(
      (e) => (e.payload as { vehicle_plate?: string }).vehicle_plate ?? ""
    );

    // OLDEST should be gone; MIDDLE and NEWEST should survive
    expect(plates).not.toContain("OLDEST");
    expect(plates).toContain("MIDDLE");
    expect(plates).toContain("NEWEST");
  });
});

// ─── Test 6: analyzeCapacity ─────────────────────────────────────────────────

describe("BoundedEventQueue.analyzeCapacity (Test 6 — CLO4 Scenario 2)", () => {
  it("returns the correct Scenario 2 analysis with ~23.81 seconds until full", () => {
    const q = new BoundedEventQueue(10_000);
    const analysis = q.analyzeCapacity(500, 80);

    expect(analysis.incomingRate).toBe(500);
    expect(analysis.processingRate).toBe(80);
    expect(analysis.backlogGrowthPerSecond).toBe(420);
    expect(analysis.queueLimit).toBe(10_000);
    expect(analysis.secondsUntilFull).toBeCloseTo(23.81, 1);
    expect(analysis.evictionPolicy).toContain("least important");
  });

  it("eviction policy string mentions priority and age", () => {
    const q = new BoundedEventQueue(100);
    const { evictionPolicy } = q.analyzeCapacity();
    expect(evictionPolicy.toLowerCase()).toMatch(/priority|important/);
    expect(evictionPolicy.toLowerCase()).toMatch(/oldest|age/);
  });
});

// ─── dequeue / peek / drain / clear ─────────────────────────────────────────

describe("BoundedEventQueue — dequeue and peek", () => {
  it("dequeue returns events in FIFO order by enqueue sequence", () => {
    const q = new BoundedEventQueue(5);
    const a = makeVehicle("A");
    const b = makeSpeed("B");
    const c = makeCongestion();
    q.enqueue(a);
    q.enqueue(b);
    q.enqueue(c);

    // Dequeue should give the oldest-enqueued item first
    expect(q.dequeue()?.event_id).toBe(a.event_id);
    expect(q.dequeue()?.event_id).toBe(b.event_id);
    expect(q.dequeue()?.event_id).toBe(c.event_id);
    expect(q.dequeue()).toBeUndefined();
  });

  it("peek returns next item without removing it", () => {
    const q = new BoundedEventQueue(5);
    const v = makeVehicle("PEEK");
    q.enqueue(v);
    expect(q.peek()?.event_id).toBe(v.event_id);
    expect(q.size).toBe(1); // still there
  });

  it("clear empties the queue", () => {
    const q = new BoundedEventQueue(5);
    q.enqueue(makeVehicle("A"));
    q.enqueue(makeVehicle("B"));
    q.clear();
    expect(q.size).toBe(0);
    expect(q.dequeue()).toBeUndefined();
  });
});
