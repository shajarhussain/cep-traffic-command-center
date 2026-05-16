import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { OutboxItem, OutboxStatus } from "../api/client.js";
import { timeAgo } from "../utils/formatters.js";
import { useToast } from "../components/Toast.js";
import { Icon } from "../components/Icon.js";

type StatusFilter = "ALL" | "PENDING" | "PUBLISHED" | "FAILED";

const STATUS_BADGE: Record<OutboxItem["status"], string> = {
  PENDING:   "badge-amber",
  PUBLISHED: "badge-green",
  FAILED:    "badge-red",
};

export function OutboxPage() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OutboxItem | null>(null);
  const [status, setStatus] = useState<OutboxStatus | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    const filterArg = filter === "ALL" ? undefined : filter;
    Promise.all([
      api.outboxList(filterArg, 200).catch(() => [] as OutboxItem[]),
      api.outboxStatus().catch(() => null),
    ]).then(([rows, s]) => {
      setItems(rows);
      setStatus(s);
      setLoading(false);
    });
  }, [filter]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const handleReplay = async (item: OutboxItem) => {
    try {
      const res = await api.replayOutboxRow(item.id);
      if (res.status === "PUBLISHED") {
        toast.success(`Replayed ${item.event_id.slice(0, 8)}…`);
      } else {
        toast.error(res.error ?? "Replay failed");
      }
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Replay failed");
    }
  };

  const handleRelayBatch = async () => {
    try {
      const res = await api.relayOutbox();
      toast.success(`Relayed ${res.relayed} · Failed ${res.failed} · Skipped ${res.skipped}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch relay failed");
    }
  };

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading outbox…</div></div>;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title"><Icon name="inbox" size={22} /> Event Outbox</h1>
        <p className="page-desc">
          Transactional outbox for the Outbox Pattern (CLO 4 Scenario 3). Every published event is durably written here
          inside the same transaction as the event store. The background relay republishes <span className="fw-600 text-amber">PENDING</span> rows
          to the EventBus; failed dispatches are retried with attempt counters; terminal failures land in <span className="fw-600 text-red">FAILED</span>.
        </p>
      </div>

      <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi-card kpi-amber"><div className="kpi-label">Pending</div><div className="kpi-value">{status?.pendingCount ?? 0}</div></div>
        <div className="kpi-card kpi-green"><div className="kpi-label">Published</div><div className="kpi-value">{status?.publishedCount ?? 0}</div></div>
        <div className="kpi-card kpi-red"><div className="kpi-label">Failed</div><div className="kpi-value">{status?.failedCount ?? 0}</div></div>
        <div className="kpi-card"><div className="kpi-label">Relay Worker</div><div className="kpi-value" style={{ fontSize: 16, color: status?.relayRunning ? "var(--green)" : "var(--red)" }}>{status?.relayRunning ? "RUNNING" : "STOPPED"}</div></div>
      </div>

      <div className="dt-toolbar">
        {(["ALL", "PENDING", "PUBLISHED", "FAILED"] as StatusFilter[]).map(s => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : ""}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={handleRelayBatch}><Icon name="play" size={14} /> Relay Pending Now</button>
        <button className="btn btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="table-wrap" style={{ maxHeight: 600, overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Event ID</th>
                  <th>Attempts</th>
                  <th>Created</th>
                  <th>Published</th>
                  <th>Last Error</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state-rich">
                      <Icon name="check" size={32} />
                      <div className="empty-title">Outbox is clear</div>
                      <div className="empty-sub">{filter === "ALL" ? "Every published event reached the bus. Publish from the Simulator to watch a row land here and flip from PENDING to PUBLISHED within a second." : `No ${filter.toLowerCase()} rows at the moment.`}</div>
                    </div>
                  </td></tr>
                ) : items.map(it => (
                  <tr key={it.id} className={selected?.id === it.id ? "selected" : ""} onClick={() => setSelected(it)} style={{ cursor: "pointer" }}>
                    <td><span className={`badge ${STATUS_BADGE[it.status]}`}>{it.status}</span></td>
                    <td className="mono" style={{ fontSize: 11 }}>{it.event_id.slice(0, 8)}…</td>
                    <td className="mono">{it.attempt_count}</td>
                    <td className="text-sec">{timeAgo(it.created_at)}</td>
                    <td className="text-sec">{it.published_at ? timeAgo(it.published_at) : "—"}</td>
                    <td className="text-red" style={{ fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.last_error ?? "—"}</td>
                    <td>
                      {(it.status === "PENDING" || it.status === "FAILED") && (
                        <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); handleReplay(it); }}>Replay</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="drawer" style={{ width: 360, flexShrink: 0 }}>
            <div className="drawer-header">
              <div className="drawer-title">Envelope Detail</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)} aria-label="Close drawer"><Icon name="close" size={14} /></button>
            </div>
            <div style={{ display: "grid", gap: 10, fontSize: 12 }}>
              <div><div className="form-label">Status</div><span className={`badge ${STATUS_BADGE[selected.status]}`}>{selected.status}</span></div>
              <div><div className="form-label">Event ID</div><div className="mono" style={{ fontSize: 11 }}>{selected.event_id}</div></div>
              <div><div className="form-label">Attempts</div><div className="mono">{selected.attempt_count}</div></div>
              {selected.last_error && (
                <div><div className="form-label">Last Error</div><div className="text-red mono" style={{ fontSize: 11 }}>{selected.last_error}</div></div>
              )}
              <div>
                <div className="form-label">Envelope JSON</div>
                <div className="json-viewer">{(() => {
                  try { return JSON.stringify(JSON.parse(selected.envelope_json), null, 2); }
                  catch { return selected.envelope_json; }
                })()}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
