import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";
import { EVENT_TYPES } from "../../domain/events/EventTypes.js";
import { BoundedEventQueue } from "../../domain/bus/BoundedEventQueue.js";

export function createSummaryRoutes(ctx: SystemContext): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    try {
      const [
        cameraCount,
        intersectionCount,
        eventCount,
        violationCount,
        penaltyCount,
        congestionCount,
        openIncidentCount,
        criticalIncidentCount,
        latestEvents,
        latestIncident,
        latestPenalty,
        activeZone,
        queuePolicy,
        externalProvider,
      ] = await Promise.all([
        ctx.prisma.trafficCamera.count(),
        ctx.prisma.intersection.count(),
        ctx.prisma.eventEnvelopeRecord.count(),
        ctx.prisma.eventEnvelopeRecord.count({ where: { eventType: EVENT_TYPES.SpeedViolation } }),
        ctx.prisma.penalty.count(),
        ctx.prisma.eventEnvelopeRecord.count({ where: { eventType: EVENT_TYPES.CongestionAlert } }),
        ctx.prisma.trafficIncident.count({ where: { status: "OPEN" } }),
        ctx.prisma.trafficIncident.count({ where: { status: "OPEN", severity: "CRITICAL" } }),
        ctx.prisma.eventEnvelopeRecord.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
        ctx.prisma.trafficIncident.findFirst({ where: { status: "OPEN" }, orderBy: { opened_at: "desc" } }),
        ctx.prisma.penalty.findFirst({ orderBy: { issuedAt: "desc" } }),
        ctx.prisma.operationZone.findFirst(),
        ctx.prisma.queuePolicy.findFirst({ where: { active: true } }),
        ctx.prisma.externalProviderConfig.findFirst(),
      ]);

      // Queue risk
      const inRate = queuePolicy?.incomingRate ?? 500;
      const procRate = queuePolicy?.processingRate ?? 80;
      const qLimit = queuePolicy?.queueLimit ?? 10000;
      const backlog = inRate - procRate;
      const secondsUntilFull = backlog > 0 ? Math.round((qLimit / backlog) * 100) / 100 : Infinity;
      let queueRisk = "LOW";
      if (secondsUntilFull < 30) queueRisk = "CRITICAL";
      else if (secondsUntilFull < 60) queueRisk = "HIGH";
      else if (secondsUntilFull < 120) queueRisk = "MEDIUM";

      res.json({
        cameraCount,
        intersectionCount,
        eventCount,
        activeAlertCount: eventCount,
        violationCount,
        penaltyCount,
        serviceCount: 5,
        congestionCount,
        openIncidentCount,
        criticalIncidentCount,
        incidentCount: openIncidentCount,
        latestEvents,
        latestIncident,
        latestPenalty,
        activeZone: activeZone ? { id: activeZone.id, name: activeZone.name, city: activeZone.city } : null,
        queueRisk,
        queueSecondsUntilFull: secondsUntilFull,
        externalProviderStatus: externalProvider?.enabled ? externalProvider.lastStatus : "DISABLED",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load summary" });
    }
  });
  return router;
}
