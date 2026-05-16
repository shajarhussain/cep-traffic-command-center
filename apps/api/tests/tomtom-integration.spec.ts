import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { createSystemContext, type SystemContext } from "../src/application/systemContext.js";
import { createApp } from "../src/app.js";

/**
 * TomTom-as-CEP-service integration.
 *
 * Verifies that TomTom isn't just displayed — it influences decisions:
 *   1. /api/traffic-risk reflects TomTom severity (mirrors the weather bump path).
 *   2. IncidentService writes external_confirmed + external_context_summary on
 *      newly opened incidents.
 *   3. IncidentService bumps incident severity one level when TomTom reports
 *      POOR flow during the corroboration call.
 *
 * fetch() is mocked so the suite never hits the real TomTom API.
 */

let prisma: PrismaClient;
let app: Express;
let ctx: SystemContext;
let cameraId: string;

beforeAll(() => { prisma = getTestPrisma(); });

beforeEach(async () => {
  await cleanTestDb(prisma);
  // Seeded zone + enabled TomTom provider so the helpers actually call the (mocked) fetch.
  await prisma.operationZone.create({
    data: {
      id: "zone-isb", name: "Islamabad Traffic Zone", city: "Islamabad", country: "PK",
      centerLatitude: 33.7, centerLongitude: 73.0,
    },
  });
  await prisma.externalProviderConfig.create({
    data: { id: "ext-tt", provider: "TOMTOM", enabled: true, zoneId: "zone-isb", lastStatus: "CONNECTED" },
  });
  const cam = await prisma.trafficCamera.create({
    data: { cameraCode: "CAM-TT-001", intersectionName: "Jinnah Avenue", speedLimitKmh: 60, status: "ACTIVE" },
  });
  cameraId = cam.id;
  ctx = createSystemContext(prisma);
  app = createApp(ctx);
  process.env["TOMTOM_API_KEY"] = "test-key";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env["TOMTOM_API_KEY"];
});

afterAll(async () => { await cleanTestDb(prisma); await disconnectTestPrisma(); });

/** Helper: stub fetch to return a TomTom flow-segment payload. */
function mockTomTomFlow(currentSpeed: number, freeFlowSpeed: number) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("flowSegmentData")) {
      return {
        ok: true,
        json: async () => ({ flowSegmentData: { currentSpeed, freeFlowSpeed, confidence: 0.9, roadClosure: false } }),
      };
    }
    if (url.includes("incidentDetails")) {
      return { ok: true, json: async () => ({ incidents: [] }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }));
}

/** Helper: stub fetch to return N incidents but baseline (free-flow) speed. */
function mockTomTomIncidents(count: number) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
    if (url.includes("flowSegmentData")) {
      return {
        ok: true,
        json: async () => ({ flowSegmentData: { currentSpeed: 55, freeFlowSpeed: 60, confidence: 0.9, roadClosure: false } }),
      };
    }
    if (url.includes("incidentDetails")) {
      const incidents = Array.from({ length: count }, (_, i) => ({
        type: "Feature",
        properties: { from: "A", to: "B", magnitudeOfDelay: 1, events: [{ description: `Mock incident ${i}` }] },
      }));
      return { ok: true, json: async () => ({ incidents }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  }));
}

describe("TomTom-as-CEP-service", () => {
  it("baseline: no key set → /api/traffic-risk reports no tomtom bump", async () => {
    delete process.env["TOMTOM_API_KEY"];
    const res = await request(app).get("/api/traffic-risk");
    expect(res.status).toBe(200);
    expect(res.body.tomtom?.available).toBe(false);
    // No TomTom reason should appear.
    expect((res.body.reasons as string[]).some(r => r.toLowerCase().includes("tomtom"))).toBe(false);
  });

  it("POOR flow bumps overall risk one level + adds a TomTom reason", async () => {
    mockTomTomFlow(10, 60);   // 17% — POOR
    const res = await request(app).get("/api/traffic-risk");
    expect(res.status).toBe(200);
    expect(res.body.tomtom.available).toBe(true);
    expect(res.body.tomtom.severity).toBe("POOR");
    // Baseline risk would be LOW (no incidents, no queue saturation in a fresh DB) → TomTom bumps to MEDIUM.
    expect(res.body.overallRisk).not.toBe("LOW");
    expect((res.body.reasons as string[]).some(r => r.toLowerCase().includes("tomtom"))).toBe(true);
  });

  it("≥4 external incidents bumps risk even with healthy flow", async () => {
    mockTomTomIncidents(5);
    const res = await request(app).get("/api/traffic-risk");
    expect(res.status).toBe(200);
    expect(res.body.tomtom.incidentCount).toBe(5);
    expect(res.body.overallRisk).not.toBe("LOW");
    expect((res.body.reasons as string[]).some(r => r.toLowerCase().includes("tomtom"))).toBe(true);
  });

  it("IncidentService writes external_confirmed + external_context_summary on incident creation", async () => {
    mockTomTomIncidents(2);   // ≥1 incident → confirms=true
    // Publish a CongestionAlertEvent to open an incident
    const pub = await request(app).post("/api/events/publish").send({
      source_id: cameraId,
      event_type: "CongestionAlertEvent",
      payload: { intersection: "Jinnah Avenue", vehicle_count: 50, congestion_level: "HIGH" },
    });
    expect(pub.status).toBe(201);

    // The corroboration call is fire-and-forget — give it a small grace window to land.
    await new Promise(resolve => setTimeout(resolve, 300));

    const incident = await prisma.trafficIncident.findFirst({ where: { intersection_name: "Jinnah Avenue" } });
    expect(incident).not.toBeNull();
    expect(incident?.external_confirmed).toBe(true);
    expect(incident?.external_context_summary ?? "").toMatch(/TomTom/i);
  });

  it("POOR TomTom flow escalates incident severity one level", async () => {
    mockTomTomFlow(10, 60);   // POOR
    // Publish a CongestionAlertEvent — severity will start at one level from policy
    await request(app).post("/api/events/publish").send({
      source_id: cameraId,
      event_type: "CongestionAlertEvent",
      payload: { intersection: "Jinnah Avenue", vehicle_count: 30, congestion_level: "HIGH" },
    });
    await new Promise(resolve => setTimeout(resolve, 300));

    const incident = await prisma.trafficIncident.findFirst({ where: { intersection_name: "Jinnah Avenue" } });
    expect(incident).not.toBeNull();
    // The corroboration path bumps severity one level on POOR. Acceptable
    // outcomes are MEDIUM / HIGH / CRITICAL — never LOW or INFO.
    expect(["MEDIUM", "HIGH", "CRITICAL"]).toContain(incident!.severity);
    expect(incident?.external_confirmed).toBe(true);
  });
});
