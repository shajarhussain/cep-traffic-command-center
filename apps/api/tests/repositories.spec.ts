import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { PrismaProcessedEventRepository } from "../src/infrastructure/repositories/ProcessedEventRepository.js";
import { PrismaPenaltyRepository } from "../src/infrastructure/repositories/PenaltyRepository.js";
import { PrismaEventRepository } from "../src/infrastructure/repositories/EventRepository.js";
import { createEnvelope } from "../src/domain/events/createEnvelope.js";
import { EVENT_TYPES } from "../src/domain/events/EventTypes.js";
import type { SpeedViolationPayload } from "../src/domain/events/EventTypes.js";
import type { PenaltyRecord } from "../src/domain/subscribers/AlertService.js";

/**
 * Repository Integration Tests — Phase 4 Verification
 *
 * These tests hit a real SQLite database (test.db) to prove:
 *   - ProcessedEvent @@unique([eventId, subscriberName]) works correctly
 *   - Penalty @unique(eventId) prevents duplicate penalties
 *   - EventEnvelopeRecord stores all 7 CEP fields
 */

let prisma: PrismaClient;
let processedRepo: PrismaProcessedEventRepository;
let penaltyRepo: PrismaPenaltyRepository;
let eventRepo: PrismaEventRepository;

beforeAll(() => {
  prisma = getTestPrisma();
  processedRepo = new PrismaProcessedEventRepository(prisma);
  penaltyRepo = new PrismaPenaltyRepository(prisma);
  eventRepo = new PrismaEventRepository(prisma);
});

beforeEach(async () => {
  await cleanTestDb(prisma);
});

afterAll(async () => {
  await cleanTestDb(prisma);
  await disconnectTestPrisma();
});

// ─── ProcessedEventRepository Tests ────────────────────────────

describe("PrismaProcessedEventRepository", () => {
  it("exists() returns false before marking", async () => {
    const result = await processedRepo.exists("evt-001", "AlertService");
    expect(result).toBe(false);
  });

  it("markProcessed() stores the entry, then exists() returns true", async () => {
    await processedRepo.markProcessed("evt-001", "AlertService");
    const result = await processedRepo.exists("evt-001", "AlertService");
    expect(result).toBe(true);
  });

  it("same eventId is allowed for different subscribers", async () => {
    // Same event processed by two different subscribers — both should succeed
    await processedRepo.markProcessed("evt-001", "AlertService");
    await processedRepo.markProcessed("evt-001", "LoggingService");

    expect(await processedRepo.exists("evt-001", "AlertService")).toBe(true);
    expect(await processedRepo.exists("evt-001", "LoggingService")).toBe(true);
  });

  it("same eventId + subscriberName is rejected as duplicate", async () => {
    await processedRepo.markProcessed("evt-001", "AlertService");

    // Attempting to mark the same combo again should throw (unique constraint)
    await expect(
      processedRepo.markProcessed("evt-001", "AlertService")
    ).rejects.toThrow();
  });

  it("different eventIds for the same subscriber are allowed", async () => {
    await processedRepo.markProcessed("evt-001", "AlertService");
    await processedRepo.markProcessed("evt-002", "AlertService");

    expect(await processedRepo.exists("evt-001", "AlertService")).toBe(true);
    expect(await processedRepo.exists("evt-002", "AlertService")).toBe(true);
  });

  it("exists() returns false for a subscriber that did not process the event", async () => {
    await processedRepo.markProcessed("evt-001", "AlertService");
    // ReportingService never processed evt-001
    expect(await processedRepo.exists("evt-001", "ReportingService")).toBe(false);
  });
});

// ─── PenaltyRepository Tests ───────────────────────────────────

