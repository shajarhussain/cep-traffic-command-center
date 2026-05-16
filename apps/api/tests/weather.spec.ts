import { describe, it, expect, beforeAll, beforeEach, afterAll, vi, afterEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { getTestPrisma, cleanTestDb, disconnectTestPrisma } from "./helpers/prisma-test.js";
import { createSystemContext, type SystemContext } from "../src/application/systemContext.js";
import { fetchWeather } from "../src/interfaces/http/weather.routes.js";

let prisma: PrismaClient;
let ctx: SystemContext;

beforeAll(() => { prisma = getTestPrisma(); });

beforeEach(async () => {
  await cleanTestDb(prisma);
  await prisma.operationZone.create({
    data: {
      id: "zone-test", name: "Test Zone", city: "Islamabad", country: "PK",
      // Distinct lat/lon per test so the in-module cache doesn't bleed between specs.
      centerLatitude: 33.700 + Math.random(),
      centerLongitude: 73.000 + Math.random(),
    },
  });
  ctx = createSystemContext(prisma);
});

afterEach(() => { vi.restoreAllMocks(); });

afterAll(async () => { await cleanTestDb(prisma); await disconnectTestPrisma(); });

/** Build a realistic Open-Meteo response with the given weather_code + visibility. */
function openMeteoBody(opts: { code: number; temp?: number; visibility?: number }) {
  return {
    current: {
      temperature_2m: opts.temp ?? 22,
      apparent_temperature: (opts.temp ?? 22) - 1,
      relative_humidity_2m: 70,
      weather_code: opts.code,
      wind_speed_10m: 8,
    },
    hourly: { visibility: [opts.visibility ?? 20000] },
  };
}

describe("Weather integration (Open-Meteo)", () => {
  it("returns CLEAR for weather_code 0 + good visibility", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => openMeteoBody({ code: 0 }) }));
    const result = await fetchWeather(ctx);
    expect(result.fallback).toBe(false);
    expect(result.provider).toBe("OPEN-METEO");
    expect(result.condition).toBe("Clear");
    expect(result.severity).toBe("CLEAR");
    expect(result.temperatureC).toBe(22);
  });

  it("derives MODERATE severity from rain (weather_code 63)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => openMeteoBody({ code: 63, temp: 18 }) }));
    const result = await fetchWeather(ctx);
    expect(result.condition).toBe("Rain");
    expect(result.severity).toBe("MODERATE");
  });

  it("derives POOR severity from thunderstorm (weather_code 95)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => openMeteoBody({ code: 95 }) }));
    const result = await fetchWeather(ctx);
    expect(result.condition).toBe("Thunderstorm");
    expect(result.severity).toBe("POOR");
  });

  it("derives POOR severity from very low visibility even when condition is benign", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => openMeteoBody({ code: 0, visibility: 800 }) }));
    const result = await fetchWeather(ctx);
    expect(result.severity).toBe("POOR");
  });

  it("falls back when Open-Meteo returns a non-OK status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    const result = await fetchWeather(ctx);
    expect(result.fallback).toBe(true);
    expect(result.provider).toBe("FALLBACK");
    expect(result.message).toContain("503");
  });

  it("falls back gracefully when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await fetchWeather(ctx);
    expect(result.fallback).toBe(true);
    expect(result.message).toContain("network down");
  });
});
