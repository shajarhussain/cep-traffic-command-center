import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client.js";
import type { OperationZone, Intersection, Camera, AlertTemplate, QueuePolicy, SeverityPolicyConfig, IncidentRuleConfig, ExternalProviderConfig, FinePolicy } from "../api/client.js";
import { formatEventType } from "../utils/formatters.js";
import { useToast } from "../components/Toast.js";
import { EventTypeSelect, SeveritySelect, StatusSelect } from "../components/EventTypeSelect.js";
import { Icon } from "../components/Icon.js";

type ModalType = "camera" | "intersection" | "template" | "queuePolicy" | "severityPolicy" | "incidentRule" | "finePolicy" | null;

const API_BASE = (import.meta as unknown as { env: { VITE_API_URL?: string } }).env.VITE_API_URL ?? "http://localhost:4000";

async function jsonRequest(method: "POST" | "PUT", path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json().catch(() => ({}));
}

export function ConfigCenterPage() {
  const [zones, setZones] = useState<OperationZone[]>([]);
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [queuePolicies, setQueuePolicies] = useState<QueuePolicy[]>([]);
  const [sevPolicies, setSevPolicies] = useState<SeverityPolicyConfig[]>([]);
  const [incRules, setIncRules] = useState<IncidentRuleConfig[]>([]);
  const [extProvider, setExtProvider] = useState<ExternalProviderConfig | null>(null);
  const [finePolicies, setFinePolicies] = useState<FinePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [editId, setEditId] = useState<string | null>(null);
  // Form state is polymorphic across 6 modal types — Record<string, any> is intentional here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("zones");
  const [resetting, setResetting] = useState(false);
  const toast = useToast();

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [z, i, c, t, q, s, r, ep, fp] = await Promise.all([
      api.zones().catch(() => []), api.intersections().catch(() => []),
      api.cameras().catch(() => []), api.alertTemplates().catch(() => []),
      api.queuePolicies().catch(() => []), api.severityPolicies().catch(() => []),
      api.incidentRules().catch(() => []), api.externalProvider().catch(() => null),
      api.finePolicies().catch(() => [] as FinePolicy[]),
    ]);
    setZones(z); setIntersections(i); setCameras(c); setTemplates(t);
    setQueuePolicies(q); setSevPolicies(s); setIncRules(r); setExtProvider(ep);
    setFinePolicies(fp);
    setLoading(false);
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const openCreate = (type: ModalType) => { setModal(type); setEditId(null); setError(null); setFormData(getDefaults(type)); };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openEdit = (type: ModalType, id: string, data: Record<string, any>) => { setModal(type); setEditId(id); setError(null); setFormData(data); };
  const closeModal = () => { setModal(null); setEditId(null); setFormData({}); setError(null); };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getDefaults(type: ModalType): Record<string, any> {
    switch (type) {
      case "camera": return { cameraCode: "", name: "", intersectionName: "", speedLimitKmh: 60, status: "ACTIVE" };
      case "intersection": return { zoneId: zones[0]?.id ?? "", name: "", roadName: "", latitude: 33.7, longitude: 73.0, defaultSpeedLimit: 60, congestionThreshold: 20, status: "ACTIVE" };
      case "template": return { name: "", eventType: "VehicleDetectedEvent", description: "", defaultPayload: "{}", severityHint: "LOW", active: true };
      case "queuePolicy": return { name: "", incomingRate: 500, processingRate: 80, queueLimit: 10000, evictionPolicy: "Drop least important first; if same priority, drop oldest", active: true };
      case "severityPolicy": return { name: "", eventType: "SpeedViolationEvent", payloadField: "speed_kmh", lowThreshold: 10, mediumThreshold: 15, highThreshold: 20, criticalThreshold: 25, active: true };
      case "incidentRule": return { name: "", incidentType: "SPEED_INCIDENT", eventType: "SpeedViolationEvent", groupingWindowMinutes: 30, minimumEvents: 3, escalationThreshold: 5, autoClearEventType: "TrafficClearedEvent", active: true };
      case "finePolicy": return { name: "", eventType: "SpeedViolationEvent", excessThresholdKmh: 15, fineAmount: 3000, active: true };
      default: return {};
    }
  }

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      if (modal === "camera") {
        if (editId) await api.updateCamera(editId, formData as Partial<Camera>);
        else await api.createCamera(formData as Partial<Camera>);
      } else if (modal === "intersection") {
        if (editId) await api.updateIntersection(editId, formData as Partial<Intersection>);
        else await api.createIntersection(formData as Partial<Intersection>);
      } else if (modal === "template") {
        if (editId) await api.updateAlertTemplate(editId, formData as Partial<AlertTemplate>);
        else await api.createAlertTemplate(formData as Partial<AlertTemplate>);
      } else if (modal === "queuePolicy") {
        if (editId) await api.updateQueuePolicy(editId, formData as Partial<QueuePolicy>);
        else await jsonRequest("POST", "/api/config/queue-policies", formData);
      } else if (modal === "severityPolicy") {
        if (editId) await jsonRequest("PUT", `/api/config/severity-policies/${editId}`, formData);
        else        await jsonRequest("POST", "/api/config/severity-policies", formData);
      } else if (modal === "incidentRule") {
        if (editId) await jsonRequest("PUT", `/api/config/incident-rules/${editId}`, formData);
        else        await jsonRequest("POST", "/api/config/incident-rules", formData);
      } else if (modal === "finePolicy") {
        if (editId) await api.updateFinePolicy(editId, formData as Partial<FinePolicy>);
        else        await api.createFinePolicy(formData as Partial<FinePolicy>);
      }
      toast.success(editId ? "Changes saved" : "Item created");
      closeModal();
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Save failed";
      setError(msg);
      toast.error(msg);
    }
    setSaving(false);
  };

  const toggleExtProvider = async () => {
    if (!extProvider) return;
    try {
      await jsonRequest("PUT", "/api/config/external-provider", { enabled: !extProvider.enabled });
      toast.success(`Provider ${extProvider.enabled ? "disabled" : "enabled"}`);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Toggle failed");
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateField = (key: string, value: any) => setFormData(prev => ({ ...prev, [key]: value }));

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" /> Loading configuration...</div></div>;

  const handleResetRuntime = async () => {
    if (!confirm("Wipe all runtime data (penalties, audit logs, events, incidents, outbox, snapshots, operator actions)?\n\nConfiguration (zones, cameras, templates, fine policies, etc.) is kept. This action is auditable but irreversible.")) return;
    setResetting(true);
    try {
      const res = await api.resetRuntimeData();
      const total = Object.values(res.cleared).reduce((a, b) => a + b, 0);
      toast.success(`Runtime data wiped. ${total} rows removed.`);
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const handleDeleteFinePolicy = async (id: string) => {
    try {
      await api.deleteFinePolicy(id);
      toast.success("Fine policy deleted");
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const TABS = [
    { id: "zones", label: "Operation Zones", count: zones.length },
    { id: "intersections", label: "Intersections", count: intersections.length },
    { id: "cameras", label: "Cameras", count: cameras.length },
    { id: "templates", label: "Alert Templates", count: templates.length },
    { id: "severity", label: "Severity Policies", count: sevPolicies.length },
    { id: "fines", label: "Fine Policies", count: finePolicies.length },
    { id: "rules", label: "Incident Rules", count: incRules.length },
    { id: "queue", label: "Queue Policies", count: queuePolicies.length },
    { id: "external", label: "External Provider", count: extProvider ? 1 : 0 },
  ];

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title"><Icon name="cog" size={22} /> Configuration Center</h1>
        <p className="page-desc">User-driven configuration for all traffic monitoring parameters. Nothing is hardcoded — all values are configurable at runtime.</p>
      </div>

      <div className="callout callout-info mb-24">
        This system is designed to be fully configurable. Cameras, intersections, alert templates, severity policies, incident rules, and queue policies can all be managed here. Changes take effect immediately across the platform.
      </div>

      <div className="card mb-24" style={{ borderColor: "var(--red-glow)" }}>
        <div className="card-header">
          <div className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="trash" size={14} /> Reset Runtime Data</div>
          <span className="badge badge-red">Destructive</span>
        </div>
        <p className="text-sec" style={{ fontSize: 13, marginBottom: 12 }}>
          Wipes every <strong>runtime</strong> table (penalties, audit logs, event envelopes, processed events, incidents, outbox rows, external snapshots, operator actions, dashboard snapshots, report aggregates) but leaves all <strong>configuration</strong> intact (zones, intersections, cameras, alert templates, severity / incident / queue / fine policies, external-provider config).
        </p>
        <p className="text-sec" style={{ fontSize: 12, marginBottom: 12, opacity: 0.8 }}>
          Use this before a demo to prove no penalty / audit log / KPI is pre-loaded — start from zero and watch each number grow from your own publishes.
        </p>
        <button className="btn btn-danger btn-sm" onClick={handleResetRuntime} disabled={resetting}>
          {resetting ? "Wiping…" : <><Icon name="trash" size={12} /> Wipe Runtime Data</>}
        </button>
      </div>

      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label} <span className="tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Operation Zones */}
      {tab === "zones" && (
        <div className="config-section slide-up">
          <div className="config-section-title">Operation Zones <span className="badge badge-cyan">{zones.length}</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>City</th><th>Country</th><th>Center</th><th>Bounding Box</th><th>External Provider</th></tr></thead>
              <tbody>
                {zones.map(z => <tr key={z.id}><td className="fw-600">{z.name}</td><td>{z.city}</td><td>{z.country}</td><td className="mono">{z.centerLatitude.toFixed(4)}, {z.centerLongitude.toFixed(4)}</td><td className="mono text-muted" style={{ fontSize: 11 }}>Configured</td><td><span className={`badge ${z.externalProviderEnabled ? "badge-green" : "badge-muted"}`}>{z.externalProviderEnabled ? "Enabled" : "Disabled"}</span></td></tr>)}
                {zones.length === 0 && <tr><td colSpan={6} className="text-muted" style={{ textAlign: "center", padding: 32 }}>No zones configured</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Intersections */}
      {tab === "intersections" && (
        <div className="config-section slide-up">
          <div className="config-section-title">Intersections <span className="badge badge-blue">{intersections.length}</span> <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => openCreate("intersection")}><Icon name="plus" size={12} /> Add Intersection</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Road</th><th>Speed Limit</th><th>Congestion Threshold</th><th>Status</th><th>Coords</th><th>Actions</th></tr></thead>
              <tbody>
                {intersections.map(i => <tr key={i.id}>
                  <td className="fw-600">{i.name}</td><td>{i.roadName ?? "—"}</td><td>{i.defaultSpeedLimit} km/h</td><td>{i.congestionThreshold} vehicles</td>
                  <td><span className={`badge ${i.status === "ACTIVE" ? "badge-green" : "badge-muted"}`}>{i.status}</span></td>
                  <td className="mono" style={{ fontSize: 11 }}>{i.latitude.toFixed(4)}, {i.longitude.toFixed(4)}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit("intersection", i.id, { name: i.name, roadName: i.roadName, latitude: i.latitude, longitude: i.longitude, defaultSpeedLimit: i.defaultSpeedLimit, congestionThreshold: i.congestionThreshold, status: i.status })}>Edit</button></td>
                </tr>)}
                {intersections.length === 0 && <tr><td colSpan={7} className="text-muted" style={{ textAlign: "center", padding: 32 }}>No intersections configured</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cameras */}
      {tab === "cameras" && (
        <div className="config-section slide-up">
          <div className="config-section-title">Cameras <span className="badge badge-purple">{cameras.length}</span> <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => openCreate("camera")}><Icon name="plus" size={12} /> Add Camera</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Intersection</th><th>Speed Limit</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {cameras.map(c => <tr key={c.id}>
                  <td className="mono fw-600">{c.cameraCode}</td><td>{c.name}</td><td>{c.location}</td><td>{c.speedLimitKmh} km/h</td>
                  <td><span className={`badge ${c.status === "ACTIVE" ? "badge-green" : "badge-muted"}`}>{c.status}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit("camera", c.id, { cameraCode: c.cameraCode, name: c.name, intersectionName: c.location, speedLimitKmh: c.speedLimitKmh, status: c.status })}>Edit</button></td>
                </tr>)}
                {cameras.length === 0 && <tr><td colSpan={6} className="text-muted" style={{ textAlign: "center", padding: 32 }}>No cameras configured</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alert Templates */}
      {tab === "templates" && (
        <div className="config-section slide-up">
          <div className="config-section-title">Alert Templates <span className="badge badge-amber">{templates.length}</span> <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => openCreate("template")}><Icon name="plus" size={12} /> Add Template</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Event Type</th><th>Description</th><th>Severity Hint</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {templates.map(t => <tr key={t.id}>
                  <td className="fw-600">{t.name}</td><td><span className="badge badge-blue">{formatEventType(t.eventType)}</span></td><td style={{ maxWidth: 250 }}>{t.description}</td>
                  <td>{t.severityHint && <span className="badge badge-amber">{t.severityHint}</span>}</td>
                  <td><span className={`badge ${t.active ? "badge-green" : "badge-muted"}`}>{t.active ? "Active" : "Disabled"}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit("template", t.id, { name: t.name, eventType: t.eventType, description: t.description, defaultPayload: t.defaultPayload, severityHint: t.severityHint ?? "", active: t.active })}>Edit</button></td>
                </tr>)}
                {templates.length === 0 && <tr><td colSpan={6} className="text-muted" style={{ textAlign: "center", padding: 32 }}>No templates configured</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Severity Policies */}
      {tab === "severity" && (
        <div className="config-section slide-up">
          <div className="config-section-title">Severity Policies <span className="badge badge-purple">{sevPolicies.length}</span> <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => openCreate("severityPolicy")}><Icon name="plus" size={12} /> Add Policy</button></div>
          <div className="callout callout-info mb-16">
            Severity Policies map payload fields to alert severity levels dynamically. For example, a Speed Violation's severity is evaluated based on the "speed_excess" calculated field.
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Event Type</th><th>Field</th><th>Low</th><th>Medium</th><th>High</th><th>Critical</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {sevPolicies.map(s => <tr key={s.id}>
                  <td className="fw-600">{s.name}</td><td><span className="badge badge-blue">{formatEventType(s.eventType)}</span></td><td className="mono text-muted">{s.payloadField}</td>
                  <td>{s.lowThreshold ?? "—"}</td><td>{s.mediumThreshold ?? "—"}</td><td>{s.highThreshold ?? "—"}</td><td>{s.criticalThreshold ?? "—"}</td>
                  <td><span className={`badge ${s.active ? "badge-green" : "badge-muted"}`}>{s.active ? "Active" : "Disabled"}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit("severityPolicy", s.id, { name: s.name, eventType: s.eventType, payloadField: s.payloadField, lowThreshold: s.lowThreshold ?? 0, mediumThreshold: s.mediumThreshold ?? 0, highThreshold: s.highThreshold ?? 0, criticalThreshold: s.criticalThreshold ?? 0, active: s.active })}>Edit</button></td>
                </tr>)}
                {sevPolicies.length === 0 && <tr><td colSpan={9} className="text-muted" style={{ textAlign: "center", padding: 32 }}>No severity policies configured. System uses default hardcoded rules.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fine Policies */}
      {tab === "fines" && (
        <div className="config-section slide-up">
          <div className="config-section-title">Fine Policies <span className="badge badge-red">{finePolicies.length}</span> <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => openCreate("finePolicy")}><Icon name="plus" size={12} /> Add Fine Policy</button></div>
          <div className="callout callout-info mb-16">
            <strong>User-driven fines.</strong> AlertService picks the highest-threshold matching row when issuing a penalty for a SpeedViolationEvent.
            Fines were previously hardcoded in <span className="mono">AlertService.ts</span>; they are now fully configurable here.
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Event Type</th><th>Excess ≥ (km/h)</th><th>Fine</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {finePolicies.map(fp => (
                  <tr key={fp.id}>
                    <td className="fw-600">{fp.name}</td>
                    <td><span className="badge badge-blue">{formatEventType(fp.eventType)}</span></td>
                    <td className="mono">{fp.excessThresholdKmh}</td>
                    <td className="mono fw-600 text-red">Rs {fp.fineAmount.toLocaleString()}</td>
                    <td><span className={`badge ${fp.active ? "badge-green" : "badge-muted"}`}>{fp.active ? "Active" : "Disabled"}</span></td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit("finePolicy", fp.id, { name: fp.name, eventType: fp.eventType, excessThresholdKmh: fp.excessThresholdKmh, fineAmount: fp.fineAmount, active: fp.active })}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => handleDeleteFinePolicy(fp.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {finePolicies.length === 0 && <tr><td colSpan={6} className="text-muted" style={{ textAlign: "center", padding: 32 }}>No fine policies configured. Falling back to env defaults (DEFAULT_FINE_HIGH / MEDIUM / LOW).</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Incident Rules */}
      {tab === "rules" && (
        <div className="config-section slide-up">
          <div className="config-section-title">Incident Rules <span className="badge badge-amber">{incRules.length}</span> <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => openCreate("incidentRule")}><Icon name="plus" size={12} /> Add Rule</button></div>
          <div className="callout callout-info mb-16">
            Incident Rules define how individual events are grouped into long-running incidents. An incident is opened when the "Minimum Events" threshold is met within the "Grouping Window".
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Incident Type</th><th>Event Type</th><th>Window</th><th>Min Events</th><th>Escalation</th><th>Auto-Clear</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {incRules.map(r => <tr key={r.id}>
                  <td className="fw-600">{r.name}</td><td>{formatEventType(r.incidentType)}</td><td><span className="badge badge-blue">{formatEventType(r.eventType)}</span></td>
                  <td>{r.groupingWindowMinutes}m</td><td className="mono">{r.minimumEvents}</td><td className="mono">{r.escalationThreshold}</td>
                  <td>{r.autoClearEventType ? <span className="badge badge-green">{formatEventType(r.autoClearEventType)}</span> : "—"}</td>
                  <td><span className={`badge ${r.active ? "badge-green" : "badge-muted"}`}>{r.active ? "Active" : "Disabled"}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit("incidentRule", r.id, { name: r.name, incidentType: r.incidentType, eventType: r.eventType, groupingWindowMinutes: r.groupingWindowMinutes, minimumEvents: r.minimumEvents, escalationThreshold: r.escalationThreshold, autoClearEventType: r.autoClearEventType ?? "", active: r.active })}>Edit</button></td>
                </tr>)}
                {incRules.length === 0 && <tr><td colSpan={9} className="text-muted" style={{ textAlign: "center", padding: 32 }}>No incident rules configured. System uses default hardcoded rules.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Queue Policies */}
      {tab === "queue" && (
        <div className="config-section slide-up">
          <div className="config-section-title">Queue Policies <span className="badge badge-red">{queuePolicies.length}</span> <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => openCreate("queuePolicy")}><Icon name="plus" size={12} /> Add Policy</button></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Incoming Rate</th><th>Processing Rate</th><th>Queue Limit</th><th>Time to Full</th><th>Eviction Policy</th><th>Active</th><th>Actions</th></tr></thead>
              <tbody>
                {queuePolicies.map(q => {
                  const backlog = q.incomingRate - q.processingRate;
                  const ttf = backlog > 0 ? (q.queueLimit / backlog).toFixed(2) : "∞";
                  return <tr key={q.id}>
                    <td className="fw-600">{q.name}</td><td className="mono">{q.incomingRate}/s</td><td className="mono">{q.processingRate}/s</td><td className="mono">{q.queueLimit.toLocaleString()}</td>
                    <td className="text-red fw-600 mono">{ttf}s</td><td style={{ maxWidth: 200 }} className="text-muted">{q.evictionPolicy}</td>
                    <td><span className={`badge ${q.active ? "badge-green" : "badge-muted"}`}>{q.active ? "Active" : "Inactive"}</span></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => openEdit("queuePolicy", q.id, { name: q.name, incomingRate: q.incomingRate, processingRate: q.processingRate, queueLimit: q.queueLimit, evictionPolicy: q.evictionPolicy, active: q.active })}>Edit</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* External Provider */}
      {tab === "external" && (
        <div className="config-section slide-up">
          <div className="config-section-title">External Traffic Provider</div>
          <div className="card">
            {extProvider ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid var(--border-dim)" }}>
                  <button className={`toggle ${extProvider.enabled ? "on" : ""}`} onClick={toggleExtProvider} aria-label="Toggle Provider"></button>
                  <div>
                    <div className="fw-600" style={{ fontSize: 14 }}>{extProvider.provider} Context Provider</div>
                    <div className="text-muted" style={{ fontSize: 12 }}>{extProvider.enabled ? "Actively enhancing events with external traffic data" : "Disabled. System relies purely on internal sensors."}</div>
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                     <button className="btn btn-sm" onClick={loadAll}><Icon name="refresh" size={14} /> Refresh Status</button>
                  </div>
                </div>
                
                <div className="grid-4 gap-16 mb-24">
                  <div><div className="form-label">Status</div><span className={`badge ${extProvider.enabled ? "badge-green" : "badge-muted"}`}>{extProvider.enabled ? "Enabled" : "Disabled"}</span></div>
                  <div><div className="form-label">Key Configured</div><span className={`badge ${extProvider.keyConfigured ? "badge-green" : "badge-amber"}`}>{extProvider.keyConfigured ? "Yes" : "No / Fallback"}</span></div>
                  <div><div className="form-label">Active Zone</div><div className="fw-500">{extProvider.zone?.name ?? "Not linked"}</div></div>
                  <div><div className="form-label">Last Status Note</div><div className="mono text-muted" style={{ fontSize: 11 }}>{extProvider.lastStatus}</div></div>
                </div>

                <div className="callout callout-info mb-0">
                  <strong>Security Note:</strong> The TomTom API key is configured via server environment variables (`TOMTOM_API_KEY`) and is never exposed to the frontend. If the key is missing or invalid, the backend automatically enters "Fallback Mode" to guarantee system availability.
                </div>
              </div>
            ) : (
              <div className="empty-state"><div className="empty-state-text">No external provider configured in database</div></div>
            )}
          </div>
        </div>
      )}

      {/* Modal Overlay */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{editId ? "Edit" : "Create"} {modal === "camera" ? "Camera" : modal === "intersection" ? "Intersection" : modal === "template" ? "Alert Template" : modal === "queuePolicy" ? "Queue Policy" : modal === "severityPolicy" ? "Severity Policy" : modal === "finePolicy" ? "Fine Policy" : "Incident Rule"}</div>
              <button className="btn btn-ghost btn-sm" onClick={closeModal} aria-label="Close modal"><Icon name="close" size={14} /></button>
            </div>

            {error && <div className="error-banner">{error}</div>}

            {modal === "camera" && <>
              <div className="form-group"><label className="form-label">Camera Code</label><input className="form-control" value={formData.cameraCode ?? ""} onChange={e => updateField("cameraCode", e.target.value)} placeholder="CAM-ISB-004" disabled={!!editId} /></div>
              <div className="form-group"><label className="form-label">Name</label><input className="form-control" value={formData.name ?? ""} onChange={e => updateField("name", e.target.value)} placeholder="Highway Camera North" /></div>
              <div className="form-group"><label className="form-label">Intersection Name</label><input className="form-control" value={formData.intersectionName ?? ""} onChange={e => updateField("intersectionName", e.target.value)} placeholder="Main Road / Cross Street" /></div>
              <div className="grid-2 gap-16">
                <div className="form-group"><label className="form-label">Speed Limit (km/h)</label><input className="form-control" type="number" value={formData.speedLimitKmh ?? 60} onChange={e => updateField("speedLimitKmh", parseInt(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label">Status</label><StatusSelect kind="camera" value={formData.status ?? "ACTIVE"} onChange={(v) => updateField("status", v)} /></div>
              </div>
            </>}

            {modal === "intersection" && <>
              <div className="form-group"><label className="form-label">Zone</label><select className="form-control" value={formData.zoneId ?? ""} onChange={e => updateField("zoneId", e.target.value)}>{zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></div>
              <div className="form-group"><label className="form-label">Name</label><input className="form-control" value={formData.name ?? ""} onChange={e => updateField("name", e.target.value)} placeholder="Jinnah Avenue / New Road" /></div>
              <div className="form-group"><label className="form-label">Road Name</label><input className="form-control" value={formData.roadName ?? ""} onChange={e => updateField("roadName", e.target.value)} placeholder="Jinnah Avenue" /></div>
              <div className="grid-2 gap-16">
                <div className="form-group"><label className="form-label">Latitude</label><input className="form-control" type="number" step="0.0001" value={formData.latitude ?? 0} onChange={e => updateField("latitude", parseFloat(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label">Longitude</label><input className="form-control" type="number" step="0.0001" value={formData.longitude ?? 0} onChange={e => updateField("longitude", parseFloat(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label">Speed Limit (km/h)</label><input className="form-control" type="number" value={formData.defaultSpeedLimit ?? 60} onChange={e => updateField("defaultSpeedLimit", parseInt(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label">Congestion Threshold</label><input className="form-control" type="number" value={formData.congestionThreshold ?? 20} onChange={e => updateField("congestionThreshold", parseInt(e.target.value) || 0)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Status</label><StatusSelect kind="camera" value={formData.status ?? "ACTIVE"} onChange={(v) => updateField("status", v)} /></div>
            </>}

            {modal === "template" && <>
              <div className="form-group"><label className="form-label">Name</label><input className="form-control" value={formData.name ?? ""} onChange={e => updateField("name", e.target.value)} placeholder="Critical Speed Violation" /></div>
              <div className="grid-2 gap-16">
                <div className="form-group"><label className="form-label">Event Type</label>
                  <EventTypeSelect value={formData.eventType ?? ""} onChange={(v) => updateField("eventType", v)} />
                </div>
                <div className="form-group"><label className="form-label">Severity Hint</label>
                  <SeveritySelect value={formData.severityHint ?? ""} onChange={(v) => updateField("severityHint", v)} />
                </div>
              </div>
              <div className="form-group"><label className="form-label">Description</label><input className="form-control" value={formData.description ?? ""} onChange={e => updateField("description", e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Default Payload (JSON)</label><textarea className="form-control" value={formData.defaultPayload ?? "{}"} onChange={e => updateField("defaultPayload", e.target.value)} rows={5} /></div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={formData.active} onChange={e => updateField("active", e.target.checked)} id="tpl-active" />
                <label htmlFor="tpl-active" className="form-label" style={{ marginBottom: 0 }}>Active Template</label>
              </div>
            </>}

            {modal === "queuePolicy" && <>
              <div className="form-group"><label className="form-label">Policy Name</label><input className="form-control" value={formData.name ?? ""} onChange={e => updateField("name", e.target.value)} placeholder="Custom Scenario" /></div>
              <div className="grid-3 gap-16">
                <div className="form-group"><label className="form-label">Incoming (/s)</label><input className="form-control" type="number" value={formData.incomingRate ?? 500} onChange={e => updateField("incomingRate", parseInt(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label">Processing (/s)</label><input className="form-control" type="number" value={formData.processingRate ?? 80} onChange={e => updateField("processingRate", parseInt(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label">Queue Limit</label><input className="form-control" type="number" value={formData.queueLimit ?? 10000} onChange={e => updateField("queueLimit", parseInt(e.target.value) || 0)} /></div>
              </div>
              {formData.incomingRate > formData.processingRate && (
                <div className="callout callout-warn" style={{ margin: "0 0 16px" }}>
                  Time until full: <strong>{(formData.queueLimit / (formData.incomingRate - formData.processingRate)).toFixed(2)}s</strong>
                </div>
              )}
              <div className="form-group"><label className="form-label">Eviction Policy</label><textarea className="form-control" value={formData.evictionPolicy ?? ""} onChange={e => updateField("evictionPolicy", e.target.value)} rows={3} /></div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={formData.active} onChange={e => updateField("active", e.target.checked)} id="qp-active" />
                <label htmlFor="qp-active" className="form-label" style={{ marginBottom: 0 }}>Active Policy</label>
              </div>
            </>}

            {modal === "severityPolicy" && <>
              <div className="grid-2 gap-16">
                 <div className="form-group"><label className="form-label">Policy Name</label><input className="form-control" value={formData.name ?? ""} onChange={e => updateField("name", e.target.value)} placeholder="Speed Severity Logic" /></div>
                 <div className="form-group"><label className="form-label">Event Type</label>
                   <EventTypeSelect value={formData.eventType ?? ""} onChange={(v) => updateField("eventType", v)} />
                 </div>
              </div>
              <div className="form-group"><label className="form-label">Evaluation Field (from payload)</label><input className="form-control mono" value={formData.payloadField ?? ""} onChange={e => updateField("payloadField", e.target.value)} placeholder="speed_excess" /></div>
              
              <div className="grid-4 gap-16 mt-16">
                <div className="form-group"><label className="form-label" style={{ color: "var(--cyan)" }}>Low ≥</label><input className="form-control" type="number" value={formData.lowThreshold ?? 0} onChange={e => updateField("lowThreshold", parseInt(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label" style={{ color: "var(--blue)" }}>Medium ≥</label><input className="form-control" type="number" value={formData.mediumThreshold ?? 0} onChange={e => updateField("mediumThreshold", parseInt(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label" style={{ color: "var(--amber)" }}>High ≥</label><input className="form-control" type="number" value={formData.highThreshold ?? 0} onChange={e => updateField("highThreshold", parseInt(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label" style={{ color: "var(--red)" }}>Critical ≥</label><input className="form-control" type="number" value={formData.criticalThreshold ?? 0} onChange={e => updateField("criticalThreshold", parseInt(e.target.value) || 0)} /></div>
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <input type="checkbox" checked={formData.active} onChange={e => updateField("active", e.target.checked)} id="sp-active" />
                <label htmlFor="sp-active" className="form-label" style={{ marginBottom: 0 }}>Active Policy</label>
              </div>
            </>}

            {modal === "incidentRule" && <>
              <div className="grid-2 gap-16">
                <div className="form-group"><label className="form-label">Rule Name</label><input className="form-control" value={formData.name ?? ""} onChange={e => updateField("name", e.target.value)} placeholder="Speed Escalation Rule" /></div>
                <div className="form-group"><label className="form-label">Trigger Event Type</label>
                  <EventTypeSelect value={formData.eventType ?? ""} onChange={(v) => updateField("eventType", v)} />
                </div>
              </div>
              <div className="grid-2 gap-16">
                <div className="form-group"><label className="form-label">Incident Type Name</label><input className="form-control mono" value={formData.incidentType ?? ""} onChange={e => updateField("incidentType", e.target.value)} placeholder="SPEED_INCIDENT" /></div>
                <div className="form-group"><label className="form-label">Auto-Clear Event Type</label>
                  <EventTypeSelect value={formData.autoClearEventType ?? ""} onChange={(v) => updateField("autoClearEventType", v)} includeAll allLabel="None (Manual only)" />
                </div>
              </div>
              <div className="grid-3 gap-16 mt-16">
                <div className="form-group"><label className="form-label">Window (minutes)</label><input className="form-control" type="number" value={formData.groupingWindowMinutes ?? 30} onChange={e => updateField("groupingWindowMinutes", parseInt(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label">Min Events</label><input className="form-control" type="number" value={formData.minimumEvents ?? 3} onChange={e => updateField("minimumEvents", parseInt(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label">Escalation Threshold</label><input className="form-control" type="number" value={formData.escalationThreshold ?? 5} onChange={e => updateField("escalationThreshold", parseInt(e.target.value) || 0)} /></div>
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                <input type="checkbox" checked={formData.active} onChange={e => updateField("active", e.target.checked)} id="ir-active" />
                <label htmlFor="ir-active" className="form-label" style={{ marginBottom: 0 }}>Active Rule</label>
              </div>
            </>}

            {modal === "finePolicy" && <>
              <div className="form-group"><label className="form-label">Policy Name</label><input className="form-control" value={formData.name ?? ""} onChange={e => updateField("name", e.target.value)} placeholder="Severe Speed Excess (>30 km/h)" /></div>
              <div className="grid-2 gap-16">
                <div className="form-group"><label className="form-label">Event Type</label>
                  <EventTypeSelect value={formData.eventType ?? ""} onChange={(v) => updateField("eventType", v)} />
                </div>
                <div className="form-group"><label className="form-label">Excess Threshold (km/h)</label><input className="form-control" type="number" min={0} value={formData.excessThresholdKmh ?? 0} onChange={e => updateField("excessThresholdKmh", parseInt(e.target.value) || 0)} /></div>
              </div>
              <div className="form-group"><label className="form-label">Fine Amount (Rs)</label><input className="form-control" type="number" min={0} value={formData.fineAmount ?? 0} onChange={e => updateField("fineAmount", parseInt(e.target.value) || 0)} /></div>
              <div className="callout callout-info" style={{ marginBottom: 12 }}>
                Highest-threshold matching row wins. A policy with <span className="mono">excess ≥ 30</span> will be picked over <span className="mono">excess ≥ 15</span> for a 35 km/h excess.
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={formData.active} onChange={e => updateField("active", e.target.checked)} id="fp-active" />
                <label htmlFor="fp-active" className="form-label" style={{ marginBottom: 0 }}>Active</label>
              </div>
            </>}

            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editId ? "Save Changes" : "Create Item"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
