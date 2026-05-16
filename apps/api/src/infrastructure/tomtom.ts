import type { PrismaClient } from "@prisma/client";

/**
 * Shared TomTom client. Used by:
 *   - external.routes.ts          — on-demand HTTP calls
 *   - IncidentService             — second-opinion confirmation for opened incidents
 *   - traffic-risk endpoint       — risk-bump signals
 *   - TomTomPoller (background)   — periodic snapshot refresh
 *
 * Always returns either a typed payload or a `fallback: true` shape — never
 * throws into the caller. Persists every successful call to
 * ExternalTrafficSnapshot so the Command Center can show recent history.
 */

export interface TomTomFlow {
  available: boolean;
  currentSpeed: number | null;
  freeFlowSpeed: number | null;
  confidence: number | null;
  roadClosure: boolean;
  ratio: number | null;       // currentSpeed / freeFlowSpeed
  severity: "CLEAR" | "MODERATE" | "POOR";
  summary: string;
  fallbackReason?: string;
}

export interface TomTomIncidents {
  available: boolean;
  count: number;
  summary: string;
  topIncidents: Array<{ type?: string; from?: string; to?: string; delay?: number; description?: string }>;
  fallbackReason?: string;
}

function severityFromRatio(ratio: number | null): TomTomFlow["severity"] {
  if (ratio === null) return "CLEAR";
  if (ratio < 0.5) return "POOR";        // severe congestion
  if (ratio < 0.8) return "MODERATE";    // noticeable slow-down
  return "CLEAR";
}

async function preflightConfig(prisma: PrismaClient) {
  const key = process.env["TOMTOM_API_KEY"];
  const config = await prisma.externalProviderConfig.findFirst({ include: { zone: true } });
  const enabled = !!key && !!config?.enabled && !!config.zone;
  return { key, config, enabled };
}

