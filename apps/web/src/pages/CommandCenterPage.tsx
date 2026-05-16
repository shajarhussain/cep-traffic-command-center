import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { SummaryResponse, TrafficIncident, EventEnvelope, QueueAnalysis, ExternalContextStatus, TrafficRisk, WeatherStatus, ExternalSnapshot } from "../api/client.js";
import { formatEventType, getSeverityClass, timeAgo, calculateSeverity } from "../utils/formatters.js";
import { Icon } from "../components/Icon.js";

export function CommandCenterPage() {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [queue, setQueue] = useState<QueueAnalysis | null>(null);
  const [ext, setExt] = useState<ExternalContextStatus | null>(null);
  const [risk, setRisk] = useState<TrafficRisk | null>(null);
  const [weather, setWeather] = useState<WeatherStatus | null>(null);
  const [snapshots, setSnapshots] = useState<ExternalSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      api.summary().catch(() => null),
      api.incidents("OPEN").catch(() => []),
      api.events().catch(() => []),
      api.queueAnalysis().catch(() => null),
      api.externalStatus().catch(() => null),
      api.trafficRisk().catch(() => null),
      api.weather().catch(() => null),
      api.externalSnapshots(5).catch(() => [] as ExternalSnapshot[]),
    ]).then(([s, i, e, q, x, r, w, snaps]) => {
      setSummary(s);
      setIncidents(i);
      setEvents(e);
      setQueue(q);
      setExt(x);
      setRisk(r);
      setWeather(w);
      setSnapshots(snaps);
      setLoading(false);
    });
  };

  useEffect(() => { load(); const iv = setInterval(load, 20000); return () => clearInterval(iv); }, []);

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading Command Center…</div></div>;

  const s = summary;
  const riskLevel = risk?.overallRisk ?? "LOW";
  const riskColor = riskLevel === "CRITICAL" ? "var(--red)" : riskLevel === "HIGH" ? "var(--amber)" : riskLevel === "MEDIUM" ? "var(--blue)" : "var(--green)";
  const riskVariant = riskLevel === "CRITICAL" ? "kpi-red" : riskLevel === "HIGH" ? "kpi-amber" : riskLevel === "MEDIUM" ? "" : "kpi-green";

  return (
    <div className="page fade-in">
      {/* Hero header */}
      <div className="hero">
        <div>
          <h1 className="hero-title page-title"><Icon name="dashboard" size={22} />{s?.activeZone ? `${s.activeZone.city} — ${s.activeZone.name}` : "Command Center"}</h1>
          <div className="hero-subtitle">Live operational overview of the traffic monitoring network</div>
        </div>
        <div className="hero-meta">
          <span className="topbar-item"><span className={`dot ${ext?.connected ? "dot-green" : "dot-amber"}`} /> {ext?.connected ? "TomTom Connected" : "Fallback Mode"}</span>
          <span className={`badge ${riskLevel === "CRITICAL" ? "sev-critical" : riskLevel === "HIGH" ? "sev-high" : riskLevel === "MEDIUM" ? "sev-medium" : "sev-info"}`}>Risk: {riskLevel}</span>
          <button className="btn btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="kpi-strip">
        <div className="kpi-card"><div className="kpi-label"><Icon name="camera" size={12} /> Active Cameras</div><div className="kpi-value">{s?.cameraCount ?? 0}</div></div>
        <div className="kpi-card kpi-sky"><div className="kpi-label"><Icon name="road" size={12} /> Intersections</div><div className="kpi-value">{s?.intersectionCount ?? 0}</div></div>
        <div className="kpi-card kpi-purple"><div className="kpi-label"><Icon name="bolt" size={12} /> Live Alerts</div><div className="kpi-value">{s?.eventCount ?? 0}</div></div>
        <div className="kpi-card kpi-amber"><div className="kpi-label"><Icon name="siren" size={12} /> Open Incidents</div><div className="kpi-value">{s?.openIncidentCount ?? 0}</div></div>
        <div className="kpi-card kpi-red"><div className="kpi-label"><Icon name="alert-triangle" size={12} /> Critical</div><div className="kpi-value">{s?.criticalIncidentCount ?? 0}</div></div>
        <div className="kpi-card kpi-green"><div className="kpi-label"><Icon name="gavel" size={12} /> Enforcement</div><div className="kpi-value">{s?.penaltyCount ?? 0}</div></div>
        <div className={`kpi-card ${riskVariant}`}>
          <div className="kpi-label">Queue Risk</div>
          <div className="kpi-value" style={{ color: riskColor }}>{queue?.secondsUntilFull != null ? `${queue.secondsUntilFull}s` : "—"}</div>
          <div className="kpi-sub">time to full</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid-2 gap-16 mb-24">
        {/* Incident Operations */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Open Incidents</div>
            <span className="badge badge-amber">{incidents.length} active</span>
          </div>
          {incidents.length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">No open incidents</div></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {incidents.slice(0, 5).map(inc => (
                <div key={inc.id} className="service-card">
                  <span className={`badge ${getSeverityClass(inc.severity)}`}>{inc.severity}</span>
                  <div style={{ flex: 1 }}>
                    <div className="fw-600" style={{ fontSize: 13 }}>{inc.intersection_name}</div>
                    <div className="text-sec" style={{ fontSize: 11 }}>{formatEventType(inc.incident_type)} · {inc.event_count} events</div>
                  </div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{timeAgo(inc.opened_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Alert Timeline */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Live Alert Timeline</div>
            <span className="badge badge-purple">{events.length} events</span>
          </div>
          {events.length === 0 ? (
            <div className="empty-state"><div className="empty-state-text">No events recorded</div></div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
              {events.slice(-8).reverse().map(ev => {
                const sev = calculateSeverity(ev.event_type, ev.payload);
                return (
                  <div key={ev.event_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "var(--bg-raised)", borderRadius: "var(--radius-md)", borderLeft: `3px solid ${sev === "HIGH" ? "var(--amber)" : sev === "CRITICAL" ? "var(--red)" : sev === "MEDIUM" ? "var(--blue)" : "var(--cyan)"}` }}>
                    <span className={`badge ${getSeverityClass(sev)}`} style={{ fontSize: 9 }}>{sev}</span>
                    <div style={{ flex: 1 }}>
                      <span className="fw-500" style={{ fontSize: 12 }}>{formatEventType(ev.event_type)}</span>
                      <span className="text-muted" style={{ fontSize: 11, marginLeft: 8 }}>{(ev.payload as any)?.intersection_name ?? ev.source_id}</span>
                    </div>
                    <span className="mono text-muted" style={{ fontSize: 10 }}>{timeAgo(ev.timestamp)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Lower Grid */}
      <div className="grid-4 gap-16">
        {/* External Context */}
        <div className="card">
          <div className="card-header"><div className="card-title">External Traffic Context</div></div>
          <div className="service-card mb-16">
            <div className={`dot ${ext?.connected ? "dot-green" : "dot-amber"}`} style={{ width: 8, height: 8, borderRadius: "50%" }} />
            <div style={{ flex: 1 }}>
              <div className="fw-600" style={{ fontSize: 12 }}>{ext?.provider ?? "TomTom"}</div>
              <div className="text-muted" style={{ fontSize: 11 }}>{ext?.message ?? "Loading…"}</div>
            </div>
          </div>
          <div style={{ fontSize: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span className="text-sec">Active Zone</span>
              <span className="fw-500">{ext?.activeZone?.name ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span className="text-sec">Key Configured</span>
              <span className={ext?.keyConfigured ? "text-green" : "text-amber"}>{ext?.keyConfigured ? "Yes" : "No"}</span>
            </div>
          </div>
          {snapshots.length > 0 && (
            <div className="mt-16">
              <div className="form-label">Recent Snapshots</div>
              <div style={{ display: "grid", gap: 4, marginTop: 4 }}>
                {snapshots.slice(0, 3).map(s => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                    <span className={`badge ${s.riskLevel === "HIGH" ? "sev-high" : s.riskLevel === "MEDIUM" ? "sev-medium" : "sev-info"}`} style={{ fontSize: 9 }}>{s.snapshotType}</span>
                    <span className="text-sec truncate" style={{ flex: 1 }}>{s.summary}</span>
                    <span className="mono text-muted" style={{ fontSize: 10 }}>{timeAgo(s.fetchedAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Capacity Mini */}
        <div className="card">
          <div className="card-header"><div className="card-title">Capacity Risk</div></div>
          {queue && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div><div className="kpi-label">Incoming</div><div className="mono fw-600">{queue.incomingRate}/s</div></div>
                <div><div className="kpi-label">Processing</div><div className="mono fw-600">{queue.processingRate}/s</div></div>
                <div><div className="kpi-label">Limit</div><div className="mono fw-600">{queue.queueLimit.toLocaleString()}</div></div>
              </div>
              <div className="gauge-bar">
                <div className="gauge-fill" style={{
                  width: `${Math.min(100, (1 - queue.secondsUntilFull / 60) * 100)}%`,
                  background: queue.secondsUntilFull < 30 ? "var(--red)" : queue.secondsUntilFull < 60 ? "var(--amber)" : "var(--green)"
                }} />
              </div>
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <div className="mono fw-700" style={{ fontSize: 20, color: queue.secondsUntilFull < 30 ? "var(--red)" : "var(--green)" }}>
                  {queue.secondsUntilFull}s
                </div>
                <div className="text-muted" style={{ fontSize: 11 }}>time to full</div>
              </div>
              {queue.policyName && <div className="text-muted" style={{ fontSize: 10, marginTop: 6, textAlign: "center" }}>Policy: {queue.policyName}</div>}
            </>
          )}
        </div>

        {/* Traffic Risk */}
        <div className="card" style={{ borderColor: riskColor }}>
          <div className="card-header"><div className="card-title">Traffic Risk Assessment</div></div>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div className="kpi-value" style={{ fontSize: 28, color: riskColor }}>{riskLevel}</div>
            <div className="text-sec" style={{ fontSize: 12, marginTop: 4 }}>{risk?.recommendation ?? "Normal operations"}</div>
          </div>

          {/* External signal chips — always visible so you can tell TomTom and Weather are "talking" even when the risk math hasn't flipped. */}
          {risk && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {risk.tomtom?.available ? (
                <span
                  className={`badge ${risk.tomtom.severity === "POOR" ? "sev-high" : risk.tomtom.severity === "MODERATE" ? "sev-medium" : "sev-info"}`}
                  title={risk.tomtom.summary}
                >
                  TomTom: {risk.tomtom.severity === "CLEAR" ? "Quiet" : risk.tomtom.severity}{risk.tomtom.incidentCount > 0 ? ` · ${risk.tomtom.incidentCount} ext` : ""}
                </span>
              ) : (
                <span className="badge badge-muted" title="TomTom is in fallback mode (no key or provider disabled)">TomTom: Fallback</span>
              )}
              {risk.weather && !risk.weather.fallback && (
                <span
                  className={`badge ${risk.weather.severity === "POOR" ? "sev-high" : risk.weather.severity === "MODERATE" ? "sev-medium" : "sev-info"}`}
                  title={risk.weather.condition}
                >
                  Weather: {risk.weather.condition}{risk.weather.temperatureC != null ? ` @ ${Math.round(risk.weather.temperatureC)}°C` : ""}
                </span>
              )}
            </div>
          )}

          {risk?.reasons && risk.reasons.length > 0 && (
            <div>
              {risk.reasons.map((r, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-sec)", padding: "3px 0", borderBottom: "1px solid var(--border-dim)" }}>• {r}</div>
              ))}
            </div>
          )}
        </div>

        {/* Weather */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Weather Context</div>
            {weather && (
              <span className={`badge ${weather.severity === "POOR" ? "sev-high" : weather.severity === "MODERATE" ? "sev-medium" : "sev-info"}`}>
                {weather.severity}
              </span>
            )}
          </div>
          {!weather || weather.fallback ? (
            <div className="service-card mb-16">
              <div className="dot dot-amber" style={{ width: 8, height: 8, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div className="fw-600" style={{ fontSize: 12 }}>OpenWeatherMap</div>
                <div className="text-muted" style={{ fontSize: 11 }}>{weather?.message ?? "Fallback mode"}</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 12 }}>
                <div className="kpi-value" style={{ fontSize: 28 }}>
                  {weather.temperatureC != null ? `${Math.round(weather.temperatureC)}°C` : "—"}
                </div>
                <div className="text-sec" style={{ fontSize: 13, marginTop: 2 }}>{weather.condition}</div>
                <div className="text-muted" style={{ fontSize: 11 }}>{weather.city ?? "Active Zone"}</div>
              </div>
              <div style={{ fontSize: 11 }}>
                {weather.feelsLikeC != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span className="text-sec">Feels like</span><span className="mono">{Math.round(weather.feelsLikeC)}°C</span>
                  </div>
                )}
                {weather.visibilityMeters != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span className="text-sec">Visibility</span><span className="mono">{(weather.visibilityMeters / 1000).toFixed(1)} km</span>
                  </div>
                )}
                {weather.windSpeedKmh != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span className="text-sec">Wind</span><span className="mono">{weather.windSpeedKmh} km/h</span>
                  </div>
                )}
                {weather.humidityPct != null && (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span className="text-sec">Humidity</span><span className="mono">{weather.humidityPct}%</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
