const EVENT_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  VehicleDetectedEvent: { label: "VehicleDetected",  cls: "badge-cyan",   dot: "🚗" },
  SpeedViolationEvent:  { label: "SpeedViolation",   cls: "badge-red",    dot: "⚡" },
  CongestionAlertEvent: { label: "CongestionAlert",  cls: "badge-yellow", dot: "🚦" },
  TrafficClearedEvent:  { label: "TrafficCleared",   cls: "badge-green",  dot: "✅" },
  EmergencyVehicleEvent:{ label: "EmergencyVehicle", cls: "badge-purple", dot: "🚨" },
};

interface EventTypeBadgeProps {
  type: string;
}

export function EventTypeBadge({ type }: EventTypeBadgeProps) {
  const cfg = EVENT_CONFIG[type] ?? { label: type, cls: "badge-gray", dot: "📌" };
  return (
    <span className={`badge ${cfg.cls}`}>
      {cfg.dot} {cfg.label}
    </span>
  );
}
