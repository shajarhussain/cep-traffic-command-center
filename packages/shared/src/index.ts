/**
 * Shared package entry point.
 * Re-exports all event contracts for use by api and web packages.
 */
export {
  EVENT_TYPES,
  type EventType,
  type VehicleDetectedPayload,
  type SpeedViolationPayload,
  type CongestionAlertPayload,
  type TrafficClearedPayload,
  type EventEnvelope,
  type EventPriority,
  type EventEnvelopeWithPriority,
} from "./event-contracts.js";
