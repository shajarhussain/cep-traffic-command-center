import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { createSystemContext } from "../src/application/systemContext.js";
import { createApp } from "../src/app.js";

/**
 * OperatorActionLog wiring — high-signal mutations must leave an audit row.
 * Surfaces in Audit Trail → Operator Actions tab.
 */

let prisma: PrismaClient;
let app: Express;

beforeAll(() => { prisma = getTestPrisma(); });

beforeEach(async () => {
  await cleanTestDb(prisma);
  await prisma.operationZone.create({
    data: { id: "zone-op", name: "Op Zone", city: "X", country: "Y", centerLatitude: 33.7, centerLongitude: 73.0 },
  });
  await prisma.externalProviderConfig.create({
    data: { id: "ext-op", provider: "TOMTOM", enabled: false, zoneId: "zone-op", lastStatus: "NOT_CONFIGURED" },
  });
  const ctx = createSystemContext(prisma);
  app = createApp(ctx);
});

afterAll(async () => { await cleanTestDb(prisma); await disconnectTestPrisma(); });

describe("OperatorActionLog wiring", () => {
  it("subscribing a subscriber writes a SUBSCRIBE action row", async () => {
    const before = await prisma.operatorActionLog.count();
    await request(app).post("/api/subscribers/AlertService/subscribe").send({ eventType: "VehicleDetectedEvent" });
    const after = await prisma.operatorActionLog.count();
    expect(after).toBe(before + 1);
    const row = await prisma.operatorActionLog.findFirst({ where: { actionType: "SUBSCRIBE" } });
    expect(row?.targetId).toBe("AlertService");
  });

  it("unsubscribing writes an UNSUBSCRIBE action row", async () => {
    await request(app).delete("/api/subscribers/AlertService/subscribe?eventType=SpeedViolationEvent");
    const row = await prisma.operatorActionLog.findFirst({ where: { actionType: "UNSUBSCRIBE" } });
    expect(row?.targetId).toBe("AlertService");
    expect(row?.message).toContain("SpeedViolationEvent");
  });

  it("restore-defaults writes a RESTORE_DEFAULTS row", async () => {
    await request(app).post("/api/subscribers/restore-defaults");
    const row = await prisma.operatorActionLog.findFirst({ where: { actionType: "RESTORE_DEFAULTS" } });
    expect(row).not.toBeNull();
  });

  it("toggling the external provider writes a TOGGLE_PROVIDER row only on state change", async () => {
    // Same enabled value → no log
    await request(app).put("/api/config/external-provider").send({ enabled: false });
    let count = await prisma.operatorActionLog.count({ where: { actionType: "TOGGLE_PROVIDER" } });
    expect(count).toBe(0);

    // Actual flip → log
    await request(app).put("/api/config/external-provider").send({ enabled: true });
    count = await prisma.operatorActionLog.count({ where: { actionType: "TOGGLE_PROVIDER" } });
    expect(count).toBe(1);
  });

  it("creating + updating + deleting a FinePolicy each writes an action row", async () => {
    const create = await request(app).post("/api/config/fine-policies").send({
      name: "Test policy", eventType: "SpeedViolationEvent", excessThresholdKmh: 10, fineAmount: 1000, active: true,
    });
    expect(create.status).toBe(201);
    const id = create.body.id;

    await request(app).put(`/api/config/fine-policies/${id}`).send({ fineAmount: 2000 });
    await request(app).delete(`/api/config/fine-policies/${id}`);

    const types = await prisma.operatorActionLog.findMany({ where: { targetType: "FinePolicy" } });
    const typesByAction = types.map(t => t.actionType).sort();
    expect(typesByAction).toEqual(["CREATE_FINE_POLICY", "DELETE_FINE_POLICY", "UPDATE_FINE_POLICY"]);
  });

  it("GET /api/operator-actions returns the rows newest-first", async () => {
    await request(app).post("/api/subscribers/AlertService/subscribe").send({ eventType: "VehicleDetectedEvent" });
    await request(app).delete("/api/subscribers/AlertService/subscribe?eventType=VehicleDetectedEvent");
    const res = await request(app).get("/api/operator-actions");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    // Newest first
    expect(res.body[0].actionType).toBe("UNSUBSCRIBE");
  });
});
