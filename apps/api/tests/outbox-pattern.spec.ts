import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { createSystemContext, type SystemContext } from "../src/application/systemContext.js";
import type { IEventSubscriber } from "../src/domain/subscribers/IEventSubscriber.js";
import { EVENT_TYPES } from "../src/domain/events/EventTypes.js";

/**
 * Outbox Pattern (CLO 4 Scenario 3, 10 marks)
 *
 * Verifies the full transactional-outbox loss-prevention guarantee:
 *  1. PublishEventUseCase writes the envelope and the outbox row atomically.
 *  2. If a subscriber crashes during inline dispatch, the row stays PENDING.
 *  3. The OutboxRelay.tick() re-dispatches PENDING rows to the bus.
 *  4. Successful relay marks the row PUBLISHED.
 *  5. Idempotency still holds when the same envelope is dispatched twice.
 */

let prisma: PrismaClient;
let ctx: SystemContext;

beforeAll(() => { prisma = getTestPrisma(); });

beforeEach(async () => {
  await cleanTestDb(prisma);
  await prisma.trafficCamera.upsert({
    where: { cameraCode: "CAM-OB-001" },
    update: {}, create: { cameraCode: "CAM-OB-001", intersectionName: "Outbox Lane", speedLimitKmh: 60, status: "ACTIVE" },
  });
  ctx = createSystemContext(prisma);
});

afterAll(async () => { await cleanTestDb(prisma); await disconnectTestPrisma(); });

class ThrowingSubscriber implements IEventSubscriber {
  readonly name = "ThrowingSubscriber";
  readonly supportedEventTypes = [EVENT_TYPES.SpeedViolation];
  async handle(): Promise<void> { throw new Error("Simulated subscriber crash"); }
}

describe("Outbox Pattern — transactional dual-write + retry", () => {
  it("publish writes both EventEnvelopeRecord and EventOutbox atomically", async () => {
    const before = await prisma.eventOutbox.count();
    await ctx.publishUseCase.execute({
      source_id: "CAM-OB-001",
      event_type: "SpeedViolationEvent",
      payload: { vehicle_plate: "OB-001", intersection: "Outbox Lane", speed: 90, speed_limit: 60 },
    });
    const eventRows = await prisma.eventEnvelopeRecord.count();
    const outboxRows = await prisma.eventOutbox.count();
    expect(eventRows).toBe(1);
    expect(outboxRows).toBe(before + 1);
  });

  it("happy path: eager dispatch marks the outbox row PUBLISHED", async () => {
    const { envelope } = await ctx.publishUseCase.execute({
      source_id: "CAM-OB-001",
      event_type: "SpeedViolationEvent",
      payload: { vehicle_plate: "OB-002", intersection: "Outbox Lane", speed: 95, speed_limit: 60 },
    });
    const row = await prisma.eventOutbox.findUnique({ where: { eventId: envelope.event_id } });
    expect(row?.status).toBe("PUBLISHED");
    expect(row?.publishedAt).not.toBeNull();
  });

  it("crash path: a throwing subscriber leaves the row PENDING for retry", async () => {
    // Replace SpeedViolation subscribers with a guaranteed-throwing one.
    ctx.eventBus.unsubscribe(EVENT_TYPES.SpeedViolation, ctx.alertService);
    ctx.eventBus.unsubscribe(EVENT_TYPES.SpeedViolation, ctx.loggingService);
    ctx.eventBus.unsubscribe(EVENT_TYPES.SpeedViolation, ctx.reportingService);
    ctx.eventBus.unsubscribe(EVENT_TYPES.SpeedViolation, ctx.incidentService);
    const throwing = new ThrowingSubscriber();
    ctx.eventBus.subscribe(EVENT_TYPES.SpeedViolation, throwing);

    const { envelope } = await ctx.publishUseCase.execute({
      source_id: "CAM-OB-001",
      event_type: "SpeedViolationEvent",
      payload: { vehicle_plate: "OB-003", intersection: "Outbox Lane", speed: 100, speed_limit: 60 },
    });

    const row = await prisma.eventOutbox.findUnique({ where: { eventId: envelope.event_id } });
    expect(row?.status).toBe("PENDING");
    expect(row?.attemptCount).toBeGreaterThanOrEqual(1);
    expect(row?.lastError ?? "").toContain("Simulated subscriber crash");
  });

  it("relay retries a PENDING row and marks it PUBLISHED once subscribers recover", async () => {
    // Subscribe a throwing handler first.
    ctx.eventBus.unsubscribe(EVENT_TYPES.SpeedViolation, ctx.alertService);
    const throwing = new ThrowingSubscriber();
    ctx.eventBus.subscribe(EVENT_TYPES.SpeedViolation, throwing);

    const { envelope } = await ctx.publishUseCase.execute({
      source_id: "CAM-OB-001",
      event_type: "SpeedViolationEvent",
      payload: { vehicle_plate: "OB-004", intersection: "Outbox Lane", speed: 110, speed_limit: 60 },
    });

    let row = await prisma.eventOutbox.findUnique({ where: { eventId: envelope.event_id } });
    expect(row?.status).toBe("PENDING");

    // Swap to a healthy subscriber set, then tick the relay.
    ctx.eventBus.unsubscribe(EVENT_TYPES.SpeedViolation, throwing);
    ctx.eventBus.subscribe(EVENT_TYPES.SpeedViolation, ctx.alertService);

    const result = await ctx.outboxRelay.tick();
    expect(result.published).toBeGreaterThanOrEqual(1);

    row = await prisma.eventOutbox.findUnique({ where: { eventId: envelope.event_id } });
    expect(row?.status).toBe("PUBLISHED");
  });

  it("relay-driven dispatch still respects per-subscriber idempotency", async () => {
    // Use the same event_id twice through the outbox. Penalty must remain 1.
    const sharedId = "outbox-dup-event-id-001";
    await ctx.publishUseCase.execute({
      source_id: "CAM-OB-001",
      event_type: "SpeedViolationEvent",
      payload: { vehicle_plate: "OB-005", intersection: "Outbox Lane", speed: 92, speed_limit: 60 },
      event_id: sharedId,
    });
    // A second publish with the same event_id will fail the unique constraint on EventEnvelopeRecord;
    // but to test idempotency end-to-end we manually push a duplicate envelope through the bus via the relay.
    // Use the existing outbox row by re-issuing it through replay.
    const row = await prisma.eventOutbox.findUnique({ where: { eventId: sharedId } });
    expect(row).not.toBeNull();

    // Replay the same row a second time — AlertService should ignore the duplicate.
    await ctx.outboxRepo.resetToPending(sharedId);
    await ctx.outboxRelay.tick();

    const penalties = await prisma.penalty.findMany({ where: { eventId: sharedId } });
    expect(penalties).toHaveLength(1);
  });
});
