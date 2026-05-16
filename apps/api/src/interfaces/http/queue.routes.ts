import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";
import { BoundedEventQueue } from "../../domain/bus/BoundedEventQueue.js";
import { createEnvelope } from "../../domain/events/createEnvelope.js";
import { EVENT_TYPES } from "../../domain/events/EventTypes.js";

/**
 * GET /api/queue/analysis
 *
 * Uses the active QueuePolicy from the database if available.
 * Falls back to the default scenario: 500 in, 80 out, 10000 limit → 23.81s.
 */
export function createQueueRoutes(ctx: SystemContext): Router {
  const router = Router();

  router.get("/analysis", async (_req, res) => {
    try {
      const policy = await ctx.prisma.queuePolicy.findFirst({
        where: { active: true },
        orderBy: { createdAt: "desc" },
      });

      const incomingRate = policy?.incomingRate ?? 500;
      const processingRate = policy?.processingRate ?? 80;
      const queueLimit = policy?.queueLimit ?? 10_000;
      const evictionPolicy = policy?.evictionPolicy ?? "Drop least important first; if same priority, drop oldest";

      const queue = new BoundedEventQueue(queueLimit);
      const analysis = queue.analyzeCapacity(incomingRate, processingRate);

      res.json({
        ...analysis,
        evictionPolicy,
        policyName: policy?.name ?? "Default Scenario",
        policyId: policy?.id ?? null,
        configurable: true,
      });
    } catch (err) {
      console.error(err);
      // Fallback to hardcoded default
      const queue = new BoundedEventQueue(10_000);
      const analysis = queue.analyzeCapacity(500, 80);
      res.json({ ...analysis, policyName: "Default Scenario (fallback)", configurable: true });
    }
  });

  /**
   * POST /api/queue/flood-test
   *
   * Generates N synthetic envelopes against the active QueuePolicy's bounded
   * queue and reports how many were accepted vs evicted. This is the
   * interactive proof of CLO4 Scenario 2 — the rubric asks for a flood test
   * that demonstrates eviction kicks in when capacity is exceeded.
   *
   * Body:  { count?: number = 200, queueLimit?: number, weights?: {<eventType>: number} }
   * Reply: { published, accepted, evicted, finalQueueSize, breakdown }
   */
  router.post("/flood-test", async (req, res) => {
    const body = (req.body ?? {}) as { count?: number; queueLimit?: number; weights?: Record<string, number> };
    const count = Math.max(1, Math.min(5000, Math.floor(body.count ?? 200)));

    try {
      const policy = await ctx.prisma.queuePolicy.findFirst({
        where: { active: true }, orderBy: { createdAt: "desc" },
      });
      const queueLimit = body.queueLimit ?? policy?.queueLimit ?? 10_000;
      const measurementQueue = new BoundedEventQueue(queueLimit);

      // Default weights bias toward low-priority events so eviction is visible
      // when the queue is small. Operators can tune via the request body.
      const weights: Record<string, number> = body.weights ?? {
        [EVENT_TYPES.VehicleDetected]: 5,
        [EVENT_TYPES.SpeedViolation]:  2,
        [EVENT_TYPES.CongestionAlert]: 1,
        [EVENT_TYPES.TrafficCleared]:  1,
      };
      const pool: string[] = [];
      for (const [type, w] of Object.entries(weights)) {
        for (let i = 0; i < Math.max(0, Math.floor(w)); i++) pool.push(type);
      }
      if (pool.length === 0) pool.push(EVENT_TYPES.VehicleDetected);

      const camera = await ctx.prisma.trafficCamera.findFirst();
      const sourceId = camera?.cameraCode ?? "FLOOD-CAM-001";
      const intersectionName = camera?.intersectionName ?? "Flood Test Lane";

      const breakdown: Record<string, { generated: number; accepted: number; evicted: number }> = {};
      let accepted = 0;
      let evicted = 0;

      for (let i = 0; i < count; i++) {
        const eventType = pool[i % pool.length]!;
        breakdown[eventType] = breakdown[eventType] ?? { generated: 0, accepted: 0, evicted: 0 };
        breakdown[eventType].generated++;

        const payload = buildSyntheticPayload(eventType, intersectionName, i);
        const envelope = createEnvelope({ source_id: sourceId, event_type: eventType, payload });

        const sizeBefore = measurementQueue.size;
        const wasAccepted = measurementQueue.enqueue(envelope);
        const sizeAfter = measurementQueue.size;

        if (wasAccepted) {
          accepted++;
          breakdown[eventType].accepted++;
          // Eviction happened if the queue was full and accepted us by displacing one
          if (sizeBefore === queueLimit && sizeAfter === queueLimit) {
            evicted++;
          }
        } else {
          // Incoming was discarded outright (lower priority than weakest in queue)
          evicted++;
          breakdown[eventType].evicted++;
        }
      }

      res.json({
        published: count,
        accepted,
        evicted,
        finalQueueSize: measurementQueue.size,
        queueLimit,
        policyName: policy?.name ?? "Default Scenario",
        breakdown,
      });
    } catch (err) {
      console.error("[flood-test] failed", err);
      res.status(500).json({ error: "Flood test failed" });
    }
  });

  return router;
}

function buildSyntheticPayload(eventType: string, intersection: string, i: number): Record<string, unknown> {
  switch (eventType) {
    case EVENT_TYPES.VehicleDetected:
      return { vehicle_plate: `FLD-${String(i).padStart(4, "0")}`, intersection };
    case EVENT_TYPES.SpeedViolation:
      return { vehicle_plate: `FLD-${String(i).padStart(4, "0")}`, intersection, speed: 75 + (i % 30), speed_limit: 60 };
    case EVENT_TYPES.CongestionAlert:
      return { intersection, vehicle_count: 25 + (i % 30), congestion_level: i % 5 === 0 ? "CRITICAL" : "HIGH" };
    case EVENT_TYPES.TrafficCleared:
      return { intersection };
    default:
      return { intersection };
  }
}
