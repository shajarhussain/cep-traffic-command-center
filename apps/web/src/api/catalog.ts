/**
 * Module-level cache for /api/event-types. The catalog is the single source
 * of truth for every event-type / severity / status dropdown in the UI.
 *
 * One fetch per page lifetime. Components that need the catalog should call
 * `useCatalog()` from EventTypeSelect.tsx instead of calling fetchCatalog
 * directly so React renders update cleanly when the catalog arrives.
 */

const BASE = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "http://localhost:4000";

export interface EventTypeOption { code: string; label: string; }
export interface Catalog {
  eventTypes: EventTypeOption[];
  severities: string[];
  statuses: {
    camera:   string[];
    incident: string[];
    outbox:   string[];
    penalty:  string[];
  };
}

const FALLBACK: Catalog = {
  eventTypes: [
    { code: "VehicleDetectedEvent",   label: "Vehicle Detected"   },
    { code: "SpeedViolationEvent",    label: "Speed Violation"    },
    { code: "CongestionAlertEvent",   label: "Congestion Alert"   },
    { code: "TrafficClearedEvent",    label: "Traffic Cleared"    },
  ],
  severities: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
  statuses: {
    camera:   ["ACTIVE", "INACTIVE"],
    incident: ["OPEN", "ACKNOWLEDGED", "CLEARED"],
    outbox:   ["PENDING", "PUBLISHED", "FAILED"],
    penalty:  ["ISSUED", "PAID", "CANCELLED"],
  },
};

let cached: Catalog | null = null;
let inFlight: Promise<Catalog> | null = null;

export async function fetchCatalog(): Promise<Catalog> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/api/event-types`);
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json() as Catalog;
      cached = data;
      return data;
    } catch {
      // Offline or API down — return the static fallback so the UI keeps working.
      cached = FALLBACK;
      return FALLBACK;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Synchronous read for code paths that can't await — returns null until the first fetch resolves. */
export function getCachedCatalog(): Catalog | null { return cached; }

/** Test-only: clear the cache between runs. */
export function __resetCatalog(): void { cached = null; inFlight = null; }
