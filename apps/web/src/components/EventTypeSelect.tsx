import { useEffect, useState } from "react";
import { fetchCatalog, getCachedCatalog } from "../api/catalog.js";
import type { Catalog } from "../api/catalog.js";

/**
 * Hook: lazily loads the /api/event-types catalog and re-renders consumers
 * once it arrives. Components get a stable Catalog reference per session.
 */
export function useCatalog(): Catalog | null {
  const [catalog, setCatalog] = useState<Catalog | null>(getCachedCatalog());
  useEffect(() => {
    if (catalog) return;
    let mounted = true;
    void fetchCatalog().then(c => { if (mounted) setCatalog(c); });
    return () => { mounted = false; };
  }, [catalog]);
  return catalog;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
  includeAll?: boolean;   // adds an "All" option when true (for filters)
  allLabel?: string;
}

/**
 * Dropdown of event-type codes from the catalog. Single source of truth —
 * adding a 5th event type to EVENT_TYPES.ts surfaces here automatically.
 */
export function EventTypeSelect(props: SelectProps) {
  const catalog = useCatalog();
  const options = catalog?.eventTypes ?? [];
  return (
    <select
      id={props.id}
      className={props.className ?? "form-control"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
    >
      {props.includeAll && <option value="">{props.allLabel ?? "All event types"}</option>}
      {options.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
    </select>
  );
}

interface OptionalProps extends Omit<SelectProps, "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

export function SeveritySelect(props: OptionalProps) {
  const catalog = useCatalog();
  const options = catalog?.severities ?? [];
  return (
    <select
      id={props.id}
      className={props.className ?? "form-control"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
    >
      {props.includeAll && <option value="">{props.allLabel ?? "All severities"}</option>}
      {options.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

interface StatusSelectProps extends OptionalProps {
  kind: "camera" | "incident" | "outbox" | "penalty";
}

export function StatusSelect(props: StatusSelectProps) {
  const catalog = useCatalog();
  const options = catalog?.statuses[props.kind] ?? [];
  return (
    <select
      id={props.id}
      className={props.className ?? "form-control"}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
    >
      {props.includeAll && <option value="">{props.allLabel ?? "All statuses"}</option>}
      {options.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}
