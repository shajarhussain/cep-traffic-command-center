import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { Camera, AlertTemplate, PublishPayload, EventEnvelope } from "../api/client.js";
import { formatEventType, getSeverityClass, calculateSeverity } from "../utils/formatters.js";
import { useToast } from "../components/Toast.js";
import { Icon } from "../components/Icon.js";

interface PublishResult {
  envelope: EventEnvelope;
  summary: string;
}

export function SimulatorPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [payload, setPayload] = useState("{}");
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const toast = useToast();

  const loadOptions = useCallback(() => {
    Promise.all([
      api.cameras().catch(() => [] as Camera[]),
      api.alertTemplates().catch(() => [] as AlertTemplate[]),
    ]).then(([c, t]) => {
      setCameras(c);
      const active = t.filter(tp => tp.active);
      setTemplates(active);
      setSelectedCamera(prev => prev && c.some(x => x.id === prev) ? prev : (c[0]?.id ?? ""));
      setSelectedTemplate(prev => {
        if (prev && active.some(x => x.id === prev)) return prev;
        const first = active[0];
        if (first) setPayload(buildPayload(first, c[0] ?? null));
        return first?.id ?? "";
      });
    });
  }, []);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  function buildPayload(tpl: AlertTemplate, cam: Camera | null): string {
    try {
      const base = JSON.parse(tpl.defaultPayload || "{}");
      if (cam && !base.intersection && !base.intersection_name) {
        base.intersection = cam.location || cam.cameraCode;
      }
      return JSON.stringify(base, null, 2);
    } catch {
      return tpl.defaultPayload || "{}";
    }
  }

  const handleCameraChange = (camId: string) => {
    setSelectedCamera(camId);
    const cam = cameras.find(c => c.id === camId) ?? null;
    const tpl = templates.find(t => t.id === selectedTemplate);
    if (tpl) setPayload(buildPayload(tpl, cam));
  };

  const handleTemplateChange = (id: string) => {
    setSelectedTemplate(id);
    const tpl = templates.find(t => t.id === id);
    const cam = cameras.find(c => c.id === selectedCamera) ?? null;
    if (tpl) setPayload(buildPayload(tpl, cam));
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    setResult(null);

    try {
      const tpl = templates.find(t => t.id === selectedTemplate);
      const cam = cameras.find(c => c.id === selectedCamera);

      let parsedPayload: Record<string, unknown>;
      try {
        parsedPayload = JSON.parse(payload);
      } catch {
        setError("Invalid JSON payload — please correct it before publishing.");
        setPublishing(false);
        return;
      }

      // Auto-inject intersection if missing
      if (cam && !parsedPayload.intersection && !parsedPayload.intersection_name) {
        parsedPayload.intersection = cam.location || cam.cameraCode;
      }

      const body: PublishPayload = {
        source_id: selectedCamera,
        event_type: tpl?.eventType ?? "VehicleDetectedEvent",
        payload: parsedPayload,
      };

      const res = await api.publishEvent(body);
      setResult(res);
      toast.success("Event published to the event bus");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const finalMsg = msg || "Publish failed — check the payload and try again.";
      setError(finalMsg);
      toast.error(finalMsg);
    } finally {
      setPublishing(false);
    }
  };

  const cam = cameras.find(c => c.id === selectedCamera);
  const tpl = templates.find(t => t.id === selectedTemplate);
  const env = result?.envelope;
  const severity = env ? calculateSeverity(env.event_type, env.payload) : null;

  return (
    <div className="page fade-in">
      <div className="page-header" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 className="page-title"><Icon name="bolt" size={22} /> Alert Simulator</h1>
          <p className="page-desc">Generate traffic events using configurable templates and cameras — publish to the live event bus</p>
        </div>
        <button className="btn btn-sm" onClick={loadOptions}><Icon name="refresh" size={14} /> Refresh cameras &amp; templates</button>
      </div>

      <div className="grid-2 gap-16">
        {/* Left — Configuration */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Event Configuration</div>
            {tpl && <span className={`badge badge-blue`}>{formatEventType(tpl.eventType)}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Camera Source</label>
            <select
              id="sim-camera-select"
              className="form-control"
              value={selectedCamera}
              onChange={(e) => handleCameraChange(e.target.value)}
            >
              {cameras.length === 0 && <option value="">No cameras configured</option>}
              {cameras.map(c => (
                <option key={c.id} value={c.id}>{c.cameraCode} — {c.location}</option>
              ))}
            </select>
            {cam && (
              <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                Speed limit: {cam.speedLimitKmh} km/h · Status:&nbsp;
                <span className={cam.status === "ACTIVE" ? "text-green" : "text-amber"}>{cam.status}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Alert Template</label>
            <select
              id="sim-template-select"
              className="form-control"
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              {templates.length === 0 && <option value="">No active templates</option>}
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({formatEventType(t.eventType)})</option>
              ))}
            </select>
            {tpl && (
              <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>{tpl.description}</div>
            )}
            {tpl?.severityHint && (
              <div style={{ marginTop: 4 }}>
                <span className="form-label">Severity hint: </span>
                <span className={`badge ${getSeverityClass(tpl.severityHint)}`}>{tpl.severityHint}</span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Payload (JSON)</label>
            <textarea
              id="sim-payload-textarea"
              className="form-control"
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={8}
            />
            <div className="text-muted" style={{ fontSize: 10, marginTop: 4 }}>
              Intersection auto-injected from camera. Legacy keys (speed_kmh, intersection_name) normalized automatically.
            </div>
          </div>

          <button
            id="sim-publish-btn"
            className="btn btn-primary"
            onClick={handlePublish}
            disabled={publishing || cameras.length === 0 || templates.length === 0}
            style={{ width: "100%" }}
          >
            {publishing ? "Publishing…" : <><Icon name="play" size={14} /> Publish Event</>}
          </button>

          {cameras.length === 0 && (
            <div className="callout callout-warn" style={{ marginTop: 12 }}>
              No cameras found. Add cameras in Configuration Center first.
            </div>
          )}
        </div>

        {/* Right — Result */}
        <div className="card" id="sim-result-panel">
          <div className="card-header">
            <div className="card-title">Result</div>
            {env && <span className="badge badge-green">Published</span>}
          </div>

          {error && (
            <div className="callout callout-error" id="sim-error-banner">
              <strong>Publish Failed</strong>
              <div style={{ marginTop: 4, fontWeight: 400 }}>{error}</div>
            </div>
          )}

          {env ? (
            <div className="slide-up" id="sim-success-result">
              <div className="callout callout-success">Event published successfully to the event bus</div>
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div className="form-label">Event ID</div>
                  <div className="mono" style={{ fontSize: 11 }}>{env.event_id ?? "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div className="form-label">Event Type</div>
                    <div>{formatEventType(env.event_type)}</div>
                  </div>
                  {severity && (
                    <div>
                      <div className="form-label">Severity</div>
                      <span className={`badge ${getSeverityClass(severity)}`}>{severity}</span>
                    </div>
                  )}
                </div>
                <div>
                  <div className="form-label">Source Camera</div>
                  <div className="mono" style={{ fontSize: 11 }}>{env.source_id ?? "—"}</div>
                </div>
                <div>
                  <div className="form-label">Timestamp</div>
                  <div>{env.timestamp ? new Date(env.timestamp).toLocaleString() : "—"}</div>
                </div>
                {result?.summary && (
                  <div>
                    <div className="form-label">Summary</div>
                    <div className="text-sec" style={{ fontSize: 12 }}>{result.summary}</div>
                  </div>
                )}
                {env.payload && Object.keys(env.payload).length > 0 && (
                  <div>
                    <div className="form-label">Processed Payload</div>
                    <div className="json-viewer">{JSON.stringify(env.payload, null, 2)}</div>
                  </div>
                )}
              </div>
            </div>
          ) : !error ? (
            <div className="empty-state">
              <div className="empty-state-text">Select a camera and template, then click Publish Event</div>
              <div className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                Events are published to the live event bus and processed by all subscribers
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