/** Fetch current traffic flow at the active zone's center. Persists a snapshot on success. */
export async function fetchTomTomFlow(prisma: PrismaClient): Promise<TomTomFlow> {
  const { key, config, enabled } = await preflightConfig(prisma);
  if (!enabled) {
    return {
      available: false, currentSpeed: null, freeFlowSpeed: null, confidence: null,
      roadClosure: false, ratio: null, severity: "CLEAR",
      summary: "TomTom unavailable (key missing or provider disabled)",
      fallbackReason: !key ? "TOMTOM_API_KEY not set" : !config?.enabled ? "provider disabled" : "no active zone",
    };
  }

  try {
    const baseUrl = process.env["TOMTOM_BASE_URL"] ?? "https://api.tomtom.com";
    const lat = config!.zone!.centerLatitude;
    const lon = config!.zone!.centerLongitude;
    const url = `${baseUrl}/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&key=${key}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return { available: false, currentSpeed: null, freeFlowSpeed: null, confidence: null, roadClosure: false, ratio: null, severity: "CLEAR", summary: `TomTom flow HTTP ${resp.status}`, fallbackReason: `status=${resp.status}` };
    }
    const data = await resp.json() as { flowSegmentData?: { currentSpeed?: number; freeFlowSpeed?: number; confidence?: number; roadClosure?: boolean } };
    const flow = data.flowSegmentData;
    const currentSpeed = flow?.currentSpeed ?? null;
    const freeFlowSpeed = flow?.freeFlowSpeed ?? null;
    const ratio = currentSpeed != null && freeFlowSpeed != null && freeFlowSpeed > 0
      ? currentSpeed / freeFlowSpeed
      : null;
    const severity = severityFromRatio(ratio);
    const summary = currentSpeed != null && freeFlowSpeed != null
      ? `${currentSpeed} km/h vs free-flow ${freeFlowSpeed} km/h${ratio != null ? ` (${Math.round(ratio * 100)}%)` : ""}`
      : "No flow data available";

    // Persist + mark provider connected (best-effort).
    await prisma.externalProviderConfig.update({
      where: { id: config!.id },
      data: { lastStatus: "CONNECTED", lastCheckedAt: new Date() },
    }).catch(() => undefined);
    await prisma.externalTrafficSnapshot.create({
      data: {
        provider: "TOMTOM",
        areaName: config!.zone!.name,
        latitude: lat,
        longitude: lon,
        snapshotType: "FLOW",
        riskLevel: severity === "POOR" ? "HIGH" : severity === "MODERATE" ? "MEDIUM" : "LOW",
        rawPayload: JSON.stringify(flow ?? {}),
        summary,
        fallback: false,
      },
    }).catch(err => console.error("[tomtom] flow snapshot persist failed", err));

    return {
      available: true,
      currentSpeed,
      freeFlowSpeed,
      confidence: flow?.confidence ?? null,
      roadClosure: flow?.roadClosure ?? false,
      ratio,
      severity,
      summary,
    };
  } catch (err) {
    return { available: false, currentSpeed: null, freeFlowSpeed: null, confidence: null, roadClosure: false, ratio: null, severity: "CLEAR", summary: "TomTom flow fetch failed", fallbackReason: err instanceof Error ? err.message : String(err) };
  }
}

/** Fetch externally-reported incidents in the active zone's bounding box. Persists a snapshot on success. */
export async function fetchTomTomIncidents(prisma: PrismaClient): Promise<TomTomIncidents> {
  const { key, config, enabled } = await preflightConfig(prisma);
  if (!enabled) {
    return { available: false, count: 0, summary: "TomTom unavailable", topIncidents: [], fallbackReason: !key ? "TOMTOM_API_KEY not set" : "provider disabled" };
  }

  try {
    const baseUrl = process.env["TOMTOM_BASE_URL"] ?? "https://api.tomtom.com";
    const z = config!.zone!;
    const bbox = `${z.bboxMinLatitude ?? z.centerLatitude - 0.05},${z.bboxMinLongitude ?? z.centerLongitude - 0.05},${z.bboxMaxLatitude ?? z.centerLatitude + 0.05},${z.bboxMaxLongitude ?? z.centerLongitude + 0.05}`;
    const url = `${baseUrl}/traffic/services/5/incidentDetails?bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to}}}&language=en-US&key=${key}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      return { available: false, count: 0, summary: `TomTom incidents HTTP ${resp.status}`, topIncidents: [], fallbackReason: `status=${resp.status}` };
    }
    const data = await resp.json() as { incidents?: Array<{ type?: string; properties?: { from?: string; to?: string; magnitudeOfDelay?: number; events?: Array<{ description?: string }> } }> };
    const incidents = data.incidents ?? [];
    const summary = `${incidents.length} external incident(s) reported in ${z.name}`;

    await prisma.externalTrafficSnapshot.create({
      data: {
        provider: "TOMTOM",
        areaName: z.name,
        latitude: z.centerLatitude,
        longitude: z.centerLongitude,
        snapshotType: "INCIDENT",
        riskLevel: incidents.length > 5 ? "HIGH" : incidents.length > 0 ? "MEDIUM" : "LOW",
        rawPayload: JSON.stringify(incidents.slice(0, 20)),
        summary,
        fallback: false,
      },
    }).catch(err => console.error("[tomtom] incident snapshot persist failed", err));

    return {
      available: true,
      count: incidents.length,
      summary,
      topIncidents: incidents.slice(0, 5).map(inc => ({
        type: inc.type,
        from: inc.properties?.from,
        to: inc.properties?.to,
        delay: inc.properties?.magnitudeOfDelay,
        description: inc.properties?.events?.[0]?.description ?? "Unknown incident",
      })),
    };
  } catch (err) {
    return { available: false, count: 0, summary: "TomTom incidents fetch failed", topIncidents: [], fallbackReason: err instanceof Error ? err.message : String(err) };
  }
}

/** Combined corroboration signal. POOR severity OR ≥1 incident → "TomTom confirms" the local picture. */
export interface TomTomCorroboration {
  available: boolean;
  confirms: boolean;
  severity: TomTomFlow["severity"];
  incidentCount: number;
  summary: string;
}

export async function fetchTomTomCorroboration(prisma: PrismaClient): Promise<TomTomCorroboration> {
  const [flow, inc] = await Promise.all([fetchTomTomFlow(prisma), fetchTomTomIncidents(prisma)]);
  const available = flow.available || inc.available;
  if (!available) {
    return { available: false, confirms: false, severity: "CLEAR", incidentCount: 0, summary: "TomTom unavailable" };
  }
  const confirms = flow.severity !== "CLEAR" || inc.count > 0;
  return {
    available: true,
    confirms,
    severity: flow.severity,
    incidentCount: inc.count,
    summary: confirms
      ? `TomTom: ${flow.summary}; ${inc.summary}`
      : `TomTom: ${flow.summary}; no incidents`,
  };
}
