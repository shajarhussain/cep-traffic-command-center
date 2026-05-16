import { createEnvelope } from "../domain/events/createEnvelope.js";
import { EVENT_TYPES } from "../domain/events/EventTypes.js";
import type { EventBus } from "../domain/bus/EventBus.js";
import type { PrismaEventRepository } from "../infrastructure/repositories/EventRepository.js";
import type { PrismaOutboxRepository } from "../infrastructure/repositories/OutboxRepository.js";
import type { EventEnvelope } from "../domain/events/EventEnvelope.js";
import type { PrismaClient } from "@prisma/client";

const VALID_TYPES = new Set(Object.values(EVENT_TYPES));

interface PublishInput {
  source_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  correlation_id?: string;
  event_id?: string;
}

/**
 * PublishEventUseCase — Outbox-backed publish flow (CLO 4 Scenario 3).
 *
 * 1. Validate input and normalize payload.
 * 2. In a single Prisma transaction, write the envelope to EventEnvelopeRecord
 *    AND enqueue it in EventOutbox (PENDING). Either both writes commit or
 *    neither does — this defeats the Dual Write Problem.
 * 3. Attempt eager bus delivery. On success, mark the outbox row PUBLISHED.
 *    On failure, leave it PENDING; the OutboxRelay background worker will
 *    retry on its next tick.
 */
export class PublishEventUseCase {
  constructor(
    private readonly bus: EventBus,
    private readonly eventRepo: PrismaEventRepository,
    private readonly outboxRepo: PrismaOutboxRepository,
    private readonly prisma: PrismaClient
  ) {}

  async execute(input: PublishInput): Promise<{ envelope: EventEnvelope; summary: string }> {
    // --- Validation ---
    if (!input.source_id) throw new ValidationError("source_id is required");
    if (!input.event_type) throw new ValidationError("event_type is required");
    if (!VALID_TYPES.has(input.event_type as any)) {
      throw new ValidationError(`Unknown event_type: ${input.event_type}. Valid: ${[...VALID_TYPES].join(", ")}`);
    }
    const domainPayload = this.validateAndMapPayload(input.event_type, input.payload);

    // --- Create envelope ---
    const envelope = createEnvelope({
      source_id: input.source_id,
      event_type: input.event_type,
      payload: domainPayload,
      correlation_id: input.correlation_id,
      event_id: input.event_id,
    });

    // --- Transactional dual-write: event store + outbox in one atomic step ---
    await this.prisma.$transaction(async (tx) => {
      await this.eventRepo.save(envelope, "NORMAL", tx as unknown as PrismaClient);
      await this.outboxRepo.enqueue(envelope, tx as unknown as PrismaClient);
    });

    // --- Eager dispatch: try synchronous delivery for low-latency happy path.
    //     On failure the row stays PENDING (with incremented attemptCount)
    //     and OutboxRelay retries it on the next tick. ---
    const eagerMaxAttempts = parseInt(process.env["OUTBOX_RELAY_MAX_ATTEMPTS"] ?? "5", 10);
    let dispatchedInline = false;
    try {
      await this.bus.publish(envelope);
      await this.outboxRepo.markPublished(envelope.event_id);
      dispatchedInline = true;
    } catch (err) {
      // Record the failure so attemptCount + lastError reflect reality.
      // The row stays PENDING (until attemptCount hits the cap), so the
      // background relay will retry it. The transactional write means the
      // event is already durable — the dual-write problem cannot lose it.
      await this.outboxRepo.recordFailure(
        envelope.event_id,
        err instanceof Error ? err.message : String(err),
        eagerMaxAttempts
      );
    }

    return {
      envelope,
      summary: `Published ${input.event_type} from ${input.source_id}${dispatchedInline ? "" : " (queued for retry via outbox)"}`,
    };
  }

  /**
   * Normalizes legacy payload keys to the canonical domain keys.
   * Accepts both old format (speed_kmh, speed_limit_kmh, intersection_name)
   * and new format (speed, speed_limit, intersection).
   */
  private normalizePayload(p: Record<string, unknown>): Record<string, unknown> {
    const normalized = { ...p };

    // intersection_name → intersection
    if (!normalized["intersection"] && normalized["intersection_name"]) {
      normalized["intersection"] = normalized["intersection_name"];
    }
    // speed_kmh → speed
    if (normalized["speed"] == null && normalized["speed_kmh"] != null) {
      normalized["speed"] = normalized["speed_kmh"];
    }
    // speed_limit_kmh → speed_limit
    if (normalized["speed_limit"] == null && normalized["speed_limit_kmh"] != null) {
      normalized["speed_limit"] = normalized["speed_limit_kmh"];
    }

    return normalized;
  }

  private validateAndMapPayload(eventType: string, raw: Record<string, unknown>): Record<string, unknown> {
    const p = this.normalizePayload(raw);

    switch (eventType) {
      case EVENT_TYPES.VehicleDetected:
        if (!p["vehicle_plate"]) throw new ValidationError("vehicle_plate required");
        if (!p["intersection"]) throw new ValidationError("intersection required");
        return { vehicle_plate: p["vehicle_plate"], intersection_name: p["intersection"], lane_number: p["lane_number"] };
      case EVENT_TYPES.SpeedViolation:
        if (!p["vehicle_plate"]) throw new ValidationError("vehicle_plate required");
        if (!p["intersection"]) throw new ValidationError("intersection required");
        if (p["speed"] == null) throw new ValidationError("speed required");
        if (p["speed_limit"] == null) throw new ValidationError("speed_limit required");
        return { vehicle_plate: p["vehicle_plate"], intersection_name: p["intersection"], speed_kmh: Number(p["speed"]), speed_limit_kmh: Number(p["speed_limit"]) };
      case EVENT_TYPES.CongestionAlert:
        if (!p["intersection"]) throw new ValidationError("intersection required");
        if (p["vehicle_count"] == null) throw new ValidationError("vehicle_count required");
        if (!p["congestion_level"]) throw new ValidationError("congestion_level required");
        return { intersection_name: p["intersection"], vehicle_count: Number(p["vehicle_count"]), congestion_level: p["congestion_level"] };
      case EVENT_TYPES.TrafficCleared:
        if (!p["intersection"]) throw new ValidationError("intersection required");
        return { intersection_name: p["intersection"], cleared_at: p["cleared_at"] ?? new Date().toISOString() };
      default:
        return p;
    }
  }
}

export class ValidationError extends Error {
  constructor(message: string) { super(message); this.name = "ValidationError"; }
}
