import { BaseIdempotentSubscriber } from "./BaseIdempotentSubscriber.js";
import type { ProcessedEventRepository } from "./BaseIdempotentSubscriber.js";
import type { EventEnvelope } from "../events/EventEnvelope.js";
import { EVENT_TYPES } from "../events/EventTypes.js";
import { PrismaClient } from "@prisma/client";
import { calculateSeverityFromPolicy } from "../events/Severity.js";
import { fetchTomTomCorroboration } from "../../infrastructure/tomtom.js";

export class IncidentService extends BaseIdempotentSubscriber {
  readonly name = "IncidentService";
  readonly supportedEventTypes = [
    EVENT_TYPES.SpeedViolation,
    EVENT_TYPES.CongestionAlert,
    EVENT_TYPES.VehicleDetected,
    EVENT_TYPES.TrafficCleared,
  ];

  constructor(
    processedRepo: ProcessedEventRepository,
    private readonly prisma: PrismaClient
  ) {
    super(processedRepo);
  }

  protected async process(envelope: EventEnvelope): Promise<void> {
    const camera = await this.prisma.trafficCamera.findUnique({
      where: { id: envelope.source_id }
    });
    if (!camera) return;

    const intersectionName = camera.intersectionName;

    // Use DB-driven severity calculation (falls back to default if no policy)
    const severity = await calculateSeverityFromPolicy(envelope, this.prisma);

    // Load active incident rule for this event type from DB
    const rule = await this.prisma.incidentRule.findFirst({
      where: { eventType: envelope.event_type, active: true },
      orderBy: { createdAt: "desc" },
    }).catch(() => null);

    // Determine grouping window (from DB rule or default 30 minutes)
    const windowMinutes = rule?.groupingWindowMinutes ?? 30;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    // Check for auto-clear event type (from DB rule)
    const autoClearEventType = rule?.autoClearEventType;

    // Handle TrafficCleared or rule-defined auto-clear
    if (
      envelope.event_type === EVENT_TYPES.TrafficCleared ||
      (autoClearEventType && envelope.event_type === autoClearEventType)
    ) {
      const incident = await this.prisma.trafficIncident.findFirst({
        where: { intersection_name: intersectionName, status: "OPEN" },
        orderBy: { opened_at: "desc" }
      });
      if (incident) {
        await this.prisma.trafficIncident.update({
          where: { id: incident.id },
          data: {
            status: "CLEARED",
            cleared_at: new Date(),
            last_event_id: envelope.event_id,
            event_count: { increment: 1 }
          }
        });
      }
      return;
    }

    // Find existing open incident within the grouping window
    let incident = await this.prisma.trafficIncident.findFirst({
      where: {
        intersection_name: intersectionName,
        status: "OPEN",
        opened_at: { gte: windowStart },
      },
      orderBy: { opened_at: "desc" }
    });

    if (!incident) {
      // Only open a new incident for violation/congestion events
      // and if the minimumEvents threshold is met (for first event, always create)
      if (envelope.event_type === EVENT_TYPES.SpeedViolation || envelope.event_type === EVENT_TYPES.CongestionAlert) {
        const incidentType = rule?.incidentType ?? envelope.event_type;
        const created = await this.prisma.trafficIncident.create({
          data: {
            intersection_name: intersectionName,
            incident_type: incidentType,
            severity: severity,
            status: "OPEN",
            first_event_id: envelope.event_id,
            last_event_id: envelope.event_id,
            event_count: 1
          }
        });
        // Fire-and-forget TomTom corroboration (escalates severity if the
        // external picture is worse than what the camera saw).
        this.corroborate(created.id, severity).catch(err => console.error("[incident] corroboration failed", err));
      }
    } else {
      const isHigherSeverity = (s1: string, s2: string) => {
        const ranks: Record<string, number> = { "INFO": 1, "LOW": 2, "MEDIUM": 3, "HIGH": 4, "CRITICAL": 5 };
        return (ranks[s1] || 0) > (ranks[s2] || 0);
      };

      const newSeverity = isHigherSeverity(severity, incident.severity) ? severity : incident.severity;
      const escalated = newSeverity !== incident.severity;

      await this.prisma.trafficIncident.update({
        where: { id: incident.id },
        data: {
          event_count: { increment: 1 },
          last_event_id: envelope.event_id,
          severity: newSeverity
        }
      });

      // Re-corroborate on escalation so the audit reflects the worse external state.
      if (escalated) {
        this.corroborate(incident.id, newSeverity).catch(err => console.error("[incident] corroboration failed", err));
      }
    }
  }

  /**
   * Ask TomTom for a second opinion on an open incident. If TomTom corroborates
   * (severe slow-down or external incidents in the zone), set external_confirmed=true,
   * write external_context_summary, and bump severity one level when the external
   * picture is worse than our cameras suggest.
   */
  private async corroborate(incidentId: string, currentSeverity: string): Promise<void> {
    const corr = await fetchTomTomCorroboration(this.prisma);
    if (!corr.available) {
      await this.prisma.trafficIncident.update({
        where: { id: incidentId },
        data: { external_context_summary: corr.summary },
      }).catch(() => undefined);
      return;
    }

    // Optional severity bump: if TomTom reports POOR flow, escalate one level.
    const ladder = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const idx = ladder.indexOf(currentSeverity);
    const bumped = corr.severity === "POOR" && idx >= 0 && idx < ladder.length - 1
      ? ladder[idx + 1]!
      : currentSeverity;

    await this.prisma.trafficIncident.update({
      where: { id: incidentId },
      data: {
        external_confirmed: corr.confirms,
        external_context_summary: corr.summary,
        severity: bumped,
      },
    }).catch(err => console.error("[incident] failed to write corroboration", err));
  }
}
