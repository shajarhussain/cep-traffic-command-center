interface StatusCardProps {
  label: string;
  value: number | string;
  icon: string;
  color?: "blue" | "cyan" | "green" | "yellow" | "red" | "purple";
}

const colorMap: Record<string, string> = {
  blue:   "var(--accent-blue)",
  cyan:   "var(--accent-cyan)",
  green:  "var(--accent-green)",
  yellow: "var(--accent-yellow)",
  red:    "var(--accent-red)",
  purple: "var(--accent-purple)",
};

export function StatusCard({ label, value, icon, color = "blue" }: StatusCardProps) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color: colorMap[color] }}>{value}</div>
    </div>
  );
}
