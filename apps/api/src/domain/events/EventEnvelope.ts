/**
 * EventEnvelope — CEP Part A Task 3 (5 marks)
 *
 * Every event must be wrapped in an EventEnvelope before it travels on the bus.
 * The CEP PDF requires exactly 7 fields:
 *   event_id, correlation_id, schema_version, source_id, timestamp, event_type, payload
 *
 * Priority is intentionally excluded from this interface because the PDF lists
 * only 7 required fields. Priority is handled separately by BoundedEventQueue.
 */
export interface EventEnvelope<TPayload = unknown> {
  /** A unique ID for this specific event instance (UUID) */
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
