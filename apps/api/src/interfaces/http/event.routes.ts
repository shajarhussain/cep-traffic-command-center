import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";
import { ValidationError } from "../../application/PublishEventUseCase.js";

export function createEventRoutes(ctx: SystemContext): Router {
  const router = Router();

  // POST /api/events/publish
  router.post("/publish", async (req, res) => {
    try {
      const { source_id, event_type, payload, correlation_id, event_id } = req.body;
      const result = await ctx.publishUseCase.execute({
        source_id, event_type, payload: payload ?? {}, correlation_id, event_id,
      });
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  // POST /api/events/publish-duplicate-speed-violation
  router.post("/publish-duplicate-speed-violation", async (_req, res) => {
    try {
      const result = await ctx.duplicateUseCase.execute();
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/events
  router.get("/", async (_req, res) => {
    const envelopes = await ctx.eventRepo.findAll();
    res.json(envelopes);
  });

  return router;
}
