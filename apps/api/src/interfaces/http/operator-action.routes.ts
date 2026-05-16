import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

/**
 * Operator action audit endpoint. Surfaces every row written by
 * OperatorActionRepository so a viva examiner can trace any subscribe /
 * fine-policy edit / incident ack / external-provider toggle back to its
 * actor and timestamp.
 */
export function createOperatorActionRoutes(ctx: SystemContext): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    try {
      const limit = parseInt((req.query["limit"] as string) ?? "200", 10) || 200;
      const rows = await ctx.operatorActionRepo.list(limit);
      res.json(rows);
    } catch (err) {
      console.error("[operator-actions] list failed", err);
      res.status(500).json({ error: "Failed to load operator actions" });
    }
  });

  return router;
}
