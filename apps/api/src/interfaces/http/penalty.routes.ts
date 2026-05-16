import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

export function createPenaltyRoutes(ctx: SystemContext): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    const penalties = await ctx.penaltyRepo.findAll();
    res.json(penalties);
  });
  return router;
}
