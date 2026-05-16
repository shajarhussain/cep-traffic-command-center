import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { EventEnvelope, AuditLog, OperatorAction } from "../api/client.js";
import { formatEventType, getEventBadgeClass } from "../utils/formatters.js";
import { exportRowsAsCsv } from "../utils/csv.js";
import { useToast } from "../components/Toast.js";
import { Icon } from "../components/Icon.js";
import { Provenance } from "../components/Provenance.js";

type TabId = "logs" | "envelopes" | "actions";

export function AuditPage() {
  const [tab, setTab] = useState<TabId>("logs");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [actions, setActions] = useState<OperatorAction[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(() => {
    Promise.all([
      api.auditLogs().catch(() => [] as AuditLog[]),
      api.events().catch(() => [] as EventEnvelope[]),
      api.operatorActions(300).catch(() => [] as OperatorAction[]),
    ])
      .then(([l, e, a]) => { setLogs(l); setEvents(e); setActions(a); })
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load audit data"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading Audit Trail…</div></div>;

  const handleExport = () => {
    if (tab === "logs") {
      if (logs.length === 0) { toast.info("No audit logs to export"); return; }
      const flat = logs.map(l => ({
        id: l.id,
        event_id: l.event_id,
        event_type: l.event_type,
        message: l.message,
        payload_snapshot: l.payload_snapshot ?? "",
        created_at: l.created_at,
      }));
      exportRowsAsCsv(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, flat);
      toast.success(`Exported ${logs.length} audit log(s) to CSV`);
    } else if (tab === "envelopes") {
      if (events.length === 0) { toast.info("No event envelopes to export"); return; }
      const flat = events.map(ev => ({
        event_id: ev.event_id,
        correlation_id: ev.correlation_id,
        schema_version: ev.schema_version,
        source_id: ev.source_id,
        timestamp: ev.timestamp,
        event_type: ev.event_type,
        payload: JSON.stringify(ev.payload),
      }));
      exportRowsAsCsv(`event-envelopes-${new Date().toISOString().slice(0, 10)}.csv`, flat);
      toast.success(`Exported ${events.length} envelope(s) to CSV`);
    } else {
      if (actions.length === 0) { toast.info("No operator actions to export"); return; }
      exportRowsAsCsv(`operator-actions-${new Date().toISOString().slice(0, 10)}.csv`, actions);
      toast.success(`Exported ${actions.length} operator action(s) to CSV`);
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="page-title"><Icon name="clock" size={22} /> Audit Trail</h1>
          <p className="page-desc">
            <strong>Audit Logs</strong> are written by the LoggingService subscriber (severity-stamped).{" "}
            <strong>Event Envelopes</strong> are every raw event ever published through the bus.{" "}
            <strong>Operator Actions</strong> are every high-signal mutation made by a human (subscribe/unsubscribe, fine-policy edits, incident ack/close, external-provider toggle).
          </p>
          <div style={{ marginTop: 6 }}>
            {tab === "logs" && <Provenance rows={logs} timestampOf={l => l.created_at} label="log entry" />}
            {tab === "envelopes" && <Provenance rows={events} timestampOf={e => e.timestamp} label="envelope" />}
            {tab === "actions" && <Provenance rows={actions} timestampOf={a => a.createdAt} label="operator action" />}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
          <button className="btn btn-sm" onClick={handleExport}><Icon name="download" size={14} /> Export CSV</button>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-item ${tab === "logs" ? "active" : ""}`} onClick={() => setTab("logs")}>
          Audit Logs <span className="tab-count">{logs.length}</span>
        </button>
        <button className={`tab-item ${tab === "envelopes" ? "active" : ""}`} onClick={() => setTab("envelopes")}>
          Event Envelopes <span className="tab-count">{events.length}</span>
        </button>
        <button className={`tab-item ${tab === "actions" ? "active" : ""}`} onClick={() => setTab("actions")}>
          Operator Actions <span className="tab-count">{actions.length}</span>
        </button>
      </div>

      {tab === "logs" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Message</th>
                <th>Event ID</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state"><div className="empty-state-text">No audit logs yet. LoggingService writes one entry per processed SpeedViolation or CongestionAlert event.</div></div></td></tr>
              ) : (
                logs.slice().reverse().map(l => (
                  <tr key={l.id}>
                    <td className="text-muted" style={{ fontSize: 11 }}>{new Date(l.created_at).toLocaleString()}</td>
                    <td><span className={`badge ${getEventBadgeClass(l.event_type)}`}>{formatEventType(l.event_type)}</span></td>
                    <td>{l.message}</td>
                    <td className="mono text-muted" style={{ fontSize: 10 }}>{l.event_id.substring(0, 13)}…</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "envelopes" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action / Event</th>
                <th>Source / Actor</th>
                <th>System Impact</th>
                <th>Trace ID</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                 <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-text">No envelopes recorded</div></div></td></tr>
              ) : (
                events.slice().reverse().map(ev => {
                  const impact = ev.event_type === "SpeedViolationEvent" ? "Enforcement Triggered" :
                                 ev.event_type === "CongestionAlertEvent" ? "Incident Evaluation" :
                                 ev.event_type === "TrafficClearedEvent" ? "Incident Closure" : "State Update";
                  return (
                    <tr key={ev.event_id}>
                      <td className="text-muted" style={{ fontSize: 11 }}>{new Date(ev.timestamp).toLocaleString()}</td>
                      <td><span className={`badge ${getEventBadgeClass(ev.event_type)}`}>{formatEventType(ev.event_type)}</span></td>
                      <td className="mono text-muted" style={{ fontSize: 11 }}>{ev.source_id.substring(0, 8)}</td>
                      <td className="text-sec" style={{ fontSize: 12 }}>{impact}</td>
                      <td className="mono text-muted" style={{ fontSize: 10 }}>{ev.event_id.substring(0, 13)}…</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "actions" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Target</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {actions.length === 0 ? (
                <tr><td colSpan={4}><div className="empty-state"><div className="empty-state-text">No operator actions yet. Try subscribe/unsubscribe in System → Subscribers, or edit a fine policy.</div></div></td></tr>
              ) : (
                actions.map(a => (
                  <tr key={a.id}>
                    <td className="text-muted" style={{ fontSize: 11 }}>{new Date(a.createdAt).toLocaleString()}</td>
                    <td><span className="badge badge-purple">{a.actionType}</span></td>
                    <td className="mono" style={{ fontSize: 11 }}>{a.targetType} · {a.targetId.length > 12 ? a.targetId.substring(0, 12) + "…" : a.targetId}</td>
                    <td className="text-sec">{a.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
