import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

/**
 * Admin routes — destructive operations that operators trigger from the UI.
 *
 * /reset-runtime-data wipes every "runtime" table (penalties, audit logs,
 * envelopes, incidents, outbox, snapshots, operator actions) but leaves the
 * "configuration" tables (zones, intersections, cameras, templates, severity
 * policies, incident rules, queue policies, fine policies, external-provider
 * config) untouched. The point: a viva examiner can wipe the slate to zero
 * and watch each number grow from real publishes, proving nothing is
 * pre-loaded.
 */
export function createAdminRoutes(ctx: SystemContext): Router {
  const router = Router();

  router.post("/reset-runtime-data", async (_req, res) => {
    try {
      const before = {
        penalties:     await ctx.prisma.penalty.count(),
        auditLogs:     await ctx.prisma.auditLog.count(),
        envelopes:     await ctx.prisma.eventEnvelopeRecord.count(),
        processed:     await ctx.prisma.processedEvent.count(),
        incidents:     await ctx.prisma.trafficIncident.count(),
        incidentEvents: await ctx.prisma.incidentEvent.count(),
        outbox:        await ctx.prisma.eventOutbox.count(),
        snapshots:     await ctx.prisma.externalTrafficSnapshot.count(),
        dashboard:     await ctx.prisma.dashboardSnapshot.count(),
        reports:       await ctx.prisma.reportAggregate.count(),
        operatorLogs:  await ctx.prisma.operatorActionLog.count(),
      };

      // Order matters because of FK relations:
      //   IncidentEvent → TrafficIncident (so IncidentEvent first)
      await ctx.prisma.incidentEvent.deleteMany();
      await ctx.prisma.trafficIncident.deleteMany();
      await ctx.prisma.penalty.deleteMany();
      await ctx.prisma.processedEvent.deleteMany();
      await ctx.prisma.auditLog.deleteMany();
      await ctx.prisma.dashboardSnapshot.deleteMany();
      await ctx.prisma.reportAggregate.deleteMany();
      await ctx.prisma.eventEnvelopeRecord.deleteMany();
      await ctx.prisma.eventOutbox.deleteMany();
      await ctx.prisma.externalTrafficSnapshot.deleteMany();
      await ctx.prisma.operatorActionLog.deleteMany();

      // Reset in-memory subscriber counters so the metrics view also flips to zero.
      for (const s of [ctx.alertService, ctx.loggingService, ctx.dashboardService, ctx.reportingService, ctx.incidentService]) {
        const target = s as unknown as { _duplicateIgnoredCount?: number; _processedCount?: number };
        target._duplicateIgnoredCount = 0;
        target._processedCount = 0;
      }

      // Final breadcrumb on the *config-side* OperatorActionLog so the action
      // is itself audited. (It was just wiped — this writes the very first row
      // of the new audit history.)
      await ctx.operatorActionRepo.log({
        actionType: "RESET_RUNTIME_DATA",
        targetType: "System",
        targetId: "ALL",
        message: `Wiped runtime data: ${Object.entries(before).map(([k, v]) => `${k}=${v}`).join(", ")}`,
      });

      res.json({ ok: true, cleared: before });
    } catch (err) {
      console.error("[admin] reset-runtime-data failed", err);
      res.status(500).json({ error: "Reset failed", detail: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
