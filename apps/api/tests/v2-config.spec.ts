import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { createSystemContext } from "../src/application/systemContext.js";
import { createApp } from "../src/app.js";
import type { Express } from "express";

let prisma: PrismaClient;
let app: Express;

beforeAll(() => { prisma = getTestPrisma(); });

beforeEach(async () => {
  await cleanTestDb(prisma);
  const ctx = createSystemContext(prisma);
  app = createApp(ctx);
});

afterAll(async () => {
  await cleanTestDb(prisma);
  await disconnectTestPrisma();
});

describe("V2 Configuration APIs", () => {
  // ─── Zones ───────────────────────────────────────────────────
  it("POST /api/config/zones creates a zone and GET returns it", async () => {
    const createRes = await request(app).post("/api/config/zones").send({
      name: "Test Zone", city: "Lahore", country: "Pakistan",
      centerLatitude: 31.5204, centerLongitude: 74.3587,
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe("Test Zone");

    const getRes = await request(app).get("/api/config/zones");
    expect(getRes.status).toBe(200);
    expect(getRes.body.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Intersections ───────────────────────────────────────────
  it("POST /api/config/intersections creates and GET returns it", async () => {
    const zone = await prisma.operationZone.create({
      data: { name: "Z", city: "C", country: "P", centerLatitude: 0, centerLongitude: 0 },
    });
    const res = await request(app).post("/api/config/intersections").send({
      zoneId: zone.id, name: "Test Intersection", latitude: 33.7, longitude: 73.0,
      defaultSpeedLimit: 60, congestionThreshold: 20,
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Intersection");
  });

  // ─── Cameras CRUD ────────────────────────────────────────────
  it("POST /api/cameras creates a camera and PUT updates it", async () => {
    const createRes = await request(app).post("/api/cameras").send({
      cameraCode: "CAM-TEST-001", intersectionName: "Test Int", speedLimitKmh: 50,
    });
    expect(createRes.status).toBe(201);

    const putRes = await request(app).put(`/api/cameras/${createRes.body.id}`).send({
      name: "Updated Camera",
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.name).toBe("Updated Camera");
  });

  // ─── Alert Templates ─────────────────────────────────────────
  it("POST /api/config/alert-templates creates a template", async () => {
    const res = await request(app).post("/api/config/alert-templates").send({
      name: "Test Template", eventType: "SpeedViolationEvent",
      description: "Test", defaultPayload: '{"speed_kmh": 100}',
    });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Test Template");

    const getRes = await request(app).get("/api/config/alert-templates");
    expect(getRes.body.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Queue Policy affects analysis ───────────────────────────
  it("Active queue policy affects /api/queue/analysis", async () => {
    await prisma.queuePolicy.create({
      data: {
        name: "Test Policy", incomingRate: 1000, processingRate: 100,
        queueLimit: 5000, evictionPolicy: "Test eviction", active: true,
      },
    });
    // Need cameras for the app to work
    await prisma.trafficCamera.create({
      data: { cameraCode: "C1", intersectionName: "I1", speedLimitKmh: 60 },
    });
    const ctx = createSystemContext(prisma);
    app = createApp(ctx);

    const res = await request(app).get("/api/queue/analysis");
    expect(res.status).toBe(200);
    expect(res.body.incomingRate).toBe(1000);
    expect(res.body.processingRate).toBe(100);
    expect(res.body.queueLimit).toBe(5000);
    expect(res.body.secondsUntilFull).toBeCloseTo(5.56, 1);
    expect(res.body.policyName).toBe("Test Policy");
  });

  // ─── Queue Policy fallback ───────────────────────────────────
  it("Queue analysis falls back to default when no policy exists", async () => {
    await prisma.trafficCamera.create({
      data: { cameraCode: "C1", intersectionName: "I1", speedLimitKmh: 60 },
    });
    const ctx = createSystemContext(prisma);
    app = createApp(ctx);

    const res = await request(app).get("/api/queue/analysis");
    expect(res.status).toBe(200);
    expect(res.body.incomingRate).toBe(500);
    expect(res.body.processingRate).toBe(80);
    expect(res.body.queueLimit).toBe(10000);
    expect(res.body.secondsUntilFull).toBeCloseTo(23.81, 1);
  });

  // ─── External context status ─────────────────────────────────
  it("GET /api/external/context-status returns fallback when no key", async () => {
    const res = await request(app).get("/api/external/context-status");
    expect(res.status).toBe(200);
    expect(res.body.fallback).toBe(true);
    expect(res.body.provider).toBe("TOMTOM");
  });

  // ─── Traffic risk fallback ───────────────────────────────────
  it("GET /api/traffic-risk returns risk assessment", async () => {
    const res = await request(app).get("/api/traffic-risk");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("overallRisk");
    expect(res.body).toHaveProperty("recommendation");
    expect(res.body).toHaveProperty("queueSecondsUntilFull");
  });

  // ─── Incident acknowledge/close ──────────────────────────────
  it("POST /api/incidents/:id/acknowledge and /close work", async () => {
    const incident = await prisma.trafficIncident.create({
      data: {
        intersection_name: "Test", incident_type: "SPEED_INCIDENT", severity: "HIGH",
        first_event_id: "e1", last_event_id: "e1",
      },
    });

    const ackRes = await request(app).post(`/api/incidents/${incident.id}/acknowledge`);
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.status).toBe("ACKNOWLEDGED");

    const closeRes = await request(app).post(`/api/incidents/${incident.id}/close`);
    expect(closeRes.status).toBe(200);
    expect(closeRes.body.status).toBe("CLEARED");

    // Verify operator action logged
    const actions = await prisma.operatorActionLog.findMany();
    expect(actions.length).toBe(2);
  });

  // ─── Summary endpoint V2 ────────────────────────────────────
  it("GET /api/summary returns V2 fields", async () => {
    await prisma.trafficCamera.create({
      data: { cameraCode: "C1", intersectionName: "I1", speedLimitKmh: 60 },
    });
    const ctx = createSystemContext(prisma);
    app = createApp(ctx);

    const res = await request(app).get("/api/summary");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("cameraCount");
    expect(res.body).toHaveProperty("intersectionCount");
    expect(res.body).toHaveProperty("openIncidentCount");
    expect(res.body).toHaveProperty("criticalIncidentCount");
    expect(res.body).toHaveProperty("queueRisk");
    expect(res.body).toHaveProperty("externalProviderStatus");
  });

  // ─── Severity Policy CRUD ───────────────────────────────────
  it("Severity policy CRUD works", async () => {
    const createRes = await request(app).post("/api/config/severity-policies").send({
      name: "Test Sev", eventType: "SpeedViolationEvent", payloadField: "speed_excess",
      lowThreshold: 5, mediumThreshold: 15, highThreshold: 30,
    });
    expect(createRes.status).toBe(201);

    const getRes = await request(app).get("/api/config/severity-policies");
    expect(getRes.body.length).toBeGreaterThanOrEqual(1);
  });

  // ─── Incident Rule CRUD ──────────────────────────────────────
  it("Incident rule CRUD works", async () => {
    const createRes = await request(app).post("/api/config/incident-rules").send({
      name: "Test Rule", incidentType: "TEST", eventType: "SpeedViolationEvent",
      groupingWindowMinutes: 15, minimumEvents: 2, escalationThreshold: 5,
    });
    expect(createRes.status).toBe(201);

    const getRes = await request(app).get("/api/config/incident-rules");
    expect(getRes.body.length).toBeGreaterThanOrEqual(1);
  });
});
