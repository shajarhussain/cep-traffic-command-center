import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../src/domain/bus/EventBus.js";
import { createEnvelope } from "../src/domain/events/createEnvelope.js";
import { EVENT_TYPES } from "../src/domain/events/EventTypes.js";
import type { IEventSubscriber } from "../src/domain/subscribers/IEventSubscriber.js";
import type { EventEnvelope } from "../src/domain/events/EventEnvelope.js";

/**
 * EventBus Tests — CEP Part A Task 1 (10 marks) + Task 2 (5 marks)
 *
 * Proves:
 *   - publish() delivers to subscribed listeners
 *   - publish() does NOT deliver to unrelated subscribers
 *   - unsubscribe() removes a subscriber
 *   - EventBus stores IEventSubscriber interface references
 */

/** Helper: creates a mock subscriber that records received envelopes */
function createMockSubscriber(
  name: string,
  eventTypes: string[]
): IEventSubscriber & { received: EventEnvelope[] } {
  const received: EventEnvelope[] = [];
  return {
    name,
    supportedEventTypes: eventTypes,
    received,
    async handle(envelope: EventEnvelope): Promise<void> {
      received.push(envelope);
    },
  };
}

describe("EventBus (Task 1 — Event Bus + Task 2 — Observer Pattern)", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("delivers an event to a subscribed listener", async () => {
    const dashboardSub = createMockSubscriber("DashboardService", [
      EVENT_TYPES.VehicleDetected,
    ]);
    bus.subscribe(EVENT_TYPES.VehicleDetected, dashboardSub);

    const envelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "ABC-123", intersection_name: "F-8 Markaz" },
    });

    await bus.publish(envelope);

    expect(dashboardSub.received).toHaveLength(1);
    expect(dashboardSub.received[0].event_id).toBe(envelope.event_id);
  });

  it("delivers an event to ALL subscribers for that event type", async () => {
    const dashboardSub = createMockSubscriber("DashboardService", [
      EVENT_TYPES.VehicleDetected,
    ]);
    const reportingSub = createMockSubscriber("ReportingService", [
      EVENT_TYPES.VehicleDetected,
    ]);
    bus.subscribe(EVENT_TYPES.VehicleDetected, dashboardSub);
    bus.subscribe(EVENT_TYPES.VehicleDetected, reportingSub);

    const envelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "DEF-456", intersection_name: "Blue Area" },
    });

    await bus.publish(envelope);

    expect(dashboardSub.received).toHaveLength(1);
    expect(reportingSub.received).toHaveLength(1);
  });

  it("does NOT deliver to subscribers of a different event type", async () => {
    const alertSub = createMockSubscriber("AlertService", [
      EVENT_TYPES.SpeedViolation,
    ]);
    bus.subscribe(EVENT_TYPES.SpeedViolation, alertSub);

    // Publish a VehicleDetectedEvent — AlertService only subscribes to SpeedViolation
    const envelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "GHI-789", intersection_name: "F-6" },
    });

    await bus.publish(envelope);

    expect(alertSub.received).toHaveLength(0);
  });

  it("unsubscribe() removes a subscriber so it no longer receives events", async () => {
    const loggingSub = createMockSubscriber("LoggingService", [
      EVENT_TYPES.CongestionAlert,
    ]);
    bus.subscribe(EVENT_TYPES.CongestionAlert, loggingSub);

    // First publish — should be received
    const envelope1 = createEnvelope({
      source_id: "CAM-ISB-003",
      event_type: EVENT_TYPES.CongestionAlert,
      payload: {
        intersection_name: "Faisal Mosque",
        vehicle_count: 50,
        congestion_level: "CRITICAL" as const,
      },
    });
    await bus.publish(envelope1);
    expect(loggingSub.received).toHaveLength(1);

    // Unsubscribe
    bus.unsubscribe(EVENT_TYPES.CongestionAlert, loggingSub);

    // Second publish — should NOT be received
    const envelope2 = createEnvelope({
      source_id: "CAM-ISB-003",
      event_type: EVENT_TYPES.CongestionAlert,
      payload: {
        intersection_name: "Faisal Mosque",
        vehicle_count: 60,
        congestion_level: "CRITICAL" as const,
      },
    });
    await bus.publish(envelope2);
    expect(loggingSub.received).toHaveLength(1); // still 1, not 2
  });

  it("subscriber for multiple event types receives only matching events", async () => {
    const dashboardSub = createMockSubscriber("DashboardService", [
      EVENT_TYPES.VehicleDetected,
      EVENT_TYPES.CongestionAlert,
      EVENT_TYPES.TrafficCleared,
    ]);
    // Subscribe to all three types
    bus.subscribe(EVENT_TYPES.VehicleDetected, dashboardSub);
    bus.subscribe(EVENT_TYPES.CongestionAlert, dashboardSub);
    bus.subscribe(EVENT_TYPES.TrafficCleared, dashboardSub);

    // Publish a SpeedViolation — DashboardService should NOT get it
    const speedEnvelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.SpeedViolation,
      payload: {
        vehicle_plate: "TEST-1",
        speed_kmh: 100,
        speed_limit_kmh: 60,
        intersection_name: "Test Ave",
      },
    });
    await bus.publish(speedEnvelope);
    expect(dashboardSub.received).toHaveLength(0);

    // Publish a VehicleDetected — DashboardService should get it
    const vehicleEnvelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "TEST-2", intersection_name: "Test Ave" },
    });
    await bus.publish(vehicleEnvelope);
    expect(dashboardSub.received).toHaveLength(1);
  });

  it("publishing to an event type with no subscribers does not throw", async () => {
    const envelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.TrafficCleared,
      payload: {
        intersection_name: "F-10",
        cleared_at: new Date().toISOString(),
      },
    });

    // Should complete without error even with no subscribers
    await expect(bus.publish(envelope)).resolves.toBeUndefined();
  });

  it("getSubscriberCount() returns the correct count", () => {
    const sub1 = createMockSubscriber("Sub1", [EVENT_TYPES.VehicleDetected]);
    const sub2 = createMockSubscriber("Sub2", [EVENT_TYPES.VehicleDetected]);

    bus.subscribe(EVENT_TYPES.VehicleDetected, sub1);
    bus.subscribe(EVENT_TYPES.VehicleDetected, sub2);

    expect(bus.getSubscriberCount(EVENT_TYPES.VehicleDetected)).toBe(2);
    expect(bus.getSubscriberCount(EVENT_TYPES.SpeedViolation)).toBe(0);
  });
});
