import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { TrafficIncident } from "../api/client.js";
import { formatEventType, getSeverityClass, timeAgo } from "../utils/formatters.js";
import { useToast } from "../components/Toast.js";
import { Icon } from "../components/Icon.js";
import { TrafficLight, levelFromSeverity } from "../components/TrafficLight.js";
import { Provenance } from "../components/Provenance.js";

type StatusFilter = "ALL" | "OPEN" | "ACKNOWLEDGED" | "CLEARED";

export function IncidentOpsPage() {
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [selected, setSelected] = useState<TrafficIncident | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = () => {
    api.incidents()
      .then(setIncidents)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load incidents"))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleAck = async (id: string) => {
    try { await api.acknowledgeIncident(id); toast.success("Incident acknowledged"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to acknowledge"); }
    finally { load(); }
  };
  const handleClose = async (id: string) => {
    try { await api.closeIncident(id); toast.success("Incident closed"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed to close"); }
    finally { load(); }
  };

  const filtered = filter === "ALL" ? incidents : incidents.filter(i => i.status === filter);
  const counts = { OPEN: incidents.filter(i => i.status === "OPEN").length, ACKNOWLEDGED: incidents.filter(i => i.status === "ACKNOWLEDGED").length, CLEARED: incidents.filter(i => i.status === "CLEARED").length };

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading…</div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title"><Icon name="siren" size={22} /> Incident Operations</h1>
        <p className="page-desc">Manage active traffic incidents — acknowledge, investigate, and clear</p>
        <div style={{ marginTop: 6 }}>
          <Provenance rows={incidents} timestampOf={i => i.opened_at} label="incident" />
        </div>
      </div>

      <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi-card"><div className="kpi-label">Total</div><div className="kpi-value">{incidents.length}</div></div>
        <div className="kpi-card" style={{ borderColor: "var(--amber)" }}><div className="kpi-label">Open</div><div className="kpi-value text-amber">{counts.OPEN}</div></div>
        <div className="kpi-card"><div className="kpi-label">Acknowledged</div><div className="kpi-value text-blue">{counts.ACKNOWLEDGED}</div></div>
        <div className="kpi-card"><div className="kpi-label">Cleared</div><div className="kpi-value text-green">{counts.CLEARED}</div></div>
      </div>

      <div className="dt-toolbar">
        {(["ALL", "OPEN", "ACKNOWLEDGED", "CLEARED"] as StatusFilter[]).map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : ""}`} onClick={() => setFilter(s)}>{s} {s !== "ALL" ? `(${counts[s as keyof typeof counts] ?? 0})` : ""}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="table-wrap" style={{ maxHeight: 500, overflowY: "auto" }}>
            <table>
              <thead><tr><th></th><th>Severity</th><th>Intersection</th><th>Type</th><th>Events</th><th>Status</th><th>Opened</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state-rich">
                      <Icon name="check" size={32} />
                      <div className="empty-title">All clear</div>
                      <div className="empty-sub">{filter === "ALL" ? "No incidents recorded. All intersections operating nominally." : `No ${filter.toLowerCase()} incidents at the moment.`}</div>
                    </div>
                  </td></tr>
                ) : filtered.map(inc => (
                  <tr key={inc.id} className={selected?.id === inc.id ? "selected" : ""} onClick={() => setSelected(inc)} style={{ cursor: "pointer" }}>
                    <td style={{ width: 24 }}><TrafficLight level={levelFromSeverity(inc.severity)} label={inc.severity} /></td>
                    <td><span className={`badge ${getSeverityClass(inc.severity)}`}>{inc.severity}</span></td>
                    <td className="fw-500">{inc.intersection_name}</td>
                    <td>{formatEventType(inc.incident_type)}</td>
                    <td className="mono">{inc.event_count}</td>
                    <td><span className={`badge ${inc.status === "OPEN" ? "badge-amber" : inc.status === "ACKNOWLEDGED" ? "badge-blue" : "badge-green"}`}>{inc.status}</span></td>
                    <td className="text-muted">{timeAgo(inc.opened_at)}</td>
                    <td>
                      <div className="btn-group">
                        {inc.status === "OPEN" && <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleAck(inc.id); }}>Acknowledge</button>}
                        {(inc.status === "OPEN" || inc.status === "ACKNOWLEDGED") && <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleClose(inc.id); }}>Close</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="drawer" style={{ width: 320, flexShrink: 0 }}>
            <div className="drawer-header">
              <div className="drawer-title">Incident Details</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} aria-label="Close drawer"><Icon name="close" size={14} /></button>
            </div>
            <div style={{ display: "grid", gap: 10, fontSize: 12 }}>
              <div><span className="form-label">Intersection</span><div className="fw-500">{selected.intersection_name}</div></div>
              <div><span className="form-label">Type</span><div>{formatEventType(selected.incident_type)}</div></div>
              <div><span className="form-label">Severity</span><div><span className={`badge ${getSeverityClass(selected.severity)}`}>{selected.severity}</span></div></div>
              <div><span className="form-label">Status</span><div><span className={`badge ${selected.status === "OPEN" ? "badge-amber" : selected.status === "ACKNOWLEDGED" ? "badge-blue" : "badge-green"}`}>{selected.status}</span></div></div>
              <div><span className="form-label">Event Count</span><div className="mono">{selected.event_count}</div></div>
              <div><span className="form-label">External Confirmed</span><div>{selected.external_confirmed ? <span className="text-green">Yes</span> : <span className="text-muted">No</span>}</div></div>
              <div><span className="form-label">Opened</span><div>{new Date(selected.opened_at).toLocaleString()}</div></div>
              {selected.acknowledged_at && <div><span className="form-label">Acknowledged</span><div>{new Date(selected.acknowledged_at).toLocaleString()}</div></div>}
              {selected.cleared_at && <div><span className="form-label">Cleared</span><div>{new Date(selected.cleared_at).toLocaleString()}</div></div>}
              <div><span className="form-label">Incident ID</span><div className="mono text-muted" style={{ fontSize: 10 }}>{selected.id}</div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
