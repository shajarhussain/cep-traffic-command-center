import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

/**
 * System metrics endpoint — surfaces live health signals from the event bus,
 * subscribers, and outbox. Surfaced in the Reliability page as a "Live Metrics"
 * card so a viva examiner can see real numbers reacting to publish actions.
 */
export function createMetricsRoutes(ctx: SystemContext): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const sixtySecondsAgo = new Date(Date.now() - 60_000);

      const [eventsLast60s, outboxPending, outboxPublished, outboxFailed] = await Promise.all([
        ctx.prisma.eventEnvelopeRecord.count({ where: { createdAt: { gte: sixtySecondsAgo } } }),
        ctx.outboxRepo.countByStatus("PENDING"),
        ctx.outboxRepo.countByStatus("PUBLISHED"),
        ctx.outboxRepo.countByStatus("FAILED"),
      ]);

      const subscribers = [
        ctx.alertService, ctx.loggingService, ctx.dashboardService,
        ctx.reportingService, ctx.incidentService,
      ].map(s => ({
        name: s.name,
        processedCount: s.processedCount,
        duplicateIgnoredCount: s.duplicateIgnoredCount,
      }));

      const duplicatesIgnoredTotal = subscribers.reduce((a, s) => a + s.duplicateIgnoredCount, 0);

      res.json({
        eventsLast60s,
        eventsPerSecond: Math.round((eventsLast60s / 60) * 100) / 100,
        outbox: {
          pendingCount: outboxPending,
          publishedCount: outboxPublished,
          failedCount: outboxFailed,
          relayRunning: ctx.outboxRelay.isRunning(),
          relayLastTickAt: ctx.outboxRelay.lastTickAt,
          relayPublishedTotal: ctx.outboxRelay.publishedCount,
          relayFailedTotal: ctx.outboxRelay.failedCount,
        },
        duplicatesIgnoredTotal,
        subscribers,
        registeredEventTypes: ctx.eventBus.getRegisteredEventTypes(),
        capturedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[metrics] failed", err);
      res.status(500).json({ error: "Failed to compute metrics" });
    }
  });

  return router;
}
