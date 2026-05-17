import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { createSystemContext } from "../src/application/systemContext.js";
import { createApp } from "../src/app.js";
import type { Express } from "express";

let prisma: PrismaClient;
let app: Express;
let ctx: any;

async function seedCameras() {
  for (const cam of [
    { cameraCode: "CAM-ISB-001", intersectionName: "Jinnah Avenue", speedLimitKmh: 60, status: "ACTIVE" },
    { cameraCode: "CAM-ISB-002", intersectionName: "Blue Area", speedLimitKmh: 50, status: "ACTIVE" },
    { cameraCode: "CAM-ISB-003", intersectionName: "F-8 Markaz", speedLimitKmh: 40, status: "ACTIVE" },
  ]) {
    await prisma.trafficCamera.upsert({ where: { cameraCode: cam.cameraCode }, update: cam, create: cam });
  }
}

beforeAll(() => {
  prisma = getTestPrisma();
});

beforeEach(async () => {
  await cleanTestDb(prisma);
  await seedCameras();
  // Recreate SystemContext each test so in-memory subscriber state is fresh
  ctx = createSystemContext(prisma);
  app = createApp(ctx);
  ctx.startBackgroundWorkers();
});

afterEach(() => {
  ctx.stopBackgroundWorkers();
});

afterAll(async () => {
  await cleanTestDb(prisma);
  await disconnectTestPrisma();
});

describe("API Routes (Phase 5)", () => {
  it("GET /api/health returns 200 with status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("GET /api/cameras returns at least 3 cameras", async () => {
    const res = await request(app).get("/api/cameras");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });

  it("POST /api/events/publish with VehicleDetectedEvent stores and publishes", async () => {
    const res = await request(app).post("/api/events/publish").send({
      source_id: "CAM-ISB-001", event_type: "VehicleDetectedEvent",
      payload: { vehicle_plate: "TEST-001", intersection: "Jinnah Avenue", detected_at: new Date().toISOString() },
    });
    expect(res.status).toBe(201);
    expect(res.body.envelope.event_type).toBe("VehicleDetectedEvent");
    expect(res.body.envelope.event_id).toBeDefined();
  });

  it("POST /api/events/publish with SpeedViolationEvent creates a penalty", async () => {
    await request(app).post("/api/events/publish").send({
      source_id: "CAM-ISB-001", event_type: "SpeedViolationEvent",
      payload: { vehicle_plate: "SPEED-001", intersection: "Jinnah Avenue", speed: 90, speed_limit: 60, detected_at: new Date().toISOString() },
    });
    const res = await request(app).get("/api/penalties");
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].vehicle_plate).toBe("SPEED-001");
  });

  it("POST /api/events/publish-duplicate-speed-violation returns 2 attempts, 1 penalty", async () => {
    const res = await request(app).post("/api/events/publish-duplicate-speed-violation");
    expect(res.status).toBe(200);
    expect(res.body.published_attempts).toBe(2);
    expect(res.body.penalties_created_for_event).toBe(1);
  });

  it("GET /api/events returns envelopes with 7 CEP fields", async () => {
    await request(app).post("/api/events/publish").send({
      source_id: "CAM-ISB-002", event_type: "VehicleDetectedEvent",
      payload: { vehicle_plate: "F-001", intersection: "Blue Area", detected_at: new Date().toISOString() },
    });
    const res = await request(app).get("/api/events");
    expect(res.status).toBe(200);
    const e = res.body[0];
    expect(e).toHaveProperty("event_id");
    expect(e).toHaveProperty("correlation_id");
    expect(e).toHaveProperty("schema_version");
    expect(e).toHaveProperty("source_id");
    expect(e).toHaveProperty("timestamp");
    expect(e).toHaveProperty("event_type");
    expect(e).toHaveProperty("payload");
  });

  it("GET /api/subscribers returns 5 subscribers with correct types", async () => {
    const res = await request(app).get("/api/subscribers");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    const names = res.body.map((s: { name: string }) => s.name);
    expect(names).toContain("AlertService");
    expect(names).toContain("LoggingService");
    expect(names).toContain("DashboardService");
    expect(names).toContain("ReportingService");
    expect(names).toContain("IncidentService");
  });

  it("GET /api/penalties returns created penalties", async () => {
    await request(app).post("/api/events/publish").send({
      source_id: "CAM-ISB-001", event_type: "SpeedViolationEvent",
      payload: { vehicle_plate: "PEN-001", intersection: "F-8 Markaz", speed: 85, speed_limit: 40, detected_at: new Date().toISOString() },
    });
    const res = await request(app).get("/api/penalties");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/audit-logs returns entries after speed event", async () => {
    await request(app).post("/api/events/publish").send({
      source_id: "CAM-ISB-001", event_type: "SpeedViolationEvent",
      payload: { vehicle_plate: "LOG-001", intersection: "Jinnah Avenue", speed: 95, speed_limit: 60, detected_at: new Date().toISOString() },
    });
    const res = await request(app).get("/api/audit-logs");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/events/publish with unknown event_type returns 400", async () => {
    const res = await request(app).post("/api/events/publish").send({
      source_id: "CAM-ISB-001", event_type: "InvalidEventType",
      payload: { vehicle_plate: "X" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Unknown event_type");
  });

  it("POST /api/events/publish with missing source_id returns 400", async () => {
    const res = await request(app).post("/api/events/publish").send({
      event_type: "VehicleDetectedEvent",
      payload: { vehicle_plate: "X", intersection: "Y" },
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/dashboard returns snapshots after event", async () => {
    await request(app).post("/api/events/publish").send({
      source_id: "CAM-ISB-003", event_type: "CongestionAlertEvent",
      payload: { intersection: "F-8 Markaz", vehicle_count: 50, congestion_level: "CRITICAL", detected_at: new Date().toISOString() },
    });
    
    // Wait for the async BoundedEventQueue to be drained by DashboardService
    await new Promise(r => setTimeout(r, 150));
    
    const res = await request(app).get("/api/dashboard");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });
});
