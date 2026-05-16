import { useState } from "react";
import { api } from "../api/client.js";
import type { DuplicateProof } from "../api/client.js";
import { EnvelopeJsonViewer } from "./EnvelopeJsonViewer.js";

export function IdempotencyDemoPanel() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DuplicateProof | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDemo() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const proof = await api.publishDuplicate();
      setResult(proof);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title" style={{ color: "var(--status-green)" }}>
          🛡️ Duplicate Shield Testing
        </div>
      </div>

      <div className="callout callout-info" style={{ marginBottom: "16px" }}>
        <strong>Protocol:</strong> A simulated network jitter will attempt to dispatch the exact same anomaly signature (identical Alert ID) twice. The system's idempotency controls must detect the collision and prevent multiple enforcement tickets.
      </div>

      <button
        id="btn-demo-idempotency"
        className="btn btn-danger"
        onClick={runDemo}
        disabled={loading}
        style={{ marginBottom: "16px" }}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ width: 14, height: 14 }} />
            Simulating Network Anomaly…
          </>
        ) : (
          <>"⚡ Dispatch Twin Alert Signatures"</>
        )}
      </button>

      {error && (
        <div className="callout callout-error">❌ {error}</div>
      )}

      {result && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--status-amber)", padding: "20px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
              <div style={{ fontSize: "36px", fontWeight: "bold", color: "var(--status-amber)" }}>{result.published_attempts}</div>
              <div className="text-muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: 1 }}>Ingress Dispatches</div>
            </div>
            <div style={{ background: "var(--bg-panel)", border: "1px solid var(--status-green)", padding: "20px", borderRadius: "var(--radius-md)", textAlign: "center" }}>
              <div style={{ fontSize: "36px", fontWeight: "bold", color: "var(--status-green)" }}>{result.penalties_created_for_event}</div>
              <div className="text-muted" style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: 1 }}>Enforcement Tickets</div>
            </div>
          </div>

          <div className="callout callout-success" style={{ margin: "12px 0" }}>
            🛡️ <strong>Safety Verified:</strong> {result.published_attempts} ingress events collapsed into{" "}
            {result.penalties_created_for_event} verified action.{" "}
            {result.duplicate_ignored_by_alert > 0 && (
              <span>
                Mesh routing dropped <strong>{result.duplicate_ignored_by_alert}</strong> collision signature(s) at the edge.
              </span>
            )}
          </div>

          <div className="card-section-label mt-12 text-muted" style={{ fontSize: "12px" }}>Anomaly Signature Hash</div>
          <div style={{ marginBottom: "16px", padding: "8px 12px", background: "var(--bg-panel)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", fontFamily: "var(--mono)", fontSize: "12px", color: "var(--accent-cyan)" }}>
            {result.event_id}
          </div>

          {result.penalty && (
            <>
              <div className="card-section-label text-muted" style={{ fontSize: "12px", marginBottom: "8px" }}>Enforcement Action Issued</div>
              <EnvelopeJsonViewer
                envelope={{
                  event_id: result.event_id,
                  correlation_id: result.penalty.camera_id,
                  schema_version: 1,
                  source_id: result.penalty.camera_id,
                  timestamp: result.penalty.issued_at,
                  event_type: "SpeedViolationEvent",
                  payload: {
                    vehicle_plate: result.penalty.vehicle_plate,
                    speed_kmh: result.penalty.speed_kmh,
                    speed_limit_kmh: result.penalty.speed_limit_kmh,
                    fine_amount: result.penalty.fine_amount,
                    status: result.penalty.status,
                  },
                }}
                compact
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
