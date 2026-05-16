import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { DashboardSnapshot, TrafficIncident, Camera } from "../api/client.js";
import { Icon } from "../components/Icon.js";

export function IntersectionPage() {
  const [snapshots, setSnapshots] = useState<DashboardSnapshot[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.dashboard().catch(() => []),
      api.cameras().catch(() => []),
      api.incidents("OPEN").catch(() => []),
    ]).then(([d, c, i]) => { setSnapshots(d); setCameras(c); setIncidents(i); setLoading(false); });
  }, []);

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading…</div></div>;

  // Group cameras by intersection
  const intersections = new Map<string, { cameras: Camera[]; snapshot?: DashboardSnapshot; incidents: TrafficIncident[] }>();
  cameras.forEach(c => {
    const key = c.location || c.cameraCode;
    if (!intersections.has(key)) intersections.set(key, { cameras: [], incidents: [] });
    intersections.get(key)!.cameras.push(c);
  });
  snapshots.forEach(s => {
    const key = s.intersection_name;
    if (!intersections.has(key)) intersections.set(key, { cameras: [], incidents: [] });
    intersections.get(key)!.snapshot = s;
  });
  incidents.forEach(i => {
    const key = i.intersection_name;
    if (intersections.has(key)) intersections.get(key)!.incidents.push(i);
  });

  const congestionColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL": return "var(--red)";
      case "HIGH": case "MODERATE": return "var(--amber)";
      case "LOW": return "var(--green)";
      default: return "var(--cyan)";
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title"><Icon name="road" size={22} /> Intersection Intelligence</h1>
        <p className="page-desc">All configured intersections with camera health, congestion levels, and incident status</p>
      </div>

      <div className="kpi-strip" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <div className="kpi-card"><div className="kpi-label">Intersections</div><div className="kpi-value text-cyan">{intersections.size}</div></div>
        <div className="kpi-card"><div className="kpi-label">Active Cameras</div><div className="kpi-value text-blue">{cameras.filter(c => c.status === "ACTIVE").length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Open Incidents</div><div className="kpi-value text-amber">{incidents.length}</div></div>
      </div>

      <div className="grid-auto">
        {[...intersections.entries()].map(([name, data]) => {
          const level = data.snapshot?.congestion_level ?? "NORMAL";
          const borderColor = congestionColor(level);
          const openInc = data.incidents.length;
          return (
            <div key={name} className="card" style={{ borderColor, borderWidth: openInc > 0 ? 2 : 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div className="fw-600" style={{ fontSize: 14 }}>{name}</div>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>{data.cameras.length} camera{data.cameras.length !== 1 ? "s" : ""}</div>
                </div>
                {openInc > 0 && <span className="badge badge-red">{openInc} incident{openInc > 1 ? "s" : ""}</span>}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {data.cameras.map(c => (
                  <div key={c.id} className="service-card" style={{ flex: 1, minWidth: 120, padding: "8px 10px" }}>
                    <div className={`dot ${c.status === "ACTIVE" ? "dot-green" : "dot-red"}`} style={{ width: 6, height: 6, borderRadius: "50%" }} />
                    <div>
                      <div className="mono" style={{ fontSize: 11 }}>{c.cameraCode}</div>
                      <div className="text-muted" style={{ fontSize: 10 }}>{c.speedLimitKmh} km/h</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span className="text-sec">Congestion</span>
                <span className="fw-600" style={{ color: borderColor }}>{level}</span>
              </div>
              {data.snapshot && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 4 }}>
                  <span className="text-sec">Vehicles</span>
                  <span className="mono">{data.snapshot.vehicle_count ?? 0}</span>
                </div>
              )}
            </div>
          );
        })}
        {intersections.size === 0 && (
          <div className="card"><div className="empty-state"><div className="empty-state-text">No intersection data available — publish events from the simulator</div></div></div>
        )}
      </div>
    </div>
  );
}