describe("PrismaPenaltyRepository", () => {
  function makePenalty(eventId: string): PenaltyRecord {
    return {
      id: crypto.randomUUID(),
      event_id: eventId,
      camera_id: "CAM-ISB-001",
      vehicle_plate: "ABC-123",
      speed_kmh: 92,
      speed_limit_kmh: 60,
      fine_amount: 5000,
      status: "ISSUED",
      issued_at: new Date().toISOString(),
    };
  }

  it("creating a penalty stores it in the database", async () => {
    const penalty = makePenalty("evt-speed-001");
    await penaltyRepo.create(penalty);

    const found = await penaltyRepo.findByEventId("evt-speed-001");
    expect(found).not.toBeNull();
    expect(found!.vehicle_plate).toBe("ABC-123");
    expect(found!.fine_amount).toBe(5000);
  });

  it("creating a duplicate penalty for the same eventId is rejected", async () => {
    const penalty1 = makePenalty("evt-speed-dup");
    await penaltyRepo.create(penalty1);

    const penalty2 = makePenalty("evt-speed-dup");
    await expect(penaltyRepo.create(penalty2)).rejects.toThrow();
  });

  it("findAll() lists the created penalty", async () => {
    await penaltyRepo.create(makePenalty("evt-001"));
    await penaltyRepo.create(makePenalty("evt-002"));

    const all = await penaltyRepo.findAll();
    expect(all).toHaveLength(2);
  });

  it("count() returns the correct number of penalties", async () => {
    await penaltyRepo.create(makePenalty("evt-001"));
    expect(await penaltyRepo.count()).toBe(1);
  });
});

// ─── EventRepository Tests ─────────────────────────────────────

describe("PrismaEventRepository", () => {
  it("stores an envelope with all 7 CEP fields and retrieves it", async () => {
    const envelope = createEnvelope<SpeedViolationPayload>({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.SpeedViolation,
      payload: {
        vehicle_plate: "XYZ-789",
        speed_kmh: 85,
        speed_limit_kmh: 60,
        intersection_name: "Blue Area",
      },
    });

    await eventRepo.save(envelope);
    const retrieved = await eventRepo.findById(envelope.event_id);

    expect(retrieved).not.toBeNull();
    expect(retrieved!.event_id).toBe(envelope.event_id);
    expect(retrieved!.correlation_id).toBe(envelope.correlation_id);
    expect(retrieved!.schema_version).toBe(envelope.schema_version);
    expect(retrieved!.source_id).toBe(envelope.source_id);
    expect(retrieved!.event_type).toBe(envelope.event_type);
    expect(retrieved!.payload).toEqual(envelope.payload);
    // timestamp is stored as DateTime, so ISO strings should match
    expect(new Date(retrieved!.timestamp).getTime()).toBeCloseTo(
      new Date(envelope.timestamp).getTime(),
      -3
    );
  });

  it("findAll() returns all stored envelopes", async () => {
    const e1 = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "A-1", intersection_name: "F-8" },
    });
    const e2 = createEnvelope({
      source_id: "CAM-ISB-002",
      event_type: EVENT_TYPES.CongestionAlert,
      payload: {
        intersection_name: "Blue Area",
        vehicle_count: 40,
        congestion_level: "HIGH",
      },
    });

    await eventRepo.save(e1);
    await eventRepo.save(e2);

    const all = await eventRepo.findAll();
    expect(all).toHaveLength(2);
  });

  it("count() returns the correct number of stored envelopes", async () => {
    const e1 = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.TrafficCleared,
      payload: { intersection_name: "F-6", cleared_at: new Date().toISOString() },
    });

    await eventRepo.save(e1);
    expect(await eventRepo.count()).toBe(1);
  });

  it("findById() returns null for a non-existent event", async () => {
    const result = await eventRepo.findById("non-existent-id");
    expect(result).toBeNull();
  });

  it("duplicate eventId is rejected", async () => {
    const envelope = createEnvelope({
      source_id: "CAM-ISB-001",
      event_type: EVENT_TYPES.VehicleDetected,
      payload: { vehicle_plate: "DUP-1", intersection_name: "F-10" },
    });

    await eventRepo.save(envelope);
    await expect(eventRepo.save(envelope)).rejects.toThrow();
  });
});
