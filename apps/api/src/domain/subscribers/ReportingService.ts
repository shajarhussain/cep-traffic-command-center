import { BaseIdempotentSubscriber } from "./BaseIdempotentSubscriber.js";
import type { ProcessedEventRepository } from "./BaseIdempotentSubscriber.js";
import type { EventEnvelope } from "../events/EventEnvelope.js";
import { EVENT_TYPES } from "../events/EventTypes.js";

/**
 * Report aggregate record updated by ReportingService.
 * In Phase 4, this is persisted to the ReportAggregate database table.
 */
export interface ReportAggregateRecord {
  id: string;
  event_type: string;
  camera_id: string | null;
  count: number;
  window_start: string;
  window_end: string;
}

/**
 * Repository interface for report aggregate storage.
 * Phase 3 uses an in-memory implementation. Phase 4 replaces with Prisma.
 */
export interface ReportRepository {
  incrementCount(eventType: string, cameraId: string): Promise<void>;
  findAll(): Promise<ReportAggregateRecord[]>;
}

/**
 * ReportingService — Concrete subscriber for VehicleDetected and SpeedViolation
 *
 * Aggregates historical event counts for reporting. Extends BaseIdempotentSubscriber
 * so the same event does not inflate report counts.
 */
export class ReportingService extends BaseIdempotentSubscriber {
  readonly name = "ReportingService";
  readonly supportedEventTypes = [
    EVENT_TYPES.VehicleDetected,
    EVENT_TYPES.SpeedViolation,
  ];

  constructor(
    processedRepo: ProcessedEventRepository,
    private readonly reportRepo: ReportRepository
  ) {
    super(processedRepo);
  }

  protected async process(envelope: EventEnvelope): Promise<void> {
    await this.reportRepo.incrementCount(
      envelope.event_type,
      envelope.source_id
    );
  }
}
