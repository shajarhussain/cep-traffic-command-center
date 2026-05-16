import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

export function createDashboardRoutes(ctx: SystemContext): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    const snapshots = await ctx.dashboardRepo.findAll();
    res.json(snapshots);
  });
  return router;
}
