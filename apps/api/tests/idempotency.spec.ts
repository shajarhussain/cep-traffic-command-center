import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../src/domain/bus/EventBus.js";
import { createEnvelope } from "../src/domain/events/createEnvelope.js";
import { EVENT_TYPES } from "../src/domain/events/EventTypes.js";
import type { SpeedViolationPayload } from "../src/domain/events/EventTypes.js";
import { AlertService } from "../src/domain/subscribers/AlertService.js";
import type { PenaltyRecord, PenaltyRepository } from "../src/domain/subscribers/AlertService.js";
import { LoggingService } from "../src/domain/subscribers/LoggingService.js";
import type { AuditLogRecord, AuditLogRepository } from "../src/domain/subscribers/LoggingService.js";
import { ReportingService } from "../src/domain/subscribers/ReportingService.js";
import type { ReportRepository } from "../src/domain/subscribers/ReportingService.js";
import type { ProcessedEventRepository } from "../src/domain/subscribers/BaseIdempotentSubscriber.js";
import { bootstrapSubscribers } from "../src/application/bootstrapSubscribers.js";

// ─── In-Memory Repository Stubs ────────────────────────────────
// These are test-only stubs. Real Prisma implementations come in Phase 4.

class InMemoryProcessedEventRepo implements ProcessedEventRepository {
  private store = new Set<string>();

  async exists(eventId: string, subscriberName: string): Promise<boolean> {
    return this.store.has(`${eventId}::${subscriberName}`);
  }

  async markProcessed(eventId: string, subscriberName: string): Promise<void> {
    this.store.add(`${eventId}::${subscriberName}`);
  }

  get size(): number {
    return this.store.size;
  }
}

class InMemoryPenaltyRepo implements PenaltyRepository {
  public penalties: PenaltyRecord[] = [];

  async create(penalty: PenaltyRecord): Promise<void> {
    this.penalties.push(penalty);
  }

  async findByEventId(eventId: string): Promise<PenaltyRecord | null> {
    return this.penalties.find((p) => p.event_id === eventId) ?? null;
  }

  async findAll(): Promise<PenaltyRecord[]> {
    return this.penalties;
  }
}

class InMemoryAuditLogRepo implements AuditLogRepository {
  public logs: AuditLogRecord[] = [];

  async create(log: AuditLogRecord): Promise<void> {
    this.logs.push(log);
  }

  async findAll(): Promise<AuditLogRecord[]> {
    return this.logs;
  }
}

class InMemoryReportRepo implements ReportRepository {
  public counts = new Map<string, number>();

