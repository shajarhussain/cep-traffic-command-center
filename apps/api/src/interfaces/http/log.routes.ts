import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

export function createLogRoutes(ctx: SystemContext): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    const logs = await ctx.auditLogRepo.findAll();
    res.json(logs);
  });
  return router;
}
