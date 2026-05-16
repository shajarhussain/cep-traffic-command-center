import { randomUUID } from "node:crypto";
import type { EventEnvelope } from "./EventEnvelope.js";

/**
 * createEnvelope — Factory helper for EventEnvelope
 *
 * Generates a new EventEnvelope with:
 *   - auto-generated UUID event_id
 *   - auto-generated ISO timestamp
 *   - schema_version defaulting to 1
 *   - caller-supplied correlation_id, source_id, event_type, and payload
 *
 * This helper is what cameras use to create events. The camera only needs to
 * provide the event-specific data; identity and metadata are handled here.
 */
export function createEnvelope<TPayload>(params: {
  source_id: string;
  event_type: string;
  payload: TPayload;
  correlation_id?: string;
  schema_version?: number;
  event_id?: string; // allow override for duplicate testing
}): EventEnvelope<TPayload> {
  return {
    event_id: params.event_id ?? randomUUID(),
    correlation_id: params.correlation_id ?? randomUUID(),
    schema_version: params.schema_version ?? 1,
    source_id: params.source_id,
    timestamp: new Date().toISOString(),
    event_type: params.event_type,
    payload: params.payload,
  };
}
