import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import "./styles/index.css";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { ToastProvider } from "./components/Toast.js";

// Pages
import { CommandCenterPage } from "./pages/CommandCenterPage.js";
import { IncidentOpsPage } from "./pages/IncidentOpsPage.js";
import { ConfigCenterPage } from "./pages/ConfigCenterPage.js";
import { SimulatorPage } from "./pages/SimulatorPage.js";
import { LiveAlertPage } from "./pages/LiveAlertPage.js";
import { IdempotencyPage } from "./pages/IdempotencyPage.js";
import { EnforcementPage } from "./pages/EnforcementPage.js";
import { IntersectionPage } from "./pages/IntersectionPage.js";
import { CapacityPage } from "./pages/CapacityPage.js";
import { ReliabilityPage } from "./pages/ReliabilityPage.js";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { AuditPage } from "./pages/AuditPage.js";
import { OutboxPage } from "./pages/OutboxPage.js";
import { SubscribersPage } from "./pages/SubscribersPage.js";
import { Icon } from "./components/Icon.js";
import { api } from "./api/client.js";

type SectionId = "overview" | "incidents" | "cameras" | "enforcement" | "analytics" | "system";

interface SubView { id: string; label: string; render: () => ReactNode; }
interface Section { id: SectionId; label: string; icon: string; tabs: SubView[]; }

const SECTIONS: Section[] = [
  { id: "overview", label: "Overview", icon: "dashboard", tabs: [
    { id: "home", label: "Dashboard", render: () => <CommandCenterPage /> },
  ]},
  { id: "incidents", label: "Incidents", icon: "siren", tabs: [
    { id: "open",   label: "Incident Operations", render: () => <IncidentOpsPage /> },
    { id: "stream", label: "Live Event Stream",   render: () => <LiveAlertPage /> },
  ]},
  { id: "cameras", label: "Cameras", icon: "camera", tabs: [
    { id: "intersections", label: "Intersection Intelligence", render: () => <IntersectionPage /> },
    { id: "simulator",     label: "Event Simulator",           render: () => <SimulatorPage /> },
  ]},
  { id: "enforcement", label: "Enforcement", icon: "gavel", tabs: [
    { id: "penalties", label: "Penalties",   render: () => <EnforcementPage /> },
    { id: "audit",     label: "Audit Trail", render: () => <AuditPage /> },
  ]},
  { id: "analytics", label: "Analytics", icon: "chart", tabs: [
    { id: "reports", label: "Traffic Analytics", render: () => <AnalyticsPage /> },
  ]},
  { id: "system", label: "System", icon: "cog", tabs: [
    { id: "capacity",    label: "Capacity",     render: () => <CapacityPage /> },
    { id: "reliability", label: "Reliability",  render: () => <ReliabilityPage /> },
    { id: "subscribers", label: "Subscribers",  render: () => <SubscribersPage /> },
    { id: "idempotency", label: "Idempotency",  render: () => <IdempotencyPage /> },
    { id: "outbox",      label: "Outbox",       render: () => <OutboxPage /> },
    { id: "config",      label: "Configuration", render: () => <ConfigCenterPage /> },
  ]},
];

function readHash(): { section: SectionId; sub: string } {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const [s, t] = hash.split("/");
  const section = SECTIONS.find(sec => sec.id === s);
  if (!section) return { section: "overview", sub: "home" };
  const sub = section.tabs.find(tab => tab.id === t) ?? section.tabs[0]!;
  return { section: section.id, sub: sub.id };
}

export default function App() {
  const initial = useMemo(readHash, []);
  const [section, setSection] = useState<SectionId>(initial.section);
  const [sub, setSub] = useState<string>(initial.sub);
  const [apiOnline, setApiOnline] = useState(false);

  // Health polling
  useEffect(() => {
    const ping = () => api.health().then(() => setApiOnline(true)).catch(() => setApiOnline(false));
    ping();
    const iv = setInterval(ping, 15000);
    return () => clearInterval(iv);
  }, []);

  // Persist section/sub to URL hash + react to browser back/forward
  useEffect(() => {
    const target = `#/${section}/${sub}`;
    if (window.location.hash !== target) window.history.replaceState(null, "", target);
  }, [section, sub]);
  useEffect(() => {
    const onPop = () => { const r = readHash(); setSection(r.section); setSub(r.sub); };
    window.addEventListener("hashchange", onPop);
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("hashchange", onPop); window.removeEventListener("popstate", onPop); };
  }, []);

  const currentSection = SECTIONS.find(s => s.id === section)!;
  const currentSub = currentSection.tabs.find(t => t.id === sub) ?? currentSection.tabs[0]!;

  const switchSection = (id: SectionId) => {
    if (id === section) return;
    const target = SECTIONS.find(s => s.id === id)!;
    setSection(id);
    setSub(target.tabs[0]!.id);
  };

  return (
    <ToastProvider>
      <div className="app-shell">
        <header className="topnav" role="banner">
          <div className="topnav-brand">
            <div className="topnav-logo">TO</div>
            <div>
              <div className="topnav-title">Traffic Ops</div>
              <div className="topnav-subtitle">Incident-Aware Command Center</div>
            </div>
          </div>

          <nav className="topnav-links" role="navigation" aria-label="Main">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                id={`nav-${s.id}`}
                className={`topnav-link ${section === s.id ? "active" : ""}`}
                onClick={() => switchSection(s.id)}
                aria-current={section === s.id ? "page" : undefined}
              >
                <Icon name={s.icon} size={14} /> {s.label}
              </button>
            ))}
          </nav>

          <div className="topnav-right">
            <span className={`topnav-status ${apiOnline ? "online" : "offline"}`} aria-live="polite">
              <span className={`dot ${apiOnline ? "dot-green" : "dot-red"}`} style={{ width: 7, height: 7, borderRadius: "50%" }} />
              {apiOnline ? "API Online" : "API Offline"}
            </span>
          </div>
        </header>

        <main className="main-content" id="main-content">
          {currentSection.tabs.length > 1 && (
            <div className="page" style={{ paddingTop: 20, paddingBottom: 0 }}>
              <div className="tab-bar" role="tablist" aria-label={`${currentSection.label} sub-sections`}>
                {currentSection.tabs.map(t => (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={sub === t.id}
                    className={`tab-item ${sub === t.id ? "active" : ""}`}
                    onClick={() => setSub(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ErrorBoundary key={`${section}/${sub}`}>
            {currentSub.render()}
          </ErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  );
}
