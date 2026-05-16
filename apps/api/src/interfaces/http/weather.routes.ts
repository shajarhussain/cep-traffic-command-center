import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";

/**
 * Weather context routes — Open-Meteo integration.
 *
 * Open-Meteo (https://open-meteo.com/) is a non-profit, EU-based weather API.
 * It is completely free for non-commercial use, requires no API key, and
 * allows 10,000 calls per day. We use it because:
 *   - No signup friction during demos / viva.
 *   - No key to leak.
 *   - Generous rate limits.
 *
 * Weather conditions feed into the traffic-risk calculation: POOR severity
 * (thunderstorm, snow, very low visibility) bumps the overall risk one level;
 * MODERATE (rain, fog, drizzle) bumps a LOW risk to MEDIUM. The integration
 * also supports a fallback mode (no network / API down) so the system never
 * stops responding because of a third-party outage.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { fetchedAt: number; latlon: string; payload: WeatherResponse } | null = null;

export interface WeatherResponse {
  provider: "OPEN-METEO" | "FALLBACK";
  connected: boolean;
  fallback: boolean;
  keyConfigured: boolean;
  city: string | null;
  temperatureC: number | null;
  feelsLikeC: number | null;
  condition: string;        // "Clear", "Rain", "Fog", ...
  conditionCode: number | null;
  visibilityMeters: number | null;
  windSpeedKmh: number | null;
  humidityPct: number | null;
  severity: "CLEAR" | "MODERATE" | "POOR";
  message: string;
  fetchedAt: string;
}

/**
 * WMO weather interpretation codes (see https://open-meteo.com/en/docs).
 * Mapped to short condition strings that the UI displays directly.
 */
function describeWeatherCode(code: number): { label: string; bucket: "clear" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "thunderstorm" } {
  if (code === 0) return { label: "Clear", bucket: "clear" };
  if (code >= 1 && code <= 3) return { label: ["Mainly Clear", "Partly Cloudy", "Overcast"][code - 1] ?? "Cloudy", bucket: "cloud" };
  if (code === 45 || code === 48) return { label: "Fog", bucket: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", bucket: "drizzle" };
  if (code >= 61 && code <= 67) return { label: "Rain", bucket: "rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", bucket: "snow" };
  if (code >= 80 && code <= 82) return { label: "Rain Showers", bucket: "rain" };
  if (code === 85 || code === 86) return { label: "Snow Showers", bucket: "snow" };
  if (code >= 95 && code <= 99) return { label: "Thunderstorm", bucket: "thunderstorm" };
  return { label: "Unknown", bucket: "clear" };
}

function deriveSeverity(bucket: string, visibilityMeters: number | null): WeatherResponse["severity"] {
  if (bucket === "thunderstorm" || bucket === "snow") return "POOR";
  if (visibilityMeters !== null && visibilityMeters < 2000) return "POOR";
  if (bucket === "rain" || bucket === "drizzle" || bucket === "fog") return "MODERATE";
  if (visibilityMeters !== null && visibilityMeters < 5000) return "MODERATE";
  return "CLEAR";
}

function fallback(message: string, city: string | null): WeatherResponse {
  return {
    provider: "FALLBACK",
    connected: false,
    fallback: true,
    keyConfigured: true,  // Open-Meteo needs no key; "configured" is N/A but UI expects this field.
    city,
    temperatureC: null,
    feelsLikeC: null,
    condition: "Unknown",
    conditionCode: null,
    visibilityMeters: null,
    windSpeedKmh: null,
    humidityPct: null,
    severity: "CLEAR",
    message,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch current weather for the active zone via Open-Meteo. Cached for 10 min.
 * Shared between /api/weather and the traffic-risk calculator.
 */
export async function fetchWeather(ctx: SystemContext): Promise<WeatherResponse> {
  const zone = await ctx.prisma.operationZone.findFirst();
  const city = zone?.city ?? null;
  if (!zone) return fallback("No operation zone configured — add one in Configuration Center.", city);

  const latlon = `${zone.centerLatitude.toFixed(3)},${zone.centerLongitude.toFixed(3)}`;
  if (cache && cache.latlon === latlon && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.payload;
  }

  try {
    const base = process.env["OPENMETEO_BASE_URL"] ?? "https://api.open-meteo.com";
    const params = new URLSearchParams({
      latitude:  String(zone.centerLatitude),
      longitude: String(zone.centerLongitude),
      current:   "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
      hourly:    "visibility",
      forecast_hours: "1",
      wind_speed_unit: "kmh",
      timezone:  "auto",
    });
    const url = `${base}/v1/forecast?${params.toString()}`;
    const resp = await fetch(url);
    if (!resp.ok) return fallback(`Open-Meteo returned ${resp.status}`, city);

    const data = await resp.json() as {
      current?: {
        temperature_2m?: number;
        apparent_temperature?: number;
        relative_humidity_2m?: number;
        weather_code?: number;
        wind_speed_10m?: number;
      };
      hourly?: { visibility?: number[] };
    };

    const code = data.current?.weather_code ?? 0;
    const { label, bucket } = describeWeatherCode(code);
    const visibility = data.hourly?.visibility?.[0] ?? null;

    const payload: WeatherResponse = {
      provider: "OPEN-METEO",
      connected: true,
      fallback: false,
      keyConfigured: true,
      city,
      temperatureC: data.current?.temperature_2m ?? null,
      feelsLikeC:   data.current?.apparent_temperature ?? null,
      condition: label,
      conditionCode: code,
      visibilityMeters: visibility,
      windSpeedKmh: data.current?.wind_speed_10m != null ? Math.round(data.current.wind_speed_10m) : null,
      humidityPct: data.current?.relative_humidity_2m ?? null,
      severity: deriveSeverity(bucket, visibility),
      message: `${label}${data.current?.temperature_2m != null ? ` @ ${Math.round(data.current.temperature_2m)}°C` : ""}`,
      fetchedAt: new Date().toISOString(),
    };

    cache = { fetchedAt: Date.now(), latlon, payload };
    return payload;
  } catch (err) {
    return fallback(`Weather fetch failed: ${err instanceof Error ? err.message : String(err)}`, city);
  }
}

export function createWeatherRoutes(ctx: SystemContext): Router {
  const router = Router();
  router.get("/", async (_req, res) => {
    const payload = await fetchWeather(ctx);
    res.json(payload);
  });
  return router;
}
