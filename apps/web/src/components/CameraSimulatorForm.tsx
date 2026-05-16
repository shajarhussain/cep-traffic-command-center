import { useState } from "react";
import { api } from "../api/client.js";
import type { Camera, EventEnvelope, PublishPayload } from "../api/client.js";
import { EnvelopeJsonViewer } from "./EnvelopeJsonViewer.js";
import { formatEventType } from "../utils/formatters.js";

const EVENT_TYPES = [
  "VehicleDetectedEvent",
  "SpeedViolationEvent",
  "CongestionAlertEvent",
  "TrafficClearedEvent",
] as const;

const DEFAULT_PAYLOADS: Record<string, Record<string, unknown>> = {
  VehicleDetectedEvent: {
    vehicle_plate: "ISB-1234",
    intersection_name: "Jinnah Avenue / F-7",
  },
  SpeedViolationEvent: {
    vehicle_plate: "ISB-5678",
    speed_kmh: 88,
    speed_limit_kmh: 60,
    intersection_name: "Blue Area Roundabout",
  },
  CongestionAlertEvent: {
    intersection_name: "F-8 Markaz / Kashmir Highway",
    vehicle_count: 47,
    congestion_level: "HIGH",
  },
  TrafficClearedEvent: {
    intersection_name: "Stadium Road / Constitution Avenue",
    cleared_at: new Date().toISOString(),
  },
};

interface CameraSimulatorFormProps {
  cameras: Camera[];
  onPublished: () => void;
}

export function CameraSimulatorForm({ cameras, onPublished }: CameraSimulatorFormProps) {
  const [eventType, setEventType] = useState<string>("VehicleDetectedEvent");
  const [sourceId, setSourceId] = useState<string>(cameras[0]?.id ?? "CAM-ISB-001");
  const [payloadText, setPayloadText] = useState<string>(
    JSON.stringify(DEFAULT_PAYLOADS["VehicleDetectedEvent"], null, 2)
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EventEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleTypeChange(t: string) {
    setEventType(t);
    setPayloadText(JSON.stringify(DEFAULT_PAYLOADS[t] ?? {}, null, 2));
    setResult(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      setError("Invalid JSON payload. Please fix the payload field.");
      return;
    }

    setLoading(true);
    try {
      const body: PublishPayload = {
        source_id: sourceId,
        event_type: eventType,
        payload: parsedPayload,
      };
      const response = await api.publishEvent(body);
      setResult(response.envelope);
      onPublished();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">📡 Camera Simulator</div>
        <span className="badge badge-green">● Live</span>
      </div>

      <form onSubmit={(e) => { void handleSubmit(e); }}>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="sim-event-type">Event Type</label>
            <select
              id="sim-event-type"
              className="form-control"
              value={eventType}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{formatEventType(t)}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="sim-source">Source Camera</label>
            <select
              id="sim-source"
              className="form-control"
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
            >
              {cameras.length > 0 ? (
                cameras.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                ))
              ) : (
                <option value="CAM-ISB-001">CAM-ISB-001 (default)</option>
              )}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="sim-payload">
            Payload (JSON) —{" "}
            <span className="text-muted">edit freely, pre-filled with realistic defaults</span>
          </label>
          <textarea
            id="sim-payload"
            className="form-control"
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            rows={6}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            id="btn-publish-event"
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                Publishing…
              </>
            ) : (
              <>📤 Publish Event</>
            )}
          </button>
          <span className="text-muted" style={{ fontSize: "12px" }}>
            → POST /api/events/publish
          </span>
        </div>
      </form>

      {error && (
        <div className="callout callout-error mt-16">❌ {error}</div>
      )}

      {result && (
        <div className="mt-16" style={{ background: "var(--bg-panel)", padding: 20, borderRadius: "var(--radius-md)", border: "1px solid var(--status-green)", position: "relative" }}>
          <div style={{ position: "absolute", top: -10, left: 20, background: "var(--status-green)", color: "#000", padding: "2px 8px", fontSize: 10, fontWeight: "bold", borderRadius: 4, textTransform: "uppercase" }}>
            Dispatch Successful
          </div>
          <div style={{ marginBottom: "14px", color: "var(--text-main)", fontSize: 13 }}>
            ✅ <strong>{formatEventType(result.event_type)}</strong> successfully injected into Event Bus.
            <div className="text-muted" style={{ fontSize: "11px", marginTop: 4 }}>
              → ID: {result.event_id}
            </div>
          </div>
          <div className="card-section-label" style={{ fontSize: 11, marginBottom: 8 }}>Cryptographic Envelope Envelope</div>
          <EnvelopeJsonViewer envelope={result} />
        </div>
      )}
    </div>
  );
}
