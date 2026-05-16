import { Router } from "express";
import { EVENT_TYPES } from "../../domain/events/EventTypes.js";

/**
 * /api/event-types — catalog endpoint.
 *
 * Single source of truth for the UI's event-type, severity, and status
 * dropdowns. By driving every dropdown through this endpoint we preserve
 * CEP Task 1's "zero-change extensibility" promise on the UI side too —
 * adding a 5th event type to EVENT_TYPES.ts makes it appear in every
 * select without further code changes.
 */
export function createEventTypesRoutes(): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({
      eventTypes: Object.values(EVENT_TYPES).map(code => ({
        code,
        label: humanize(code),
      })),
      severities: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
      statuses: {
        camera:   ["ACTIVE", "INACTIVE"],
        incident: ["OPEN", "ACKNOWLEDGED", "CLEARED"],
        outbox:   ["PENDING", "PUBLISHED", "FAILED"],
        penalty:  ["ISSUED", "PAID", "CANCELLED"],
      },
    });
  });

  return router;
}

function humanize(code: string): string {
  // "SpeedViolationEvent" → "Speed Violation"
  return code
    .replace(/Event$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
}
