import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { QueueAnalysis, FloodTestResult } from "../api/client.js";
import { useToast } from "../components/Toast.js";
import { formatEventType } from "../utils/formatters.js";
import { Icon } from "../components/Icon.js";

const PRESETS = [100, 200, 500, 1000];

export function CapacityPage() {
  const [queue, setQueue] = useState<QueueAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [floodCount, setFloodCount] = useState(200);
  const [overrideLimit, setOverrideLimit] = useState<number | "">("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<FloodTestResult | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    api.queueAnalysis()
      .then(setQueue)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load capacity"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10_000);
    return () => clearInterval(iv);
  }, [load]);

  const runFloodTest = async () => {
    setRunning(true);
    try {
      const limit = typeof overrideLimit === "number" && overrideLimit > 0 ? overrideLimit : undefined;
      const res = await api.floodTest(floodCount, limit);
      setResult(res);
      toast.success(`Flood test: ${res.accepted} accepted, ${res.evicted} evicted`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Flood test failed");
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading…</div></div>;
  if (!queue) return <div className="page"><div className="error-banner">Failed to load queue analysis</div></div>;

  const pct = Math.min(100, Math.max(0, (1 - queue.secondsUntilFull / 120) * 100));
  const color = queue.secondsUntilFull < 30 ? "var(--red)" : queue.secondsUntilFull < 60 ? "var(--amber)" : "var(--green)";

  const priorities = [
    { name: "CRITICAL", desc: "Emergency alerts — never evicted", color: "var(--red)" },
    { name: "HIGH", desc: "Speed violations over 25 km/h excess", color: "var(--amber)" },
    { name: "NORMAL", desc: "Standard violations and congestion alerts", color: "var(--blue)" },
    { name: "LOW", desc: "Vehicle detections and info events", color: "var(--cyan)" },
  ];

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="page-title"><Icon name="gauge" size={22} /> Capacity Monitor</h1>
          <p className="page-desc">Bounded event queue analysis — values driven by the active queue policy from the database</p>
        </div>
        <button className="btn btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
      </div>

      <div className="callout callout-info">
        Queue parameters are configurable. Change the incoming rate, processing rate, or queue limit in the Configuration Center to see this analysis update.
      </div>

      <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi-card"><div className="kpi-label">Incoming Rate</div><div className="kpi-value text-blue">{queue.incomingRate}</div><div className="kpi-sub">events/second</div></div>
        <div className="kpi-card kpi-green"><div className="kpi-label">Processing Rate</div><div className="kpi-value">{queue.processingRate}</div><div className="kpi-sub">events/second</div></div>
        <div className="kpi-card kpi-purple"><div className="kpi-label">Queue Limit</div><div className="kpi-value">{queue.queueLimit.toLocaleString()}</div><div className="kpi-sub">max events</div></div>
        <div className={`kpi-card ${queue.secondsUntilFull < 30 ? "kpi-red" : queue.secondsUntilFull < 60 ? "kpi-amber" : "kpi-green"}`}><div className="kpi-label">Time to Full</div><div className="kpi-value" style={{ color }}>{queue.secondsUntilFull}s</div><div className="kpi-sub">backlog: {queue.backlogGrowthPerSecond}/s</div></div>
      </div>

      <div className="grid-2 gap-16">
        <div className="card">
          <div className="card-header"><div className="card-title">Saturation Gauge</div></div>
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div className="mono fw-700" style={{ fontSize: 48, color }}>{queue.secondsUntilFull}s</div>
            <div className="text-sec">until queue reaches capacity</div>
          </div>
          <div className="gauge-bar" style={{ height: 12 }}>
            <div className="gauge-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--text-dim)" }}>
            <span>Safe</span>
            <span>Full</span>
          </div>
          <div className="mt-24" style={{ fontSize: 12 }}>
            <div className="form-label">Eviction Policy</div>
            <div className="text-sec">{queue.evictionPolicy}</div>
          </div>
          {queue.policyName && (
            <div className="mt-16" style={{ fontSize: 12 }}>
              <div className="form-label">Active Policy</div>
              <div><span className="fw-500">{queue.policyName}</span>{queue.policyId && <span className="mono text-muted" style={{ fontSize: 10, marginLeft: 8 }}>{queue.policyId}</span>}</div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Priority Ladder</div></div>
          <div className="text-sec mb-16" style={{ fontSize: 12 }}>Events are evicted lowest-priority first. Higher priority events survive longer in the queue.</div>
          {priorities.map(p => (
            <div key={p.name} className="priority-step" style={{ borderLeftColor: p.color }}>
              <span className="fw-600" style={{ color: p.color, minWidth: 70, fontSize: 12 }}>{p.name}</span>
              <span className="text-sec" style={{ fontSize: 12 }}>{p.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card mt-16">
        <div className="card-header">
          <div className="card-title">Stress Test the Bounded Queue</div>
          <span className="badge badge-amber">CEP Scenario 2</span>
        </div>
        <div className="callout callout-info" style={{ marginBottom: 12 }}>
          Generates synthetic envelopes and tries to enqueue them into a measurement queue. Watch the eviction count rise as you exceed the queue limit. <strong>Default mix is weighted toward LOW priority</strong> so the eviction policy is visible. <strong>Tip:</strong> to see eviction on the default seeded queue (limit {queue.queueLimit.toLocaleString()}), set Count above {queue.queueLimit.toLocaleString()} OR set an Override Limit (e.g. 50) below.
        </div>

        <div className="dt-toolbar">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Event Count</label>
            <input
              className="form-control"
              type="number"
              min={1}
              max={5000}
              value={floodCount}
              onChange={e => setFloodCount(Math.max(1, parseInt(e.target.value) || 1))}
              style={{ width: 120 }}
            />
          </div>
          <div className="btn-group" style={{ marginTop: 18 }}>
            {PRESETS.map(p => (
              <button key={p} className={`btn btn-sm ${floodCount === p ? "btn-primary" : ""}`} onClick={() => setFloodCount(p)}>{p}</button>
            ))}
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Queue Limit Override</label>
            <input
              className="form-control"
              type="number"
              min={1}
              placeholder={`uses policy (${queue.queueLimit})`}
              value={overrideLimit === "" ? "" : overrideLimit}
              onChange={e => {
                const v = e.target.value;
                setOverrideLimit(v === "" ? "" : Math.max(1, parseInt(v) || 1));
              }}
              style={{ width: 160 }}
            />
          </div>
          <div className="btn-group" style={{ marginTop: 18 }}>
            {[50, 100, 1000].map(p => (
              <button key={p} className={`btn btn-sm ${overrideLimit === p ? "btn-primary" : ""}`} onClick={() => setOverrideLimit(p)}>{p}</button>
            ))}
            <button className={`btn btn-sm ${overrideLimit === "" ? "btn-primary" : ""}`} onClick={() => setOverrideLimit("")}>default</button>
          </div>
          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={runFloodTest} disabled={running} style={{ marginTop: 18 }}>
            {running ? "Running…" : <><Icon name="play" size={14} /> Run Flood Test</>}
          </button>
        </div>

        {result && (
          <div className="slide-up mt-16">
            <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              <div className="kpi-card kpi-sky"><div className="kpi-label">Published</div><div className="kpi-value">{result.published}</div></div>
              <div className="kpi-card kpi-green"><div className="kpi-label">Accepted</div><div className="kpi-value">{result.accepted}</div></div>
              <div className="kpi-card kpi-red"><div className="kpi-label">Evicted</div><div className="kpi-value">{result.evicted}</div></div>
              <div className="kpi-card"><div className="kpi-label">Final Queue Size</div><div className="kpi-value">{result.finalQueueSize} / {result.queueLimit}</div></div>
            </div>
            <div className="table-wrap mt-16">
              <table>
                <thead><tr><th>Event Type</th><th>Generated</th><th>Accepted</th><th>Evicted</th></tr></thead>
                <tbody>
                  {Object.entries(result.breakdown).map(([type, stats]) => (
                    <tr key={type}>
                      <td className="fw-600">{formatEventType(type)}</td>
                      <td className="mono">{stats.generated}</td>
                      <td className="mono text-green">{stats.accepted}</td>
                      <td className="mono text-red">{stats.evicted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-sec mt-16" style={{ fontSize: 12 }}>
              <strong>Policy used:</strong> {result.policyName}. Lower-priority types evict first when the queue saturates — this is the bounded-queue + priority-eviction guarantee from CEP Scenario 2.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
