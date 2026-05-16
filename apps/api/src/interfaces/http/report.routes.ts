import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

export function createReportRoutes(ctx: SystemContext): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    const reports = await ctx.reportRepo.findAll();
    res.json(reports);
  });
  return router;
}
