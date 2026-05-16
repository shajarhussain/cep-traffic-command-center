// ─── Event Type Constants ───────────────────────────────────────
// The CEP requires exactly 4 event types.
// A 5th type (EmergencyVehicleEvent) is used only in tests to prove extensibility.

export const EVENT_TYPES = {
  VehicleDetected: "VehicleDetectedEvent",
  SpeedViolation: "SpeedViolationEvent",
  CongestionAlert: "CongestionAlertEvent",
  TrafficCleared: "TrafficClearedEvent",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// ─── Payload Interfaces ────────────────────────────────────────
// Each event type has a strongly-typed payload.

export interface VehicleDetectedPayload {
  vehicle_plate: string;
  intersection_name: string;
  lane_number?: number; // optional — supports schema evolution (CLO4 Scenario 1)
}

export interface SpeedViolationPayload {
  vehicle_plate: string;
  speed_kmh: number;
  speed_limit_kmh: number;
  intersection_name: string;
}

export interface CongestionAlertPayload {
  intersection_name: string;
  vehicle_count: number;
  congestion_level: "HIGH" | "CRITICAL";
}

export interface TrafficClearedPayload {
  intersection_name: string;
  cleared_at: string;
}

// ─── Event Envelope ────────────────────────────────────────────
// The CEP PDF requires exactly 7 fields in every envelope.
// Priority is intentionally NOT included here — it is optional metadata
// used only by the BoundedEventQueue (Phase 7 / CLO4 Scenario 2).

export interface EventEnvelope<TPayload = unknown> {
  /** Unique ID for this specific event instance (UUID) */
  event_id: string;
  /** Groups related events together (e.g. one vehicle's full journey) */
  correlation_id: string;
  /** Version number of the event format (starts at 1) */
  schema_version: number;
  /** Which camera sent this event */
  source_id: string;
  /** Date and time the event was created (ISO 8601) */
  timestamp: string;
  /** Name of the event class, e.g. "SpeedViolationEvent" */
  event_type: string;
  /** The actual event data */
  payload: TPayload;
}

// ─── Event Priority ────────────────────────────────────────────
// Kept separate from the envelope because the CEP PDF lists only 7 required
// envelope fields. Priority is used by BoundedEventQueue for eviction policy.

export type EventPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

// ─── Extended Envelope (for internal use with bounded queue) ───
// This adds optional priority metadata without changing the core 7-field contract.

export interface EventEnvelopeWithPriority<TPayload = unknown>
  extends EventEnvelope<TPayload> {
  priority?: EventPriority;
}
