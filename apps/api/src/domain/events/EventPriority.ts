/**
 * EventPriority — used by BoundedEventQueue (CLO4 Scenario 2)
 *
 * This is intentionally separate from EventEnvelope because the CEP PDF
 * requires only 7 fields in the envelope. Priority is metadata used for
 * queue eviction decisions, not part of the core event contract.
 */
export type EventPriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

/** Numeric rank for priority comparison in bounded queue eviction */
export const PRIORITY_RANK: Record<EventPriority, number> = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4,
};
