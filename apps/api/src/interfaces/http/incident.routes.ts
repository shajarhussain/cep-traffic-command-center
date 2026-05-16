import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

export function createIncidentRoutes(ctx: SystemContext): Router {
  const router = Router();

  // GET /api/incidents — all incidents (optionally filter by status)
  router.get("/", async (req, res) => {
    try {
      const status = req.query["status"] as string | undefined;
      const where = status ? { status } : {};
      const incidents = await ctx.prisma.trafficIncident.findMany({
        where,
        orderBy: { opened_at: "desc" },
        include: { events: { orderBy: { createdAt: "desc" }, take: 10 } },
      });
      res.json(incidents);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load incidents" });
    }
  });

  // GET /api/incidents/:id — single incident with related events
  router.get("/:id", async (req, res) => {
    try {
      const incident = await ctx.prisma.trafficIncident.findUnique({
        where: { id: req.params["id"] },
        include: { events: { orderBy: { createdAt: "desc" } } },
      });
      if (!incident) return res.status(404).json({ error: "Incident not found" });
      res.json(incident);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load incident" });
    }
  });

  // POST /api/incidents/:id/acknowledge
  router.post("/:id/acknowledge", async (req, res) => {
    try {
      const incident = await ctx.prisma.trafficIncident.update({
        where: { id: req.params["id"] },
        data: { status: "ACKNOWLEDGED", acknowledged_at: new Date() },
      });
      // Log operator action
      await ctx.prisma.operatorActionLog.create({
        data: {
          actionType: "ACKNOWLEDGE_INCIDENT",
          targetType: "TrafficIncident",
          targetId: incident.id,
          message: `Incident at ${incident.intersection_name} acknowledged`,
        },
      });
      res.json(incident);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Failed to acknowledge incident" });
    }
  });

  // POST /api/incidents/:id/close
  router.post("/:id/close", async (req, res) => {
    try {
      const incident = await ctx.prisma.trafficIncident.update({
        where: { id: req.params["id"] },
        data: { status: "CLEARED", cleared_at: new Date() },
      });
      await ctx.prisma.operatorActionLog.create({
        data: {
          actionType: "CLOSE_INCIDENT",
          targetType: "TrafficIncident",
          targetId: incident.id,
          message: `Incident at ${incident.intersection_name} closed by operator`,
        },
      });
      res.json(incident);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: "Failed to close incident" });
    }
  });

  return router;
}
