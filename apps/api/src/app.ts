import express from "express";
import cors from "cors";
import type { SystemContext } from "./application/systemContext.js";
import { createCameraRoutes } from "./interfaces/http/camera.routes.js";
import { createEventRoutes } from "./interfaces/http/event.routes.js";
import { createSubscriberRoutes } from "./interfaces/http/subscriber.routes.js";
import { createPenaltyRoutes } from "./interfaces/http/penalty.routes.js";
import { createLogRoutes } from "./interfaces/http/log.routes.js";
import { createReportRoutes } from "./interfaces/http/report.routes.js";
import { createDashboardRoutes } from "./interfaces/http/dashboard.routes.js";
import { createQueueRoutes } from "./interfaces/http/queue.routes.js";
import { createSummaryRoutes } from "./interfaces/http/summary.routes.js";
import { createIncidentRoutes } from "./interfaces/http/incident.routes.js";
import { createOutboxRoutes } from "./interfaces/http/outbox.routes.js";
import { createConfigRoutes } from "./interfaces/http/config.routes.js";
import { createExternalRoutes, createTrafficRiskRoutes } from "./interfaces/http/external.routes.js";
import { createWeatherRoutes } from "./interfaces/http/weather.routes.js";
import { createFinePolicyRoutes } from "./interfaces/http/fine-policy.routes.js";
import { createMetricsRoutes } from "./interfaces/http/metrics.routes.js";
import { createEventTypesRoutes } from "./interfaces/http/event-types.routes.js";
import { createOperatorActionRoutes } from "./interfaces/http/operator-action.routes.js";
import { createAdminRoutes } from "./interfaces/http/admin.routes.js";

/**
 * Creates and configures the Express application.
 * Receives a SystemContext so route files stay thin.
 */
export function createApp(ctx: SystemContext) {
  const app = express();

  // --- Middleware ---
  app.use(cors({ origin: process.env["WEB_ORIGIN"] ?? "http://localhost:5173" }));
  app.use(express.json());

  // --- Health check ---
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // --- Original CEP routes ---
  app.use("/api/cameras", createCameraRoutes(ctx));
  app.use("/api/events", createEventRoutes(ctx));
  app.use("/api/subscribers", createSubscriberRoutes(ctx));
  app.use("/api/penalties", createPenaltyRoutes(ctx));
  app.use("/api/audit-logs", createLogRoutes(ctx));
  app.use("/api/reports", createReportRoutes(ctx));
  app.use("/api/dashboard", createDashboardRoutes(ctx));
  app.use("/api/queue", createQueueRoutes(ctx));
  app.use("/api/summary", createSummaryRoutes(ctx));
  app.use("/api/incidents", createIncidentRoutes(ctx));
  app.use("/api/outbox", createOutboxRoutes(ctx));

  // --- V2 Configuration routes ---
  app.use("/api/config", createConfigRoutes(ctx));
  app.use("/api/config/fine-policies", createFinePolicyRoutes(ctx));

  // --- V2 External traffic context ---
  app.use("/api/external", createExternalRoutes(ctx));
  app.use("/api/traffic-risk", createTrafficRiskRoutes(ctx));
  app.use("/api/weather", createWeatherRoutes(ctx));

  // --- V3 Metrics & observability ---
  app.use("/api/metrics", createMetricsRoutes(ctx));

  // --- V3 Event-type catalog (single source of truth for UI dropdowns) ---
  app.use("/api/event-types", createEventTypesRoutes());

  // --- V3 Operator action audit (every high-signal mutation is logged here) ---
  app.use("/api/operator-actions", createOperatorActionRoutes(ctx));

  // --- V3 Admin (destructive runtime resets) ---
  app.use("/api/admin", createAdminRoutes(ctx));

  return app;
}
