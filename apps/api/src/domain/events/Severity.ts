import { EVENT_TYPES } from "./EventTypes.js";
import type { EventEnvelope } from "./EventEnvelope.js";
import type { PrismaClient } from "@prisma/client";

/**
 * calculateSeverity — Default fallback severity logic (no DB needed).
 * Used by tests and as a fallback when no SeverityPolicy exists.
 */
export function calculateSeverity(envelope: EventEnvelope): string {
  const payload = envelope.payload as Record<string, any>;
  switch (envelope.event_type) {
    case EVENT_TYPES.SpeedViolation: {
      const excess = (payload.speed_kmh as number || 0) - (payload.speed_limit_kmh as number || 0);
      if (excess > 25) return "HIGH";
      if (excess >= 10) return "MEDIUM";
      return "LOW";
    }
    case EVENT_TYPES.CongestionAlert: {
      const level = payload.congestion_level as string;
      if (level) return level.toUpperCase();
      return "HIGH";
    }
    case EVENT_TYPES.VehicleDetected:
      return "LOW";
    case EVENT_TYPES.TrafficCleared:
      return "INFO";
    default:
      return "UNKNOWN";
  }
}

/**
 * calculateSeverityFromPolicy — Uses active SeverityPolicy from the DB.
 * Falls back to calculateSeverity() if no matching policy is found.
 *
 * This is the user-driven severity calculation:
 * Operators can configure threshold values in SeverityPolicy records
 * to change when LOW/MEDIUM/HIGH/CRITICAL is assigned.
 */
export async function calculateSeverityFromPolicy(
  envelope: EventEnvelope,
  prisma: PrismaClient
): Promise<string> {
  try {
    const policy = await prisma.severityPolicy.findFirst({
      where: { eventType: envelope.event_type, active: true },
      orderBy: { createdAt: "desc" },
    });

    if (!policy) {
      // No DB policy for this event type — use default logic
      return calculateSeverity(envelope);
    }

    const payload = envelope.payload as Record<string, any>;

    // For CongestionAlertEvent, severity comes from congestion_level directly
    if (envelope.event_type === EVENT_TYPES.CongestionAlert) {
      const level = payload.congestion_level as string;
      if (level) return level.toUpperCase();
      return "HIGH";
    }

    // For threshold-based policies (e.g. SpeedViolation), read the field value
    const fieldValue = Number(payload[policy.payloadField] ?? 0);

    // Calculate excess for speed (field is "speed_excess" or compute from speed - limit)
    let value = fieldValue;
    if (policy.payloadField === "speed_excess") {
      value = (payload.speed_kmh ?? 0) - (payload.speed_limit_kmh ?? 0);
    }

    // Compare against thresholds (highest first)
    if (policy.criticalThreshold != null && value >= policy.criticalThreshold) return "CRITICAL";
    if (policy.highThreshold != null && value >= policy.highThreshold) return "HIGH";
    if (policy.mediumThreshold != null && value >= policy.mediumThreshold) return "MEDIUM";
    if (policy.lowThreshold != null && value >= policy.lowThreshold) return "LOW";

    return "INFO";
  } catch {
    // If DB query fails, fall back to default logic
    return calculateSeverity(envelope);
  }
}
