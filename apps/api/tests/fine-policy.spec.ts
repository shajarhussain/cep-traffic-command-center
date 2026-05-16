import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { createSystemContext, type SystemContext } from "../src/application/systemContext.js";

/**
 * FinePolicy — user-driven fine schedule (replaces the hardcoded fines
 * in AlertService). Verifies the right policy row wins and that the
 * fallback path (no rows present) uses env-configurable defaults.
 */

let prisma: PrismaClient;
let ctx: SystemContext;

beforeAll(() => { prisma = getTestPrisma(); });

beforeEach(async () => {
  await cleanTestDb(prisma);
  await prisma.trafficCamera.upsert({
    where: { cameraCode: "CAM-FP-001" },
    update: {},
    create: { cameraCode: "CAM-FP-001", intersectionName: "Fine Avenue", speedLimitKmh: 60, status: "ACTIVE" },
  });
  ctx = createSystemContext(prisma);
});

afterAll(async () => { await cleanTestDb(prisma); await disconnectTestPrisma(); });

async function seedPolicies() {
  await prisma.finePolicy.createMany({
    data: [
      { name: "Severe",   eventType: "SpeedViolationEvent", excessThresholdKmh: 30, fineAmount: 5000, active: true },
      { name: "Moderate", eventType: "SpeedViolationEvent", excessThresholdKmh: 15, fineAmount: 3000, active: true },
      { name: "Minor",    eventType: "SpeedViolationEvent", excessThresholdKmh: 0,  fineAmount: 1500, active: true },
    ],
  });
}

async function publishViolation(plate: string, speed: number, limit: number): Promise<number> {
  await ctx.publishUseCase.execute({
    source_id: "CAM-FP-001",
    event_type: "SpeedViolationEvent",
    payload: { vehicle_plate: plate, intersection: "Fine Avenue", speed, speed_limit: limit },
  });
  const p = await prisma.penalty.findFirst({ where: { vehiclePlate: plate } });
  expect(p).not.toBeNull();
  return p!.fineAmount;
}

describe("FinePolicy — user-driven fine schedule", () => {
  it("uses the matching policy row (highest threshold ≤ excess wins)", async () => {
    await seedPolicies();
    expect(await publishViolation("FP-001", 95, 60)).toBe(5000); // excess 35 → severe
    expect(await publishViolation("FP-002", 80, 60)).toBe(3000); // excess 20 → moderate
    expect(await publishViolation("FP-003", 65, 60)).toBe(1500); // excess  5 → minor
  });

  it("falls back to env defaults when no policy rows exist", async () => {
    process.env["DEFAULT_FINE_HIGH"]   = "7777";
    process.env["DEFAULT_FINE_MEDIUM"] = "4444";
    process.env["DEFAULT_FINE_LOW"]    = "1111";
    try {
      expect(await publishViolation("FP-004", 95, 60)).toBe(7777);
      expect(await publishViolation("FP-005", 80, 60)).toBe(4444);
      expect(await publishViolation("FP-006", 65, 60)).toBe(1111);
    } finally {
      delete process.env["DEFAULT_FINE_HIGH"];
      delete process.env["DEFAULT_FINE_MEDIUM"];
      delete process.env["DEFAULT_FINE_LOW"];
    }
  });

  it("updating a policy row changes the next penalty's amount", async () => {
    await seedPolicies();
    expect(await publishViolation("FP-007", 95, 60)).toBe(5000);

    const severe = await prisma.finePolicy.findFirst({ where: { excessThresholdKmh: 30 } });
    await prisma.finePolicy.update({ where: { id: severe!.id }, data: { fineAmount: 9999 } });

    expect(await publishViolation("FP-008", 95, 60)).toBe(9999);
  });

  it("inactive policy rows are skipped", async () => {
    await seedPolicies();
    await prisma.finePolicy.updateMany({ where: { excessThresholdKmh: 30 }, data: { active: false } });
    // Severe is inactive — moderate (15) should now apply to a 35-excess violation.
    expect(await publishViolation("FP-009", 95, 60)).toBe(3000);
  });
});