  async incrementCount(eventType: string, cameraId: string): Promise<void> {
    const key = `${eventType}::${cameraId}`;
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  async findAll(): Promise<{ id: string; event_type: string; camera_id: string | null; count: number; window_start: string; window_end: string }[]> {
    return [];
  }
}

// ─── Test Data ──────────────────────────────────────────────────

const FIXED_EVENT_ID = "duplicate-test-event-id-12345";

function createSpeedViolationEnvelope(eventId?: string) {
  return createEnvelope<SpeedViolationPayload>({
    source_id: "CAM-ISB-001",
    event_type: EVENT_TYPES.SpeedViolation,
    payload: {
      vehicle_plate: "ABC-123",
      speed_kmh: 92,
      speed_limit_kmh: 60,
      intersection_name: "Jinnah Avenue",
    },
    event_id: eventId,
  });
}

// ─── Tests ──────────────────────────────────────────────────────

describe("Idempotent Receiver Pattern (Task 4 — 10 marks)", () => {
  let bus: EventBus;
  let processedRepo: InMemoryProcessedEventRepo;
  let penaltyRepo: InMemoryPenaltyRepo;
  let auditLogRepo: InMemoryAuditLogRepo;
  let reportRepo: InMemoryReportRepo;
  let alertService: AlertService;
  let loggingService: LoggingService;
  let reportingService: ReportingService;

  beforeEach(() => {
    bus = new EventBus();
    processedRepo = new InMemoryProcessedEventRepo();
    penaltyRepo = new InMemoryPenaltyRepo();
    auditLogRepo = new InMemoryAuditLogRepo();
    reportRepo = new InMemoryReportRepo();

    alertService = new AlertService(processedRepo, penaltyRepo);
    loggingService = new LoggingService(processedRepo, auditLogRepo);
    reportingService = new ReportingService(processedRepo, reportRepo);

    // Wire subscribers to bus using bootstrapSubscribers
    bootstrapSubscribers(bus, [alertService, loggingService, reportingService]);
  });

  // ── THE KEY CEP TEST (Task 4, 10 marks) ──────────────────────
  it("same SpeedViolationEvent published twice creates only ONE penalty", async () => {
    const envelope = createSpeedViolationEnvelope(FIXED_EVENT_ID);

    // Publish the same envelope TWICE with the same event_id
    await bus.publish(envelope);
    await bus.publish(envelope);

    // AlertService must create exactly ONE penalty, not two
    expect(penaltyRepo.penalties).toHaveLength(1);
    expect(penaltyRepo.penalties[0].event_id).toBe(FIXED_EVENT_ID);
    expect(penaltyRepo.penalties[0].vehicle_plate).toBe("ABC-123");
  });

  it("AlertService tracks the duplicate as ignored", async () => {
    const envelope = createSpeedViolationEnvelope(FIXED_EVENT_ID);

    await bus.publish(envelope);
    await bus.publish(envelope);

    expect(alertService.duplicateIgnoredCount).toBe(1);
  });

  it("duplicate is tracked per subscriber independently", async () => {
    const envelope = createSpeedViolationEnvelope(FIXED_EVENT_ID);

    // Publish twice
    await bus.publish(envelope);
    await bus.publish(envelope);

    // AlertService: 1 penalty, 1 duplicate ignored
    expect(penaltyRepo.penalties).toHaveLength(1);
    expect(alertService.duplicateIgnoredCount).toBe(1);

    // LoggingService: 1 audit log, 1 duplicate ignored
    expect(auditLogRepo.logs).toHaveLength(1);
    expect(loggingService.duplicateIgnoredCount).toBe(1);

    // ReportingService: count incremented once, 1 duplicate ignored
    const key = `${EVENT_TYPES.SpeedViolation}::CAM-ISB-001`;
    expect(reportRepo.counts.get(key)).toBe(1);
    expect(reportingService.duplicateIgnoredCount).toBe(1);
  });

  it("two different SpeedViolationEvents create two separate penalties", async () => {
    // Different event_ids → different events → different penalties
    const envelope1 = createSpeedViolationEnvelope(); // auto-generated UUID
    const envelope2 = createSpeedViolationEnvelope(); // different auto-generated UUID

    await bus.publish(envelope1);
    await bus.publish(envelope2);

    expect(penaltyRepo.penalties).toHaveLength(2);
    expect(penaltyRepo.penalties[0].event_id).not.toBe(
      penaltyRepo.penalties[1].event_id
    );
  });

  it("ProcessedEvent stores one entry per event_id + subscriber pair", async () => {
    const envelope = createSpeedViolationEnvelope(FIXED_EVENT_ID);

    await bus.publish(envelope);

    // 3 subscribers processed the event: Alert, Logging, Reporting
    expect(processedRepo.size).toBe(3);

    // Publish again — no new entries should be added
    await bus.publish(envelope);
    expect(processedRepo.size).toBe(3);
  });

  it("AlertService calculates fine based on excess speed", async () => {
    // Speed 92 in a 60 zone → excess 32 → fine 5000 (excess > 30)
    const envelope = createSpeedViolationEnvelope();
    await bus.publish(envelope);

    expect(penaltyRepo.penalties[0].fine_amount).toBe(5000);
  });

  it("penalty status is ISSUED on creation", async () => {
    const envelope = createSpeedViolationEnvelope();
    await bus.publish(envelope);

    expect(penaltyRepo.penalties[0].status).toBe("ISSUED");
  });

  it("LoggingService creates audit log with event details", async () => {
    const envelope = createSpeedViolationEnvelope();
    await bus.publish(envelope);

    expect(auditLogRepo.logs).toHaveLength(1);
    expect(auditLogRepo.logs[0].event_type).toBe(EVENT_TYPES.SpeedViolation);
    expect(auditLogRepo.logs[0].event_id).toBe(envelope.event_id);
    expect(auditLogRepo.logs[0].payload_snapshot).toContain("ABC-123");
  });

  it("ReportingService increments count for the event type", async () => {
    const envelope = createSpeedViolationEnvelope();
    await bus.publish(envelope);

    const key = `${EVENT_TYPES.SpeedViolation}::CAM-ISB-001`;
    expect(reportRepo.counts.get(key)).toBe(1);
  });

  it("subscriber routing matches CEP event-type table", async () => {
    // SpeedViolation → Alert, Logging, Reporting (all wired above)
    expect(alertService.supportedEventTypes).toEqual([EVENT_TYPES.SpeedViolation]);
    expect(loggingService.supportedEventTypes).toEqual([
      EVENT_TYPES.SpeedViolation,
      EVENT_TYPES.CongestionAlert,
    ]);
    expect(reportingService.supportedEventTypes).toEqual([
      EVENT_TYPES.VehicleDetected,
      EVENT_TYPES.SpeedViolation,
    ]);
  });
});
