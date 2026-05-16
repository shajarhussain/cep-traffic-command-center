import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

/**
 * Fine Policy routes — user-driven fine schedule (Configuration Center → Fine Policies tab).
 *
 * Replaces the previously hardcoded fines in AlertService:
 *   excessKmh > 30 ? 5000 : > 15 ? 3000 : 1500
 * with a CRUD-managed table. Operators tune fines without touching code.
 */
export function createFinePolicyRoutes(ctx: SystemContext): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const rows = await ctx.finePolicyRepo.list();
      res.json(rows);
    } catch (err) {
      console.error("[fine-policy] list failed", err);
      res.status(500).json({ error: "Failed to list fine policies" });
    }
  });

  router.post("/", async (req, res) => {
    const { name, eventType, excessThresholdKmh, fineAmount, active } = req.body ?? {};
    if (!name || !eventType) return res.status(400).json({ error: "name and eventType are required" });
    if (typeof excessThresholdKmh !== "number" || excessThresholdKmh < 0) return res.status(400).json({ error: "excessThresholdKmh must be a non-negative number" });
    if (typeof fineAmount !== "number" || fineAmount < 0) return res.status(400).json({ error: "fineAmount must be a non-negative number" });
    try {
      const row = await ctx.finePolicyRepo.create({ name, eventType, excessThresholdKmh, fineAmount, active });
      await ctx.operatorActionRepo.log({
        actionType: "CREATE_FINE_POLICY",
        targetType: "FinePolicy",
        targetId: row.id,
        message: `Created "${row.name}" — ${eventType} ≥ ${excessThresholdKmh} km/h → Rs ${fineAmount}`,
      });
      res.status(201).json(row);
    } catch (err) {
      console.error("[fine-policy] create failed", err);
      res.status(500).json({ error: "Failed to create fine policy" });
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      const id = req.params["id"]!;
      const row = await ctx.finePolicyRepo.update(id, req.body ?? {});
      await ctx.operatorActionRepo.log({
        actionType: "UPDATE_FINE_POLICY",
        targetType: "FinePolicy",
        targetId: id,
        message: `Updated "${row.name}" — fine now Rs ${row.fineAmount} for excess ≥ ${row.excessThresholdKmh} km/h (active=${row.active})`,
      });
      res.json(row);
    } catch (err) {
      console.error("[fine-policy] update failed", err);
      res.status(404).json({ error: "Fine policy not found" });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const id = req.params["id"]!;
      await ctx.finePolicyRepo.delete(id);
      await ctx.operatorActionRepo.log({
        actionType: "DELETE_FINE_POLICY",
        targetType: "FinePolicy",
        targetId: id,
        message: `Deleted fine policy ${id}`,
      });
      res.status(204).end();
    } catch (err) {
      console.error("[fine-policy] delete failed", err);
      res.status(404).json({ error: "Fine policy not found" });
    }
  });

  return router;
}
