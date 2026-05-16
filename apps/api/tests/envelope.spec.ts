import { describe, it, expect } from "vitest";
import { createEnvelope } from "../src/domain/events/createEnvelope.js";
import { EVENT_TYPES } from "../src/domain/events/EventTypes.js";
import type { SpeedViolationPayload } from "../src/domain/events/EventTypes.js";

/**
 * Envelope Tests — CEP Part A Task 3 (5 marks)
 *
 * Proves that createEnvelope() produces an EventEnvelope with all 7 required fields,
 * that schema_version defaults to 1, and that event_id + timestamp are auto-generated.
 */
describe("EventEnvelope (Task 3 — Event Envelope Pattern)", () => {
  const samplePayload: SpeedViolationPayload = {
    vehicle_plate: "ABC-123",
    speed_kmh: 92,
    speed_limit_kmh: 60,
    intersection_name: "Jinnah Avenue",
  };

  it("createEnvelope() returns all 7 required CEP fields", () => {
    const envelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.SpeedViolation,
      payload: samplePayload,
    });

    // The CEP PDF requires exactly these 7 fields
    expect(envelope).toHaveProperty("event_id");
    expect(envelope).toHaveProperty("correlation_id");
    expect(envelope).toHaveProperty("schema_version");
    expect(envelope).toHaveProperty("source_id");
    expect(envelope).toHaveProperty("timestamp");
    expect(envelope).toHaveProperty("event_type");
    expect(envelope).toHaveProperty("payload");
  });

  it("schema_version defaults to 1", () => {
    const envelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "XYZ-456", intersection_name: "F-8 Markaz" },
    });

    expect(envelope.schema_version).toBe(1);
  });

  it("event_id is a UUID generated automatically", () => {
    const envelope = createEnvelope({
      source_id: "CAM-ISB-002",
      event_type: EVENT_TYPES.SpeedViolation,
      payload: samplePayload,
    });

    // UUID v4 format: 8-4-4-4-12 hex characters
    expect(envelope.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("timestamp is generated automatically as ISO 8601", () => {
    const before = new Date().toISOString();
    const envelope = createEnvelope({
      source_id: "CAM-ISB-003",
      event_type: EVENT_TYPES.CongestionAlert,
      payload: {
        intersection_name: "Blue Area",
        vehicle_count: 45,
        congestion_level: "CRITICAL" as const,
      },
    });
    const after = new Date().toISOString();

    // timestamp should be between before and after
    expect(envelope.timestamp >= before).toBe(true);
    expect(envelope.timestamp <= after).toBe(true);
  });

  it("event_type and source_id match caller-supplied values", () => {
    const envelope = createEnvelope({
      source_id: "CAM-LHR-010",
      event_type: EVENT_TYPES.TrafficCleared,
      payload: {
        intersection_name: "Liberty Chowk",
        cleared_at: new Date().toISOString(),
      },
    });

    expect(envelope.source_id).toBe("CAM-LHR-010");
    expect(envelope.event_type).toBe("TrafficClearedEvent");
  });

  it("payload is preserved exactly as provided", () => {
    const envelope = createEnvelope<SpeedViolationPayload>({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.SpeedViolation,
      payload: samplePayload,
    });

    expect(envelope.payload).toEqual(samplePayload);
  });

  it("two envelopes have different event_id values", () => {
    const e1 = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "A-1", intersection_name: "F-6" },
    });
    const e2 = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "A-2", intersection_name: "F-6" },
    });

    expect(e1.event_id).not.toBe(e2.event_id);
  });

  it("allows overriding event_id for duplicate testing", () => {
    const fixedId = "fixed-test-id-for-idempotency";
    const envelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.SpeedViolation,
      payload: samplePayload,
      event_id: fixedId,
    });

    expect(envelope.event_id).toBe(fixedId);
  });

  it("allows overriding schema_version for evolution testing", () => {
    const envelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "A-1", intersection_name: "F-6", lane_number: 2 },
      schema_version: 2,
    });

    expect(envelope.schema_version).toBe(2);
  });
});
