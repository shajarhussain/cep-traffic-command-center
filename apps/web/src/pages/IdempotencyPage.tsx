import { useState } from "react";
import { api } from "../api/client.js";
import type { DuplicateProof } from "../api/client.js";
import { Icon } from "../components/Icon.js";

export function IdempotencyPage() {
  const [result, setResult] = useState<DuplicateProof | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTest = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await api.publishDuplicate();
      setResult(res);
    } catch (e) { setError(String((e as Error)?.message ?? "Test failed")); }
    setLoading(false);
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title"><Icon name="shield" size={22} /> Duplicate Alert Safety</h1>
        <p className="page-desc">Demonstrates the Idempotent Receiver pattern — the same event published twice produces only one enforcement ticket</p>
      </div>

      <div className="callout callout-info">
        The EventBus delivers SpeedViolationEvent to AlertService <strong>twice</strong> using the <strong>same event_id</strong>.
        The BaseIdempotentSubscriber checks if the event was already processed. If yes, it skips. Result: only 1 penalty created.
      </div>

      <div className="grid-2 gap-16">
        <div className="card">
          <div className="card-header"><div className="card-title">Test Controls</div></div>
          <button className="btn btn-primary" onClick={runTest} disabled={loading} style={{ width: "100%" }}>
            {loading ? "Running…" : <><Icon name="play" size={14} /> Run Duplicate Test</>}
          </button>
          <div className="mt-16">
            <div className="card-title mb-16">How It Works</div>
            <div className="flow-row">
              <div className="flow-node" style={{ borderColor: "var(--cyan)" }}>Speed Violation<br /><span className="text-muted" style={{ fontSize: 10 }}>same event_id</span></div>
              <div className="flow-arrow">→</div>
              <div className="flow-node" style={{ borderColor: "var(--blue)" }}>EventBus<br /><span className="text-muted" style={{ fontSize: 10 }}>publish × 2</span></div>
              <div className="flow-arrow">→</div>
              <div className="flow-node" style={{ borderColor: "var(--green)" }}>AlertService<br /><span className="text-muted" style={{ fontSize: 10 }}>idempotent check</span></div>
              <div className="flow-arrow">→</div>
              <div className="flow-node" style={{ borderColor: "var(--amber)" }}>1 Ticket<br /><span className="text-muted" style={{ fontSize: 10 }}>not 2</span></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Test Result</div></div>
          {error && <div className="callout callout-error">{error}</div>}
          {result ? (
            <div className="slide-up">
              <div className="callout callout-success">Idempotency verified successfully</div>
              <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <div className="kpi-card"><div className="kpi-label">Dispatches</div><div className="kpi-value text-blue">{result.published_attempts ?? 0}</div></div>
                <div className="kpi-card" style={{ borderColor: "var(--green)" }}><div className="kpi-label">Tickets Created</div><div className="kpi-value text-green">{result.penalties_created_for_event ?? 0}</div></div>
                <div className="kpi-card"><div className="kpi-label">Duplicates Ignored</div><div className="kpi-value text-amber">{result.duplicate_ignored_by_alert ?? 0}</div></div>
              </div>
              <div className="mt-16" style={{ fontSize: 12 }}>
                <div className="form-label">Event ID</div>
                <div className="mono" style={{ fontSize: 10 }}>{result.event_id ?? "—"}</div>
              </div>
              {result.penalty && (
                <div className="mt-16" style={{ fontSize: 12 }}>
                  <div className="form-label">Penalty Details</div>
                  <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                    <div>Plate: <span className="plate">{result.penalty.vehicle_plate ?? "—"}</span></div>
                    <div>Speed: <span className="mono text-red">{result.penalty.speed_kmh ?? 0} km/h</span> (limit: {result.penalty.speed_limit_kmh ?? 0})</div>
                    <div>Fine: <span className="fw-600 text-green">PKR {(result.penalty.fine_amount ?? 0).toLocaleString()}</span></div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state"><div className="empty-state-text">Run the duplicate test to see results</div></div>
          )}
        </div>
      </div>
    </div>
  );
}
