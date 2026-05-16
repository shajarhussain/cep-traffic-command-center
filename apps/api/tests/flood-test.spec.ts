import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { createSystemContext } from "../src/application/systemContext.js";
import { createApp } from "../src/app.js";

let prisma: PrismaClient;
let app: Express;

beforeAll(() => { prisma = getTestPrisma(); });

beforeEach(async () => {
  await cleanTestDb(prisma);
  await prisma.trafficCamera.upsert({
    where: { cameraCode: "CAM-FLOOD-001" },
    update: {},
    create: { cameraCode: "CAM-FLOOD-001", intersectionName: "Flood Lane", speedLimitKmh: 60, status: "ACTIVE" },
  });
  await prisma.queuePolicy.create({
    data: { name: "Small Queue", incomingRate: 500, processingRate: 80, queueLimit: 50, evictionPolicy: "Drop least important first", active: true },
  });
  const ctx = createSystemContext(prisma);
  app = createApp(ctx);
});

afterAll(async () => { await cleanTestDb(prisma); await disconnectTestPrisma(); });

describe("Flood test (CEP Scenario 2)", () => {
  it("POST /api/queue/flood-test reports published count + breakdown", async () => {
    const res = await request(app).post("/api/queue/flood-test").send({ count: 30 });
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(30);
    expect(typeof res.body.evicted).toBe("number");
    expect(typeof res.body.accepted).toBe("number");
    expect(res.body.accepted + res.body.evicted).toBe(30);
    expect(res.body.breakdown).toBeDefined();
  });

  it("exceeding queue limit causes evictions", async () => {
    // Queue limit is 50; flood with 200 events to force eviction
    const res = await request(app).post("/api/queue/flood-test").send({ count: 200 });
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(200);
    expect(res.body.evicted).toBeGreaterThan(0);
    expect(res.body.finalQueueSize).toBeLessThanOrEqual(50);
  });

  it("returns the active policy name on success", async () => {
    const res = await request(app).post("/api/queue/flood-test").send({ count: 10 });
    expect(res.status).toBe(200);
    expect(res.body.policyName).toBe("Small Queue");
  });

  it("clamps absurd counts to a safe upper bound", async () => {
    const res = await request(app).post("/api/queue/flood-test").send({ count: 999_999 });
    expect(res.status).toBe(200);
    expect(res.body.published).toBeLessThanOrEqual(5000);
  });
});

describe("Event types catalog", () => {
  it("GET /api/event-types returns the catalog", async () => {
    const res = await request(app).get("/api/event-types");
    expect(res.status).toBe(200);
    expect(res.body.eventTypes).toHaveLength(4);
    expect(res.body.severities).toEqual(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    expect(res.body.statuses.incident).toEqual(["OPEN", "ACKNOWLEDGED", "CLEARED"]);
  });
});
