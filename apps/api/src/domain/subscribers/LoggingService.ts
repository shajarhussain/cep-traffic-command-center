import { BaseIdempotentSubscriber } from "./BaseIdempotentSubscriber.js";
import type { ProcessedEventRepository } from "./BaseIdempotentSubscriber.js";
import type { EventEnvelope } from "../events/EventEnvelope.js";
import { EVENT_TYPES } from "../events/EventTypes.js";

/**
 * Audit log record created by LoggingService.
 * In Phase 4, this is persisted to the AuditLog database table.
 */
export interface AuditLogRecord {
  id: string;
  event_id: string;
  event_type: string;
  message: string;
  payload_snapshot: string;
  created_at: string;
}

/**
 * Repository interface for audit log storage.
 * Phase 3 uses an in-memory implementation. Phase 4 replaces with Prisma.
 */
export interface AuditLogRepository {
  create(log: AuditLogRecord): Promise<void>;
  findAll(): Promise<AuditLogRecord[]>;
}

/**
 * LoggingService — Concrete subscriber for SpeedViolationEvent and CongestionAlertEvent
 *
 * Writes audit logs for important events. Extends BaseIdempotentSubscriber
 * so the same event is not logged twice.
 */
export class LoggingService extends BaseIdempotentSubscriber {
  readonly name = "LoggingService";
  readonly supportedEventTypes = [
    EVENT_TYPES.SpeedViolation,
    EVENT_TYPES.CongestionAlert,
  ];

  constructor(
    processedRepo: ProcessedEventRepository,
    private readonly auditLogRepo: AuditLogRepository
  ) {
    super(processedRepo);
  }

  protected async process(envelope: EventEnvelope): Promise<void> {
    const log: AuditLogRecord = {
      id: crypto.randomUUID(),
      event_id: envelope.event_id,
      event_type: envelope.event_type,
      message: `[${envelope.event_type}] from ${envelope.source_id} at ${envelope.timestamp}`,
      payload_snapshot: JSON.stringify(envelope.payload),
      created_at: new Date().toISOString(),
    };

    await this.auditLogRepo.create(log);
  }
}
