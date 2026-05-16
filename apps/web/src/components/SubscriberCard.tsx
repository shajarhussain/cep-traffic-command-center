import type { SubscriberInfo } from "../api/client.js";
import { formatEventType } from "../utils/formatters.js";

const SUBSCRIBER_ICONS: Record<string, string> = {
  AlertService:     "🚨",
  LoggingService:   "📋",
  DashboardService: "📊",
  ReportingService: "📈",
};

const SUBSCRIBER_DESCRIPTIONS: Record<string, string> = {
  AlertService:     "Creates penalty notices for speed violations",
  LoggingService:   "Writes audit logs for key events",
  DashboardService: "Updates live intersection status",
  ReportingService: "Aggregates event counts by type & camera",
};

interface SubscriberCardProps {
  subscriber: SubscriberInfo;
}

export function SubscriberCard({ subscriber }: SubscriberCardProps) {
  const icon = SUBSCRIBER_ICONS[subscriber.name] ?? "🔌";
  const desc = SUBSCRIBER_DESCRIPTIONS[subscriber.name] ?? "";

  return (
    <div className="subscriber-card">
      <div className="subscriber-name" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span className="subscriber-name-icon">{icon}</span>
          {subscriber.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="heartbeat" style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--status-green)', borderRadius: '50%' }}></span>
          <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--status-green)' }}>Active</span>
        </div>
      </div>
      <div className="subscriber-meta">{desc}</div>

      <div className="subscriber-stats">
        <div className="subscriber-stat">
          <div className="subscriber-stat-value text-blue">
            {subscriber.processedCount}
          </div>
          <div className="subscriber-stat-label">Processed</div>
        </div>
        <div className="subscriber-stat">
          <div
            className="subscriber-stat-value"
            style={{
              color:
                subscriber.duplicateIgnoredCount > 0
                  ? "var(--accent-yellow)"
                  : "var(--text-muted)",
            }}
          >
            {subscriber.duplicateIgnoredCount}
          </div>
          <div className="subscriber-stat-label">Dupes Ignored</div>
        </div>
      </div>

      <div className="card-section-label">Subscribed Events</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {subscriber.supportedEventTypes.map((t) => (
          <span key={t} className="badge badge-gray">{formatEventType(t)}</span>
        ))}
      </div>

      <div className="pattern-box" style={{ marginTop: "16px", padding: "10px 12px", background: "var(--bg-dark)", borderLeft: "2px solid var(--accent-cyan)" }}>
        <div className="pattern-box-title" style={{ fontSize: "10px", color: "var(--accent-cyan)" }}>
          Event Bus Independence
        </div>
        <div className="pattern-box-text" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: 4 }}>
          Cameras publish once → each service receives independently.
        </div>
      </div>
    </div>
  );
}
