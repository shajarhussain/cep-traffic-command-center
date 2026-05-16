/**
 * EventTypes — CEP Part A Task 1 (10 marks)
 *
 * The CEP requires exactly 4 event types. Each type has its own payload interface.
 * A 5th type (EmergencyVehicleEvent) is used only in tests to prove that adding
 * a new event type requires zero changes to existing camera or EventBus code.
 */

// ─── Event Type String Constants ───────────────────────────────
export const EVENT_TYPES = {
  VehicleDetected: "VehicleDetectedEvent",
  SpeedViolation: "SpeedViolationEvent",
  CongestionAlert: "CongestionAlertEvent",
  TrafficCleared: "TrafficClearedEvent",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

// ─── Payload Interfaces ────────────────────────────────────────

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

// ─── 5th Event Type (for extensibility proof only) ─────────────
// This type exists to prove that adding a new event type requires
// zero changes to CameraSimulator or EventBus code.

export interface EmergencyVehiclePayload {
  vehicle_plate: string;
  intersection_name: string;
  route_priority: "AMBULANCE" | "FIRE" | "POLICE";
}
