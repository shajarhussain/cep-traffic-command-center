import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

export function createConfigRoutes(ctx: SystemContext): Router {
  const router = Router();
  const { prisma } = ctx;

  // ─── Operation Zones ─────────────────────────────────────────
  router.get("/zones", async (_req, res) => {
    try {
      const zones = await prisma.operationZone.findMany({ include: { intersections: true } });
      res.json(zones);
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load zones" }); }
  });

  router.post("/zones", async (req, res) => {
    try {
      const zone = await prisma.operationZone.create({ data: req.body });
      res.status(201).json(zone);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to create zone" }); }
  });

  router.put("/zones/:id", async (req, res) => {
    try {
      const zone = await prisma.operationZone.update({ where: { id: req.params["id"] }, data: req.body });
      res.json(zone);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to update zone" }); }
  });

  // ─── Intersections ───────────────────────────────────────────
  router.get("/intersections", async (_req, res) => {
    try {
      const items = await prisma.intersection.findMany({ include: { cameras: true, zone: true }, orderBy: { name: "asc" } });
      res.json(items);
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load intersections" }); }
  });

  router.post("/intersections", async (req, res) => {
    try {
      const item = await prisma.intersection.create({ data: req.body });
      res.status(201).json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to create intersection" }); }
  });

  router.put("/intersections/:id", async (req, res) => {
    try {
      const item = await prisma.intersection.update({ where: { id: req.params["id"] }, data: req.body });
      res.json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to update intersection" }); }
  });

  // ─── Alert Templates ─────────────────────────────────────────
  router.get("/alert-templates", async (_req, res) => {
    try {
      const items = await prisma.alertTemplate.findMany({ orderBy: { name: "asc" } });
      res.json(items);
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load alert templates" }); }
  });

  router.post("/alert-templates", async (req, res) => {
    try {
      const item = await prisma.alertTemplate.create({ data: req.body });
      res.status(201).json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to create alert template" }); }
  });

  router.put("/alert-templates/:id", async (req, res) => {
    try {
      const item = await prisma.alertTemplate.update({ where: { id: req.params["id"] }, data: req.body });
      res.json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to update alert template" }); }
  });

  // ─── Severity Policies ───────────────────────────────────────
  router.get("/severity-policies", async (_req, res) => {
    try {
      const items = await prisma.severityPolicy.findMany({ orderBy: { eventType: "asc" } });
      res.json(items);
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load severity policies" }); }
  });

  router.post("/severity-policies", async (req, res) => {
    try {
      const item = await prisma.severityPolicy.create({ data: req.body });
      res.status(201).json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to create severity policy" }); }
  });

  router.put("/severity-policies/:id", async (req, res) => {
    try {
      const item = await prisma.severityPolicy.update({ where: { id: req.params["id"] }, data: req.body });
      res.json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to update severity policy" }); }
  });

  // ─── Incident Rules ──────────────────────────────────────────
  router.get("/incident-rules", async (_req, res) => {
    try {
      const items = await prisma.incidentRule.findMany({ orderBy: { name: "asc" } });
      res.json(items);
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load incident rules" }); }
  });

  router.post("/incident-rules", async (req, res) => {
    try {
      const item = await prisma.incidentRule.create({ data: req.body });
      res.status(201).json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to create incident rule" }); }
  });

  router.put("/incident-rules/:id", async (req, res) => {
    try {
      const item = await prisma.incidentRule.update({ where: { id: req.params["id"] }, data: req.body });
      res.json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to update incident rule" }); }
  });

  // ─── Queue Policies ──────────────────────────────────────────
  router.get("/queue-policies", async (_req, res) => {
    try {
      const items = await prisma.queuePolicy.findMany({ orderBy: { name: "asc" } });
      res.json(items);
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load queue policies" }); }
  });

  router.post("/queue-policies", async (req, res) => {
    try {
      const item = await prisma.queuePolicy.create({ data: req.body });
      res.status(201).json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to create queue policy" }); }
  });

  router.put("/queue-policies/:id", async (req, res) => {
    try {
      const item = await prisma.queuePolicy.update({ where: { id: req.params["id"] }, data: req.body });
      res.json(item);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to update queue policy" }); }
  });

  // ─── External Provider ───────────────────────────────────────
  router.get("/external-provider", async (_req, res) => {
    try {
      const config = await prisma.externalProviderConfig.findFirst({ include: { zone: true } });
      res.json(config);
    } catch (err) { console.error(err); res.status(500).json({ error: "Failed to load external provider" }); }
  });

  router.put("/external-provider", async (req, res) => {
    try {
      const existing = await prisma.externalProviderConfig.findFirst();
      if (!existing) return res.status(404).json({ error: "No external provider configured" });
      const updated = await prisma.externalProviderConfig.update({ where: { id: existing.id }, data: req.body });
      if (typeof req.body?.enabled === "boolean" && req.body.enabled !== existing.enabled) {
        await ctx.operatorActionRepo.log({
          actionType: "TOGGLE_PROVIDER",
          targetType: "ExternalProviderConfig",
          targetId: existing.id,
          message: `${updated.provider} provider ${updated.enabled ? "enabled" : "disabled"}`,
        });
      }
      res.json(updated);
    } catch (err) { console.error(err); res.status(400).json({ error: "Failed to update external provider" }); }
  });

  return router;
}
