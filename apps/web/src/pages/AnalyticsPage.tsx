import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { EventEnvelope, TrafficIncident, Penalty, ReportAggregate } from "../api/client.js";
import { formatEventType, calculateSeverity, getSeverityClass, getEventBadgeClass } from "../utils/formatters.js";
import { Icon } from "../components/Icon.js";

export function AnalyticsPage() {
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [reports, setReports] = useState<ReportAggregate[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    Promise.all([
      api.events().catch(() => []),
      api.incidents().catch(() => []),
      api.penalties().catch(() => []),
      api.reports().catch(() => [] as ReportAggregate[]),
    ]).then(([e, i, p, r]) => { setEvents(e); setIncidents(i); setPenalties(p); setReports(r); setLoading(false); });
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading Analytics…</div></div>;

  // Event Distribution
  const eventTypes = events.reduce((acc, ev) => {
    acc[ev.event_type] = (acc[ev.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Severity Distribution
  const severities = events.reduce((acc, ev) => {
    const sev = calculateSeverity(ev.event_type, ev.payload);
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Incidents by Intersection
  const incidentLocs = incidents.reduce((acc, inc) => {
    acc[inc.intersection_name] = (acc[inc.intersection_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Penalties by Camera
  const penaltyCams = penalties.reduce((acc, pen) => {
    const cam = pen.camera_id || "Unknown";
    acc[cam] = (acc[cam] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const maxEvents = Math.max(...Object.values(eventTypes), 1);
  const maxSevs = Math.max(...Object.values(severities), 1);

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="page-title"><Icon name="chart" size={22} /> Traffic Analytics</h1>
          <p className="page-desc">System-wide event distributions, severity breakdowns, and location hotspots</p>
        </div>
        <button className="btn btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div className="grid-2 gap-16 mb-16">
        <div className="card">
          <div className="card-header"><div className="card-title">Event Distribution</div></div>
          {Object.entries(eventTypes).length === 0 ? (
             <div className="empty-state"><div className="empty-state-text">No events recorded</div></div>
          ) : (
             <div style={{ display: "grid", gap: 12 }}>
               {Object.entries(eventTypes).sort((a,b)=>b[1]-a[1]).map(([type, count]) => (
                 <div key={type}>
                   <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                     <span className={`badge ${getEventBadgeClass(type)}`}>{formatEventType(type)}</span>
                     <span className="mono text-muted">{count}</span>
                   </div>
                   <div className="gauge-bar" style={{ height: 6 }}>
                     <div className="gauge-fill" style={{ width: `${(count / maxEvents) * 100}%`, background: "var(--cyan)" }} />
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Severity Breakdown</div></div>
          {Object.entries(severities).length === 0 ? (
             <div className="empty-state"><div className="empty-state-text">No severities recorded</div></div>
          ) : (
             <div style={{ display: "grid", gap: 12 }}>
               {Object.entries(severities).sort((a,b)=>b[1]-a[1]).map(([sev, count]) => {
                 let color = "var(--cyan)";
                 if (sev==="CRITICAL") color="var(--red)";
                 else if (sev==="HIGH") color="var(--amber)";
                 else if (sev==="MEDIUM") color="var(--blue)";
                 else if (sev==="INFO") color="var(--green)";
                 return (
                 <div key={sev}>
                   <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                     <span className={`badge ${getSeverityClass(sev)}`}>{sev}</span>
                     <span className="mono text-muted">{count}</span>
                   </div>
                   <div className="gauge-bar" style={{ height: 6 }}>
                     <div className="gauge-fill" style={{ width: `${(count / maxSevs) * 100}%`, background: color }} />
                   </div>
                 </div>
               )})}
             </div>
          )}
        </div>
      </div>

      <div className="grid-2 gap-16">
         <div className="card">
          <div className="card-header"><div className="card-title">Incident Hotspots</div></div>
          {Object.entries(incidentLocs).length === 0 ? (
             <div className="empty-state"><div className="empty-state-text">No incidents recorded</div></div>
          ) : (
             <div style={{ display: "grid", gap: 8 }}>
               {Object.entries(incidentLocs).sort((a,b)=>b[1]-a[1]).map(([loc, count]) => (
                 <div key={loc} className="service-card" style={{ padding: "8px 12px" }}>
                   <div style={{ flex: 1 }} className="fw-500">{loc}</div>
                   <span className="badge badge-amber">{count} incidents</span>
                 </div>
               ))}
             </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Enforcement by Camera</div></div>
          {Object.entries(penaltyCams).length === 0 ? (
             <div className="empty-state"><div className="empty-state-text">No enforcement tickets recorded</div></div>
          ) : (
             <div style={{ display: "grid", gap: 8 }}>
               {Object.entries(penaltyCams).sort((a,b)=>b[1]-a[1]).map(([cam, count]) => (
                 <div key={cam} className="service-card" style={{ padding: "8px 12px" }}>
                   <div style={{ flex: 1, fontSize: 11 }} className="mono text-muted">{cam}</div>
                   <span className="badge badge-red">{count} tickets</span>
                 </div>
               ))}
             </div>
          )}
        </div>
      </div>

      {/* Reporting aggregates — fed by ReportingService through /api/reports */}
      <div className="card mt-16">
        <div className="card-header">
          <div className="card-title">Reporting Aggregates ({reports.length})</div>
          <span className="text-muted" style={{ fontSize: 11 }}>Source: ReportingService subscriber</span>
        </div>
        {reports.length === 0 ? (
          <div className="empty-state"><div className="empty-state-text">No aggregates yet — publish events to build the report</div></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Event Type</th><th>Camera</th><th>Count</th></tr></thead>
              <tbody>
                {reports.slice(0, 50).map(r => (
                  <tr key={r.id}>
                    <td><span className="badge badge-blue">{formatEventType(r.event_type)}</span></td>
                    <td className="mono text-muted" style={{ fontSize: 11 }}>{r.camera_id ?? "—"}</td>
                    <td className="mono fw-600">{r.count}</td>
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
