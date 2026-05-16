import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";
import type { EventEnvelope } from "../../domain/events/EventEnvelope.js";

export function createOutboxRoutes(ctx: SystemContext): Router {
  const router = Router();

  router.get("/status", async (_req, res) => {
    try {
      const [pendingCount, publishedCount, failedCount] = await Promise.all([
        ctx.outboxRepo.countByStatus("PENDING"),
        ctx.outboxRepo.countByStatus("PUBLISHED"),
        ctx.outboxRepo.countByStatus("FAILED"),
      ]);
      res.json({ pendingCount, publishedCount, failedCount, relayRunning: ctx.outboxRelay.isRunning() });
    } catch (err) {
      console.error("[outbox] status failed", err);
      res.status(500).json({ error: "Failed to load outbox status" });
    }
  });

  router.get("/", async (req, res) => {
    try {
      const status = typeof req.query["status"] === "string" ? req.query["status"] : undefined;
      const limit = Math.min(parseInt((req.query["limit"] as string) ?? "100", 10) || 100, 500);
      const rows = await ctx.prisma.eventOutbox.findMany({
        where: status ? { status } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      res.json(rows.map(r => ({
        id: r.id,
        event_id: r.eventId,
        envelope_json: r.envelopeJson,
        status: r.status,
        attempt_count: r.attemptCount,
        last_error: r.lastError,
        created_at: r.createdAt.toISOString(),
        published_at: r.publishedAt?.toISOString() ?? null,
      })));
    } catch (err) {
      console.error("[outbox] list failed", err);
      res.status(500).json({ error: "Failed to list outbox" });
    }
  });

  /** Force one tick of the background relay (handy for tests + UI button) */
  router.post("/relay-once", async (_req, res) => {
    try {
      const result = await ctx.outboxRelay.tick();
      res.json({ relayed: result.published, failed: result.failed, skipped: result.skipped });
    } catch (err) {
      console.error("[outbox] relay-once failed", err);
      res.status(500).json({ error: "Failed to relay outbox events" });
    }
  });

  /** Manually replay a single outbox row (also resets a FAILED row to PENDING). */
  router.post("/relay-one/:id", async (req, res) => {
    try {
      const row = await ctx.outboxRepo.findById(req.params["id"]!);
      if (!row) return res.status(404).json({ error: "Outbox entry not found" });

      if (row.status === "FAILED") {
        await ctx.outboxRepo.resetToPending(row.event_id);
      }

      let envelope: EventEnvelope;
      try {
        envelope = JSON.parse(row.envelope_json) as EventEnvelope;
      } catch (err) {
        await ctx.outboxRepo.markFailed(row.event_id, `Malformed envelopeJson: ${(err as Error).message}`);
        return res.status(400).json({ error: "Outbox entry has malformed envelopeJson" });
      }

      try {
        await ctx.eventBus.publish(envelope);
        await ctx.outboxRepo.markPublished(row.event_id);
        res.json({ status: "PUBLISHED", event_id: row.event_id });
      } catch (err) {
        await ctx.outboxRepo.recordFailure(row.event_id, err instanceof Error ? err.message : String(err), 5);
        res.status(500).json({ status: "FAILED", error: err instanceof Error ? err.message : String(err) });
      }
    } catch (err) {
      console.error("[outbox] relay-one failed", err);
      res.status(500).json({ error: "Failed to replay outbox entry" });
    }
  });

  return router;
}
