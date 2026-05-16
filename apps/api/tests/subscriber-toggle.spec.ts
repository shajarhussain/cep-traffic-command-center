import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { createSystemContext } from "../src/application/systemContext.js";
import { createApp } from "../src/app.js";
import { EVENT_TYPES } from "../src/domain/events/EventTypes.js";

let prisma: PrismaClient;
let app: Express;

beforeAll(() => { prisma = getTestPrisma(); });

beforeEach(async () => {
  await cleanTestDb(prisma);
  await prisma.trafficCamera.upsert({
    where: { cameraCode: "CAM-SUB-001" },
    update: {},
    create: { cameraCode: "CAM-SUB-001", intersectionName: "Subscriber Lane", speedLimitKmh: 60, status: "ACTIVE" },
  });
  const ctx = createSystemContext(prisma);
  app = createApp(ctx);
});

afterAll(async () => { await cleanTestDb(prisma); await disconnectTestPrisma(); });

describe("Subscribers Monitor (CEP Task 2 demo)", () => {
  it("GET /api/subscribers returns all 5 with active event types", async () => {
    const res = await request(app).get("/api/subscribers");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    const alert = res.body.find((s: { name: string }) => s.name === "AlertService");
    expect(alert.activeEventTypes).toContain(EVENT_TYPES.SpeedViolation);
  });

  it("POST /api/subscribers/AlertService/subscribe adds a new event type", async () => {
    const res = await request(app)
      .post("/api/subscribers/AlertService/subscribe")
      .send({ eventType: EVENT_TYPES.CongestionAlert });
    expect(res.status).toBe(200);
    expect(res.body.activeEventTypes).toContain(EVENT_TYPES.CongestionAlert);
  });

  it("DELETE /api/subscribers/AlertService/subscribe removes an event type", async () => {
    const res = await request(app)
      .delete(`/api/subscribers/AlertService/subscribe?eventType=${EVENT_TYPES.SpeedViolation}`);
    expect(res.status).toBe(200);
    expect(res.body.activeEventTypes).not.toContain(EVENT_TYPES.SpeedViolation);
  });

  it("subscribing an unknown subscriber returns 404", async () => {
    const res = await request(app)
      .post("/api/subscribers/NoSuchService/subscribe")
      .send({ eventType: EVENT_TYPES.VehicleDetected });
    expect(res.status).toBe(404);
  });

  it("POST /api/subscribers/restore-defaults re-runs the default routing", async () => {
    // First unsubscribe AlertService from SpeedViolation
    await request(app).delete(`/api/subscribers/AlertService/subscribe?eventType=${EVENT_TYPES.SpeedViolation}`);
    let res = await request(app).get("/api/subscribers");
    let alert = res.body.find((s: { name: string }) => s.name === "AlertService");
    expect(alert.activeEventTypes).not.toContain(EVENT_TYPES.SpeedViolation);

    res = await request(app).post("/api/subscribers/restore-defaults");
    expect(res.status).toBe(200);

    res = await request(app).get("/api/subscribers");
    alert = res.body.find((s: { name: string }) => s.name === "AlertService");
    expect(alert.activeEventTypes).toContain(EVENT_TYPES.SpeedViolation);
  });

  it("publishing a SpeedViolation after unsubscribing AlertService creates NO penalty", async () => {
    // Unsubscribe AlertService
    await request(app).delete(`/api/subscribers/AlertService/subscribe?eventType=${EVENT_TYPES.SpeedViolation}`);

    // Publish a SpeedViolation
    await request(app).post("/api/events/publish").send({
      source_id: "CAM-SUB-001",
      event_type: "SpeedViolationEvent",
      payload: { vehicle_plate: "ST-001", intersection: "Subscriber Lane", speed: 95, speed_limit: 60 },
    });

    const penalties = await request(app).get("/api/penalties");
    expect(penalties.body).toHaveLength(0);
  });
});
