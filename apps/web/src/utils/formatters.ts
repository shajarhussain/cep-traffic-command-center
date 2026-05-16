export function formatEventType(eventType: string): string {
  switch (eventType) {
    case "VehicleDetectedEvent": return "Vehicle Detected";
    case "SpeedViolationEvent": return "Speed Violation";
    case "CongestionAlertEvent": return "Congestion Alert";
    case "TrafficClearedEvent": return "Traffic Cleared";
    case "SPEED_INCIDENT": return "Speed Incident";
    case "CONGESTION_INCIDENT": return "Congestion Incident";
    default: return eventType.replace(/Event$/, "").replace(/([A-Z])/g, " $1").trim();
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "var(--red)";
    case "HIGH": return "var(--amber)";
    case "MEDIUM": return "var(--blue)";
    case "LOW": return "var(--cyan)";
    case "INFO": return "var(--green)";
    default: return "var(--text-muted)";
  }
}

export function getSeverityClass(severity: string): string {
  switch (severity) {
    case "CRITICAL": return "sev-critical";
    case "HIGH": return "sev-high";
    case "MEDIUM": return "sev-medium";
    case "LOW": return "sev-low";
    case "INFO": return "sev-info";
    default: return "badge-muted";
  }
}

export function getEventBadgeClass(eventType: string): string {
  switch (eventType) {
    case "SpeedViolationEvent": return "badge-red";
    case "CongestionAlertEvent": return "badge-amber";
    case "TrafficClearedEvent": return "badge-green";
    case "VehicleDetectedEvent": return "badge-cyan";
    default: return "badge-muted";
  }
}

export function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function calculateSeverity(eventType: string, payload: any): string {
  switch (eventType) {
    case "SpeedViolationEvent": {
      const excess = (payload?.speed_kmh || 0) - (payload?.speed_limit_kmh || 0);
      if (excess > 25) return "HIGH";
      if (excess >= 10) return "MEDIUM";
      return "LOW";
    }
    case "CongestionAlertEvent": return (payload?.congestion_level || "HIGH").toUpperCase();
    case "VehicleDetectedEvent": return "LOW";
    case "TrafficClearedEvent": return "INFO";
    default: return "UNKNOWN";
  }
}
