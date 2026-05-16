import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client.js";
import type { SubscriberInfo } from "../api/client.js";
import { useToast } from "../components/Toast.js";
import { useCatalog } from "../components/EventTypeSelect.js";
import { formatEventType } from "../utils/formatters.js";
import { Icon } from "../components/Icon.js";

/**
 * Subscribers Monitor — CEP Task 2 demonstration.
 *
 * The rubric asks for a runnable demonstration of subscribe / unsubscribe.
 * This page lists each concrete subscriber, the event types it is currently
 * receiving (live bus state), and lets the operator add or remove subscriptions
 * at runtime. The result: the operator can unsubscribe AlertService from
 * SpeedViolationEvent, publish a speed violation, and watch the bus skip the
 * AlertService — no penalty is issued. Subscribing again immediately restores
 * normal routing.
 *
 * Mutations hit the live EventBus, so the warning banner directs users to the
 * "Restore Defaults" button before they leave the page.
 */
export function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<SubscriberInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newType, setNewType] = useState("");
  const toast = useToast();
  const catalog = useCatalog();

  const load = useCallback(() => {
    api.subscribers()
      .then(setSubscribers)
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to load subscribers"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5000);
    return () => clearInterval(iv);
  }, [load]);

  const handleUnsubscribe = async (name: string, eventType: string) => {
    try {
      await api.unsubscribeFrom(name, eventType);
      toast.success(`${name} unsubscribed from ${formatEventType(eventType)}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unsubscribe failed");
    }
  };

  const handleSubscribe = async (name: string) => {
    if (!newType) { toast.info("Pick an event type first"); return; }
    try {
      await api.subscribeTo(name, newType);
      toast.success(`${name} subscribed to ${formatEventType(newType)}`);
      setAddingFor(null);
      setNewType("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Subscribe failed");
    }
  };

  const handleRestoreDefaults = async () => {
    if (!confirm("Restore all subscribers to their default event-type routing?")) return;
    try {
      await api.restoreSubscriberDefaults();
      toast.success("All subscribers restored to defaults");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    }
  };

  if (loading) return <div className="page"><div className="loading-state"><div className="spinner" />Loading subscribers…</div></div>;

  const eventTypeCount = catalog?.eventTypes.length ?? 4;

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title"><Icon name="users" size={22} /> Subscribers Monitor</h1>
        <p className="page-desc">
          Live view of every Observer subscribed to the EventBus. Add or remove subscriptions at runtime to demonstrate the Observer Pattern — the bus stores <span className="mono">IEventSubscriber</span> interface references, never concrete classes.
        </p>
      </div>

      <div className="callout callout-warn mb-16">
        <strong>Heads up:</strong> Toggling subscriptions affects live event routing. If you unsubscribe AlertService from SpeedViolationEvent and publish one, no penalty will be issued. Use <strong>Restore Defaults</strong> when you're done demoing.
      </div>

      <div className="dt-toolbar">
        <span className="badge badge-cyan">{subscribers.length} subscribers</span>
        <span className="badge badge-muted">{eventTypeCount} event types in catalog</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={load}><Icon name="refresh" size={14} /> Refresh</button>
        <button className="btn btn-sm btn-primary" onClick={handleRestoreDefaults}><Icon name="refresh" size={14} /> Restore Defaults</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Subscriber</th>
              <th>Active Subscriptions</th>
              <th>Processed</th>
              <th>Duplicates Ignored</th>
              <th>Add Subscription</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map(sub => {
              const active = sub.activeEventTypes ?? sub.supportedEventTypes ?? [];
              const allTypes = catalog?.eventTypes.map(e => e.code) ?? [];
              const available = allTypes.filter(t => !active.includes(t));
              return (
                <tr key={sub.name}>
                  <td className="fw-600">{sub.name}</td>
                  <td>
                    {active.length === 0 ? (
                      <span className="text-muted">— none —</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {active.map(t => (
                          <span key={t} className="badge badge-blue" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            {formatEventType(t)}
                            <button
                              onClick={() => handleUnsubscribe(sub.name, t)}
                              title={`Unsubscribe ${sub.name} from ${formatEventType(t)}`}
                              style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700, padding: 0, lineHeight: 1 }}
                              aria-label={`Unsubscribe from ${formatEventType(t)}`}
                            ><Icon name="close" size={10} /></button>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="mono">{sub.processedCount}</td>
                  <td className="mono">{sub.duplicateIgnoredCount}</td>
                  <td>
                    {addingFor === sub.name ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <select
                          className="form-control"
                          style={{ minWidth: 180 }}
                          value={newType}
                          onChange={e => setNewType(e.target.value)}
                        >
                          <option value="">Pick event type…</option>
                          {available.map(t => <option key={t} value={t}>{formatEventType(t)}</option>)}
                        </select>
                        <button className="btn btn-sm btn-primary" onClick={() => handleSubscribe(sub.name)} disabled={!newType}>Add</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => { setAddingFor(null); setNewType(""); }}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-sm"
                        disabled={available.length === 0}
                        onClick={() => { setAddingFor(sub.name); setNewType(""); }}
                      >
                        {available.length === 0 ? "All subscribed" : <><Icon name="plus" size={12} /> Add</>}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {subscribers.length === 0 && (
              <tr><td colSpan={5}><div className="empty-state"><div className="empty-state-text">No subscribers registered</div></div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card mt-16">
        <div className="card-header"><div className="card-title">How this proves the Observer Pattern</div></div>
        <ul style={{ paddingLeft: 20, fontSize: 13, color: "var(--text-sec)", lineHeight: 1.7 }}>
          <li>The EventBus stores <span className="mono">Map&lt;string, Set&lt;IEventSubscriber&gt;&gt;</span> — only interface references, never concrete classes.</li>
          <li>Each row above is a concrete subscriber (AlertService, LoggingService…) that implements the same <span className="mono">IEventSubscriber</span> interface.</li>
          <li>Subscriptions are routed by event-type. The bus doesn't know AlertService specifically; it just dispatches to whichever interface references are registered for the type.</li>
          <li>Adding the EmergencyVehicleEvent (5th event type) would not require any change here — the EventBus and the existing subscribers are open for extension.</li>
        </ul>
      </div>
    </div>
  );
}
