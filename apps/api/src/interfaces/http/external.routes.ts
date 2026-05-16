import { Router } from "express";
import type { SystemContext } from "../../application/systemContext.js";
import { fetchWeather } from "./weather.routes.js";
import { fetchTomTomCorroboration } from "../../infrastructure/tomtom.js";

/**
 * External traffic context routes.
 * Uses TomTom Traffic API when configured, otherwise returns fallback data.
 * TomTom API key is read from process.env.TOMTOM_API_KEY — never exposed to frontend.
 */
export function createExternalRoutes(ctx: SystemContext): Router {
  const router = Router();

  // GET /api/external/context-status
  router.get("/context-status", async (_req, res) => {
    try {
      const config = await ctx.prisma.externalProviderConfig.findFirst({ include: { zone: true } });
      const keyConfigured = !!process.env["TOMTOM_API_KEY"];
      const enabled = config?.enabled ?? false;

      res.json({
        provider: config?.provider ?? "TOMTOM",
        connected: enabled && keyConfigured,
        fallback: !enabled || !keyConfigured,
        keyConfigured,
        activeZone: config?.zone ? { name: config.zone.name, city: config.zone.city } : null,
        area: config?.zone?.name ?? "Islamabad Traffic Zone",
        lastChecked: config?.lastCheckedAt?.toISOString() ?? null,
        lastStatus: config?.lastStatus ?? "NOT_CONFIGURED",
        message: !keyConfigured
          ? "TomTom API key not configured. Using fallback mode."
          : !enabled
            ? "External provider disabled. Enable in Configuration Center."
            : "Connected to external traffic provider.",
      });
    } catch (err) {
      console.error(err);
      res.json({
        provider: "TOMTOM",
        connected: false,
        fallback: true,
        keyConfigured: false,
        activeZone: null,
        area: "Islamabad Traffic Zone",
        lastChecked: null,
        lastStatus: "ERROR",
        message: "Failed to check external provider status.",
      });
    }
  });

  // GET /api/external/traffic-flow
  router.get("/traffic-flow", async (_req, res) => {
    try {
      const config = await ctx.prisma.externalProviderConfig.findFirst({ include: { zone: true } });
      const key = process.env["TOMTOM_API_KEY"];
      const enabled = config?.enabled && !!key;

      if (enabled && config?.zone) {
        try {
          const baseUrl = process.env["TOMTOM_BASE_URL"] ?? "https://api.tomtom.com";
          const lat = config.zone.centerLatitude;
          const lon = config.zone.centerLongitude;
          const url = `${baseUrl}/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&key=${key}`;
          const resp = await fetch(url);
          if (resp.ok) {
            const data = await resp.json() as any;
            const flow = data?.flowSegmentData;
            await ctx.prisma.externalProviderConfig.update({
              where: { id: config.id },
              data: { lastStatus: "CONNECTED", lastCheckedAt: new Date() },
            });
            const summary = flow ? `Current speed ${flow.currentSpeed} km/h (free flow: ${flow.freeFlowSpeed} km/h)` : "No flow data available";
            const riskLevel = flow && flow.freeFlowSpeed > 0
              ? (flow.currentSpeed / flow.freeFlowSpeed < 0.5 ? "HIGH" : flow.currentSpeed / flow.freeFlowSpeed < 0.8 ? "MEDIUM" : "LOW")
              : "UNKNOWN";
            // Persist the snapshot so the Command Center can show recent history.
            await ctx.prisma.externalTrafficSnapshot.create({
              data: {
                provider: "TOMTOM",
                areaName: config.zone.name,
                latitude: lat,
                longitude: lon,
                snapshotType: "FLOW",
                riskLevel,
                rawPayload: JSON.stringify(flow ?? {}),
                summary,
                fallback: false,
              },
            }).catch(err => console.error("[external] snapshot persist failed", err));
            return res.json({
              provider: "TOMTOM",
              fallback: false,
              area: config.zone.name,
              currentSpeed: flow?.currentSpeed ?? null,
              freeFlowSpeed: flow?.freeFlowSpeed ?? null,
              confidence: flow?.confidence ?? null,
              roadClosure: flow?.roadClosure ?? false,
              summary,
              fetched_at: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error("TomTom flow error:", e);
        }
      }

      // Fallback
      res.json({
        provider: "FALLBACK",
        fallback: true,
        area: config?.zone?.name ?? "Islamabad Traffic Zone",
        currentSpeed: null,
        freeFlowSpeed: null,
        confidence: null,
        roadClosure: false,
        summary: "External traffic flow data not available. Using internal alerts only.",
        fetched_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
      res.json({ provider: "FALLBACK", fallback: true, summary: "Error fetching traffic flow." });
    }
  });

  // GET /api/external/traffic-incidents
  router.get("/traffic-incidents", async (_req, res) => {
    try {
      const config = await ctx.prisma.externalProviderConfig.findFirst({ include: { zone: true } });
      const key = process.env["TOMTOM_API_KEY"];
      const enabled = config?.enabled && !!key;

      if (enabled && config?.zone) {
        try {
          const baseUrl = process.env["TOMTOM_BASE_URL"] ?? "https://api.tomtom.com";
          const z = config.zone;
          const bbox = `${z.bboxMinLatitude ?? z.centerLatitude - 0.05},${z.bboxMinLongitude ?? z.centerLongitude - 0.05},${z.bboxMaxLatitude ?? z.centerLatitude + 0.05},${z.bboxMaxLongitude ?? z.centerLongitude + 0.05}`;
          const url = `${baseUrl}/traffic/services/5/incidentDetails?bbox=${bbox}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to}}}&language=en-US&key=${key}`;
          const resp = await fetch(url);
          if (resp.ok) {
            const data = await resp.json() as any;
            const incidents = data?.incidents ?? [];
            await ctx.prisma.externalProviderConfig.update({
              where: { id: config.id },
              data: { lastStatus: "CONNECTED", lastCheckedAt: new Date() },
            });
            const summary = `${incidents.length} external incident(s) reported in ${z.name}`;
            const riskLevel = incidents.length > 5 ? "HIGH" : incidents.length > 0 ? "MEDIUM" : "LOW";
            await ctx.prisma.externalTrafficSnapshot.create({
              data: {
                provider: "TOMTOM",
                areaName: z.name,
                latitude: z.centerLatitude,
                longitude: z.centerLongitude,
                snapshotType: "INCIDENT",
                riskLevel,
                rawPayload: JSON.stringify(incidents.slice(0, 20)),
                summary,
                fallback: false,
              },
            }).catch(err => console.error("[external] incident-snapshot persist failed", err));
            return res.json({
              provider: "TOMTOM",
              fallback: false,
              area: z.name,
              incidentCount: incidents.length,
              incidents: incidents.slice(0, 20).map((inc: any) => ({
                type: inc.type,
                from: inc.properties?.from,
                to: inc.properties?.to,
                delay: inc.properties?.magnitudeOfDelay,
                description: inc.properties?.events?.[0]?.description ?? "Unknown incident",
              })),
              summary,
              fetched_at: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.error("TomTom incidents error:", e);
        }
      }

      // Fallback
      res.json({
        provider: "FALLBACK",
        fallback: true,
        area: config?.zone?.name ?? "Islamabad Traffic Zone",
        incidentCount: 0,
        incidents: [],
        summary: "External incident data not available. Using internal incident tracking only.",
        fetched_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error(err);
      res.json({ provider: "FALLBACK", fallback: true, incidentCount: 0, incidents: [], summary: "Error" });
    }
  });

  // GET /api/external/snapshots — recent persisted ExternalTrafficSnapshot rows
  router.get("/snapshots", async (req, res) => {
    try {
      const limit = Math.min(parseInt((req.query["limit"] as string) ?? "20", 10) || 20, 200);
      const rows = await ctx.prisma.externalTrafficSnapshot.findMany({
        orderBy: { fetchedAt: "desc" },
        take: limit,
      });
      res.json(rows.map(r => ({
        id: r.id,
        provider: r.provider,
        areaName: r.areaName,
        latitude: r.latitude,
        longitude: r.longitude,
        snapshotType: r.snapshotType,
        riskLevel: r.riskLevel,
        summary: r.summary,
        fallback: r.fallback,
        fetchedAt: r.fetchedAt.toISOString(),
      })));
    } catch (err) {
      console.error("[external] snapshots list failed", err);
      res.status(500).json({ error: "Failed to load external snapshots" });
    }
  });

  return router;
}

/**
 * Traffic risk endpoint — combines internal + external context.
 */
export function createTrafficRiskRoutes(ctx: SystemContext): Router {
  const router = Router();

  const RISK_LADDER = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  const bumpRisk = (current: string, by: number): string => {
    const idx = RISK_LADDER.indexOf(current as typeof RISK_LADDER[number]);
    if (idx === -1) return current;
    return RISK_LADDER[Math.min(RISK_LADDER.length - 1, idx + by)];
  };

  router.get("/", async (_req, res) => {
    try {
      const [openIncidents, criticalIncidents, queuePolicy, externalConfig, weather, tomtom] = await Promise.all([
        ctx.prisma.trafficIncident.count({ where: { status: "OPEN" } }),
        ctx.prisma.trafficIncident.count({ where: { status: "OPEN", severity: "CRITICAL" } }),
        ctx.prisma.queuePolicy.findFirst({ where: { active: true } }),
        ctx.prisma.externalProviderConfig.findFirst(),
        fetchWeather(ctx),
        fetchTomTomCorroboration(ctx.prisma),
      ]);

      const inRate = queuePolicy?.incomingRate ?? 500;
      const procRate = queuePolicy?.processingRate ?? 80;
      const qLimit = queuePolicy?.queueLimit ?? 10000;
      const backlog = inRate - procRate;
      const secondsUntilFull = backlog > 0 ? Math.round((qLimit / backlog) * 100) / 100 : Infinity;

      const reasons: string[] = [];
      if (criticalIncidents > 0) reasons.push(`${criticalIncidents} critical incident(s) open`);
      if (openIncidents > 3) reasons.push(`High incident volume: ${openIncidents} open`);
      if (secondsUntilFull < 30) reasons.push(`Queue saturation in ${secondsUntilFull}s`);

      let overallRisk = "LOW";
      if (criticalIncidents > 0 || secondsUntilFull < 30) overallRisk = "CRITICAL";
      else if (openIncidents > 3 || secondsUntilFull < 60) overallRisk = "HIGH";
      else if (openIncidents > 1 || secondsUntilFull < 120) overallRisk = "MEDIUM";

      // Weather bump: POOR conditions raise risk by one level; MODERATE by half a level
      // (still observable on LOW). Documented in reasons[] so the UI can show why.
      if (weather.severity === "POOR") {
        const before = overallRisk;
        overallRisk = bumpRisk(overallRisk, 1);
        if (overallRisk !== before) reasons.push(`Weather (${weather.condition}) raised risk to ${overallRisk}`);
        else reasons.push(`Severe weather: ${weather.condition}`);
      } else if (weather.severity === "MODERATE" && overallRisk === "LOW") {
        overallRisk = "MEDIUM";
        reasons.push(`Reduced visibility: ${weather.condition}`);
      }

      // TomTom bump: mirrors weather. POOR flow OR ≥4 external incidents in the zone
      // raises risk one level; MODERATE flow promotes a LOW risk to MEDIUM. Surfaces
      // in reasons[] so the Risk Assessment card shows the external corroboration.
      if (tomtom.available) {
        if (tomtom.severity === "POOR" || tomtom.incidentCount > 3) {
          const before = overallRisk;
          overallRisk = bumpRisk(overallRisk, 1);
          if (overallRisk !== before) reasons.push(`TomTom raised risk to ${overallRisk}: ${tomtom.summary}`);
          else                       reasons.push(`TomTom corroborates: ${tomtom.summary}`);
        } else if (tomtom.severity === "MODERATE" && overallRisk === "LOW") {
          overallRisk = "MEDIUM";
          reasons.push(`TomTom: noticeable slow-down — ${tomtom.summary}`);
        }
      }

      let recommendation = "Normal operations. Continue monitoring.";
      if (overallRisk === "CRITICAL") recommendation = "Immediate attention required. Dispatch response team.";
      else if (overallRisk === "HIGH") recommendation = "Elevated risk. Monitor closely and prepare response.";
      else if (overallRisk === "MEDIUM") recommendation = "Moderate activity. Standard monitoring advised.";

      res.json({
        overallRisk,
        reasons,
        recommendation,
        externalProviderStatus: externalConfig?.enabled ? externalConfig.lastStatus : "DISABLED",
        queueSecondsUntilFull: secondsUntilFull,
        openIncidentCount: openIncidents,
        criticalIncidentCount: criticalIncidents,
        fallback: !externalConfig?.enabled,
        weather: {
          severity: weather.severity,
          condition: weather.condition,
          temperatureC: weather.temperatureC,
          fallback: weather.fallback,
        },
        tomtom: {
          available: tomtom.available,
          severity: tomtom.severity,
          incidentCount: tomtom.incidentCount,
          summary: tomtom.summary,
        },
      });
    } catch (err) {
      console.error(err);
      res.json({ overallRisk: "UNKNOWN", reasons: ["Error calculating risk"], recommendation: "Check system health.", fallback: true });
    }
  });

  return router;
}
