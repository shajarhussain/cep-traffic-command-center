import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { DashboardSnapshot, QueueAnalysis, ExternalContextStatus, SystemMetrics } from "../api/client.js";
import { Icon } from "../components/Icon.js";
import { TrafficLight } from "../components/TrafficLight.js";

export function ReliabilityPage() {
  const [snapshots, setSnapshots] = useState<DashboardSnapshot[]>([]);
  const [queue, setQueue] = useState<QueueAnalysis | null>(null);
  const [ext, setExt] = useState<ExternalContextStatus | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => Promise.all([
      api.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false)),
      api.dashboard().then(setSnapshots).catch(() => {}),
      api.queueAnalysis().then(setQueue).catch(() => {}),
      api.externalStatus().then(setExt).catch(() => {}),
      api.metrics().then(setMetrics).catch(() => {}),
    ]).finally(() => setLoading(false));
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, []);

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading System Reliability…</div></div>;

  const totalEvents = snapshots.reduce((s, p) => s + (p.vehicle_count ?? 0), 0);

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title"><Icon name="shield" size={22} /> System Reliability</h1>
        <p className="page-desc">Core service health, external dependencies, and system telemetry</p>
      </div>

      <div className="grid-2 gap-16 mb-16">
        <div className="card">
          <div className="card-header"><div className="card-title">Core Services</div></div>
          <div style={{ display: "grid", gap: 12 }}>
            <div className="service-card">
              <TrafficLight level={apiOnline ? "green" : "red"} label={apiOnline ? "Operational" : "Down"} />
              <div style={{ flex: 1 }}>
                <div className="fw-500" style={{ color: "var(--text)" }}>API Gateway</div>
                <div className="text-muted" style={{ fontSize: 11 }}>REST Endpoints</div>
              </div>
              <span className={`badge ${apiOnline ? "badge-green" : "badge-red"}`}>{apiOnline ? "OPERATIONAL" : "DOWN"}</span>
            </div>
            <div className="service-card">
              <TrafficLight level="green" label="Operational" />
              <div style={{ flex: 1 }}>
                <div className="fw-500" style={{ color: "var(--text)" }}>EventBus</div>
                <div className="text-muted" style={{ fontSize: 11 }}>Pub/Sub Infrastructure</div>
              </div>
              <span className="badge badge-green">OPERATIONAL</span>
            </div>
            <div className="service-card">
              <TrafficLight level="green" label="Operational" />
              <div style={{ flex: 1 }}>
                <div className="fw-500" style={{ color: "var(--text)" }}>Database</div>
                <div className="text-muted" style={{ fontSize: 11 }}>Prisma ORM</div>
              </div>
              <span className="badge badge-green">OPERATIONAL</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Event Processing</div></div>
          <div style={{ display: "grid", gap: 12 }}>
             <div className="service-card">
              <TrafficLight level="green" label="Active" />
              <div style={{ flex: 1 }}>
                <div className="fw-500" style={{ color: "var(--text)" }}>Idempotent Subscribers</div>
                <div className="text-muted" style={{ fontSize: 11 }}>AlertService, PenaltyService</div>
              </div>
              <span className="badge badge-cyan">ACTIVE</span>
            </div>
             <div className="service-card">
              <TrafficLight level={queue && queue.secondsUntilFull > 60 ? "green" : "amber"} label={queue && queue.secondsUntilFull > 60 ? "Healthy" : "Degraded"} />
              <div style={{ flex: 1 }}>
                <div className="fw-500" style={{ color: "var(--text)" }}>Queue Processor</div>
                <div className="text-muted" style={{ fontSize: 11 }}>{queue?.processingRate ?? 0} events/sec</div>
              </div>
              <span className={`badge ${queue && queue.secondsUntilFull > 60 ? "badge-green" : "badge-amber"}`}>{queue && queue.secondsUntilFull > 60 ? "HEALTHY" : "DEGRADED"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 gap-16">
        <div className="card">
          <div className="card-header"><div className="card-title">External Dependencies</div></div>
          <div className="service-card mb-16">
            <div className={`dot ${ext?.connected ? "dot-green" : "dot-amber"}`} style={{ width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ flex: 1 }}>
              <div className="fw-500" style={{ color: "var(--text)" }}>TomTom Traffic API</div>
              <div className="text-muted" style={{ fontSize: 11 }}>External Context Provider</div>
            </div>
            <span className={`badge ${ext?.connected ? "badge-green" : "badge-amber"}`}>{ext?.connected ? "CONNECTED" : "FALLBACK MODE"}</span>
          </div>
          <div style={{ fontSize: 12, display: "grid", gap: 8 }}>
             <div style={{ display: "flex", justifyContent: "space-between" }}>
               <span className="text-sec">Status Message</span>
               <span className="text-muted">{ext?.message ?? "—"}</span>
             </div>
             <div style={{ display: "flex", justifyContent: "space-between" }}>
               <span className="text-sec">API Key Configured</span>
               <span className={ext?.keyConfigured ? "text-green" : "text-amber"}>{ext?.keyConfigured ? "Yes" : "No"}</span>
             </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">System Telemetry</div></div>
          <div className="kpi-strip" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 0 }}>
             <div className="kpi-card" style={{ padding: "12px 16px" }}>
               <div className="kpi-label">Total Telemetry Events</div>
               <div className="kpi-value text-blue">{totalEvents.toLocaleString()}</div>
             </div>
             <div className="kpi-card" style={{ padding: "12px 16px" }}>
               <div className="kpi-label">Active Snapshots</div>
               <div className="kpi-value text-purple">{snapshots.length}</div>
             </div>
          </div>
        </div>
      </div>

      {/* Live Metrics — auto-refreshes every 5s */}
      <div className="card mt-16">
        <div className="card-header">
          <div className="card-title">Live Metrics</div>
          <span className="text-muted" style={{ fontSize: 11 }}>{metrics?.capturedAt ? new Date(metrics.capturedAt).toLocaleTimeString() : "—"}</span>
        </div>
        <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", marginBottom: 16 }}>
          <div className="kpi-card"><div className="kpi-label">Events/sec (last 60s)</div><div className="kpi-value">{metrics?.eventsPerSecond ?? 0}</div></div>
          <div className="kpi-card kpi-amber"><div className="kpi-label">Outbox Pending</div><div className="kpi-value">{metrics?.outbox.pendingCount ?? 0}</div></div>
          <div className="kpi-card kpi-green"><div className="kpi-label">Outbox Published</div><div className="kpi-value">{metrics?.outbox.publishedCount ?? 0}</div></div>
          <div className="kpi-card kpi-red"><div className="kpi-label">Outbox Failed</div><div className="kpi-value">{metrics?.outbox.failedCount ?? 0}</div></div>
          <div className="kpi-card kpi-purple"><div className="kpi-label">Duplicates Ignored</div><div className="kpi-value">{metrics?.duplicatesIgnoredTotal ?? 0}</div></div>
        </div>
        {metrics?.subscribers && metrics.subscribers.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Subscriber</th><th>Processed</th><th>Duplicates Ignored</th></tr></thead>
              <tbody>
                {metrics.subscribers.map(s => (
                  <tr key={s.name}>
                    <td className="fw-600">{s.name}</td>
                    <td className="mono">{s.processedCount}</td>
                    <td className="mono">{s.duplicateIgnoredCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
