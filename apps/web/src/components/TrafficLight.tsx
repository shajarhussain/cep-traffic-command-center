/**
 * TrafficLight — three vertical dots in a slim pill.
 *
 * Lights up the dot matching `level` (red/amber/green); the others stay dim.
 * Pure CSS — no animation, no JS. Drops into severity columns + service
 * status rows to give the UI a unique traffic-ops feel.
 */

type Level = "red" | "amber" | "green" | "off";

interface Props {
  level: Level;
  label?: string;          // accessible label (e.g., "Critical")
  size?: "sm" | "md";
}

export function TrafficLight({ level, label, size = "sm" }: Props) {
  const dim = "var(--border)";
  const colors: Record<Exclude<Level, "off">, string> = {
    red:   "#DC2626",
    amber: "#D97706",
    green: "#059669",
  };
  const red   = level === "red"   ? colors.red   : dim;
  const amber = level === "amber" ? colors.amber : dim;
  const green = level === "green" ? colors.green : dim;
  const w = size === "sm" ? 12 : 16;
  const h = size === "sm" ? 30 : 40;
  const r = size === "sm" ? 3  : 4;
  const gap = size === "sm" ? 3 : 4;

  return (
    <span
      className="traffic-light"
      role="img"
      aria-label={label ? `Status: ${label}` : `Status: ${level}`}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-evenly",
        width: w + 4,
        height: h,
        padding: 2,
        background: "var(--bg-raised)",
        border: "1px solid var(--border-dim)",
        borderRadius: w,
        gap,
      }}
    >
      <span style={{ width: r * 2, height: r * 2, borderRadius: "50%", background: red,   boxShadow: level === "red"   ? `0 0 4px ${colors.red}`   : undefined }} />
      <span style={{ width: r * 2, height: r * 2, borderRadius: "50%", background: amber, boxShadow: level === "amber" ? `0 0 4px ${colors.amber}` : undefined }} />
      <span style={{ width: r * 2, height: r * 2, borderRadius: "50%", background: green, boxShadow: level === "green" ? `0 0 4px ${colors.green}` : undefined }} />
    </span>
  );
}

/** Map an incident/severity string to a traffic-light level. */
export function levelFromSeverity(sev: string | undefined | null): Level {
  switch ((sev ?? "").toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return "red";
    case "MEDIUM":
      return "amber";
    case "LOW":
    case "INFO":
      return "green";
    default:
      return "off";
  }
}
