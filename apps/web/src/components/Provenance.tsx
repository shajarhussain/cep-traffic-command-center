import { timeAgo } from "../utils/formatters.js";

/**
 * Provenance — small "this data is live" line for tables.
 *
 * Renders something like:
 *   Live data · 47 records · newest 12s ago · oldest 8m ago
 *
 * Removes the "is this hardcoded?" doubt: real data carries timestamps, the
 * line proves the spread. Pass an array and a key to read the ISO timestamp
 * from each row.
 */
interface Props<T> {
  rows: T[];
  /** Function that extracts an ISO timestamp string from a row. */
  timestampOf: (row: T) => string | undefined | null;
  /** Singular noun for the count, e.g. "penalty" — pluralised automatically. */
  label?: string;
}

export function Provenance<T>({ rows, timestampOf, label = "record" }: Props<T>) {
  const times = rows
    .map(timestampOf)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .map(t => new Date(t).getTime())
    .filter(n => Number.isFinite(n));
  const count = rows.length;
  const plural = count === 1 ? label : `${label}s`;

  if (count === 0) {
    return (
      <div className="provenance" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-dim)" }}>
        <span className="dot dot-amber" style={{ width: 5, height: 5, borderRadius: "50%" }} />
        Live data · awaiting first {label}
      </div>
    );
  }

  const newest = Math.max(...times);
  const oldest = Math.min(...times);

  return (
    <div className="provenance" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-dim)" }}>
      <span className="dot dot-green" style={{ width: 5, height: 5, borderRadius: "50%" }} />
      Live data · <span className="mono">{count}</span> {plural}
      {times.length > 0 && (
        <>
          {" · newest "}<span className="mono">{timeAgo(new Date(newest).toISOString())}</span>
          {oldest !== newest && <>{" · oldest "}<span className="mono">{timeAgo(new Date(oldest).toISOString())}</span></>}
        </>
      )}
    </div>
  );
}
