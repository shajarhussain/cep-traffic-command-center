import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client.js";
import type { EventEnvelope } from "../api/client.js";
import { formatEventType, getSeverityClass, calculateSeverity, timeAgo, getEventBadgeClass } from "../utils/formatters.js";
import { EventTypeSelect } from "../components/EventTypeSelect.js";
import { useToast } from "../components/Toast.js";
import { Icon } from "../components/Icon.js";

export function LiveAlertPage() {
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [selected, setSelected] = useState<EventEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(() => {
    api.events()
      .then(setEvents)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load events"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const filtered = events.filter(ev => {
    if (typeFilter && ev.event_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return ev.event_id.toLowerCase().includes(s)
        || ev.source_id.toLowerCase().includes(s)
        || ev.event_type.toLowerCase().includes(s)
        || JSON.stringify(ev.payload).toLowerCase().includes(s);
    }
    return true;
  }).reverse();

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading…</div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title"><Icon name="bolt" size={22} /> Live Alert Stream</h1>
        <p className="page-desc">All traffic events captured by the event bus — search, filter, and inspect</p>
      </div>

      <div className="dt-toolbar">
        <input className="form-control dt-search" placeholder="Search events…" value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ maxWidth: 220 }}>
          <EventTypeSelect value={typeFilter} onChange={setTypeFilter} includeAll allLabel="All Types" />
        </div>
        <span className="badge badge-muted">{filtered.length} events</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="table-wrap" style={{ maxHeight: 520, overflowY: "auto" }}>
            <table>
              <thead><tr><th>Severity</th><th>Event Type</th><th>Source</th><th>Intersection</th><th>Time</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-text">No events match your filters</div></div></td></tr>
                ) : filtered.map(ev => {
                  const sev = calculateSeverity(ev.event_type, ev.payload);
                  const p = ev.payload as any;
                  return (
                    <tr key={ev.event_id} className={selected?.event_id === ev.event_id ? "selected" : ""} onClick={() => setSelected(ev)} style={{ cursor: "pointer" }}>
                      <td><span className={`badge ${getSeverityClass(sev)}`}>{sev}</span></td>
                      <td><span className={`badge ${getEventBadgeClass(ev.event_type)}`}>{formatEventType(ev.event_type)}</span></td>
                      <td className="mono" style={{ fontSize: 11 }}>{ev.source_id?.substring(0, 8) ?? "—"}</td>
                      <td>{p?.intersection_name ?? "—"}</td>
                      <td className="text-muted">{timeAgo(ev.timestamp)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="drawer" style={{ width: 340, flexShrink: 0 }}>
            <div className="drawer-header">
              <div className="drawer-title">Alert Details</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} aria-label="Close drawer"><Icon name="close" size={14} /></button>
            </div>
            <div style={{ display: "grid", gap: 10, fontSize: 12 }}>
              <div><span className="form-label">Event ID</span><div className="mono" style={{ fontSize: 10 }}>{selected.event_id}</div></div>
              <div><span className="form-label">Type</span><div><span className={`badge ${getEventBadgeClass(selected.event_type)}`}>{formatEventType(selected.event_type)}</span></div></div>
              <div><span className="form-label">Severity</span><div><span className={`badge ${getSeverityClass(calculateSeverity(selected.event_type, selected.payload))}`}>{calculateSeverity(selected.event_type, selected.payload)}</span></div></div>
              <div><span className="form-label">Source ID</span><div className="mono" style={{ fontSize: 11 }}>{selected.source_id}</div></div>
              <div><span className="form-label">Correlation ID</span><div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{selected.correlation_id}</div></div>
              <div><span className="form-label">Schema Version</span><div>{selected.schema_version}</div></div>
              <div><span className="form-label">Timestamp</span><div>{new Date(selected.timestamp).toLocaleString()}</div></div>
              <div><span className="form-label">Raw Event Type</span><div className="mono text-muted" style={{ fontSize: 10 }}>{selected.event_type}</div></div>
              <div><span className="form-label">Payload</span><div className="json-viewer">{JSON.stringify(selected.payload, null, 2)}</div></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
