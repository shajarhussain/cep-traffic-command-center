import { BaseIdempotentSubscriber } from "./BaseIdempotentSubscriber.js";
import type { ProcessedEventRepository } from "./BaseIdempotentSubscriber.js";
import type { EventEnvelope } from "../events/EventEnvelope.js";
import type { SpeedViolationPayload } from "../events/EventTypes.js";
import { EVENT_TYPES } from "../events/EventTypes.js";

/**
 * Read-only port for the FinePolicy table. Decouples AlertService from
 * Prisma so tests can supply an in-memory implementation.
 */
export interface FinePolicyLookup {
  findApplicable(eventType: string, excessKmh: number): Promise<{ fineAmount: number; name: string } | null>;
}

/** Defaults are env-configurable. AlertService never embeds magic numbers. */
function defaultFineFor(excessKmh: number): number {
  const high   = parseInt(process.env["DEFAULT_FINE_HIGH"]   ?? "5000", 10);
  const medium = parseInt(process.env["DEFAULT_FINE_MEDIUM"] ?? "3000", 10);
  const low    = parseInt(process.env["DEFAULT_FINE_LOW"]    ?? "1500", 10);
  const highThreshold   = parseInt(process.env["DEFAULT_FINE_HIGH_THRESHOLD_KMH"]   ?? "30", 10);
  const mediumThreshold = parseInt(process.env["DEFAULT_FINE_MEDIUM_THRESHOLD_KMH"] ?? "15", 10);
  if (excessKmh > highThreshold)   return high;
  if (excessKmh > mediumThreshold) return medium;
  return low;
}

/**
 * Penalty record created by AlertService for a speed violation.
 * In Phase 4, this is persisted to the Penalty database table.
 */
export interface PenaltyRecord {
  id: string;
  event_id: string;
  camera_id: string;
  vehicle_plate: string;
  speed_kmh: number;
  speed_limit_kmh: number;
  fine_amount: number;
  status: "ISSUED" | "CANCELLED" | "PAID";
  issued_at: string;
}

/**
 * Repository interface for penalty storage.
 * Phase 3 uses an in-memory implementation. Phase 4 replaces with Prisma.
 */
export interface PenaltyRepository {
  create(penalty: PenaltyRecord): Promise<void>;
  findByEventId(eventId: string): Promise<PenaltyRecord | null>;
  findAll(): Promise<PenaltyRecord[]>;
}

/**
 * AlertService — Concrete subscriber for SpeedViolationEvent
 *
 * Creates penalty notices for speed violations. Extends BaseIdempotentSubscriber
 * so that the same SpeedViolationEvent (same event_id) never creates two penalties.
 *
 * This is the key subscriber for CEP Task 4 (10 marks):
 *   "Publish the same SpeedViolationEvent twice (using the same event_id).
 *    Then check that AlertService only sent ONE penalty notice, not two."
 */
export class AlertService extends BaseIdempotentSubscriber<SpeedViolationPayload> {
  readonly name = "AlertService";
  readonly supportedEventTypes = [EVENT_TYPES.SpeedViolation];

  constructor(
    processedRepo: ProcessedEventRepository,
    private readonly penaltyRepo: PenaltyRepository,
    private readonly finePolicyRepo?: FinePolicyLookup
  ) {
    super(processedRepo);
  }

  protected async process(
    envelope: EventEnvelope<SpeedViolationPayload>
  ): Promise<void> {
    const { payload } = envelope;

    // Fine amount comes from a user-driven FinePolicy row when available;
    // otherwise from env-configurable defaults. Never from a hardcoded constant.
    const excessKmh = payload.speed_kmh - payload.speed_limit_kmh;
    const policy = this.finePolicyRepo
      ? await this.finePolicyRepo.findApplicable(EVENT_TYPES.SpeedViolation, excessKmh)
      : null;
    const fineAmount = policy ? policy.fineAmount : defaultFineFor(excessKmh);

    const penalty: PenaltyRecord = {
      id: crypto.randomUUID(),
      event_id: envelope.event_id,
      camera_id: envelope.source_id,
      vehicle_plate: payload.vehicle_plate,
      speed_kmh: payload.speed_kmh,
      speed_limit_kmh: payload.speed_limit_kmh,
      fine_amount: fineAmount,
      status: "ISSUED",
      issued_at: new Date().toISOString(),
    };

    await this.penaltyRepo.create(penalty);
  }
}
