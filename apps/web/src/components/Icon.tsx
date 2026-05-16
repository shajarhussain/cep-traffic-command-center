/**
 * Inline-SVG icon registry. One source of truth for every glyph in the UI.
 *
 * Design constraints:
 *   - Zero new deps (no lucide-react, no react-icons).
 *   - 24x24 viewBox, 1.5px stroke, currentColor — sized via the `size` prop.
 *   - Each path is hand-curated, traffic-ops themed where the name implies it
 *     (siren, gavel, camera, gauge, road, traffic-light).
 *   - Decorative by default (aria-hidden); pass `aria-label` to make it semantic.
 */

import type { CSSProperties } from "react";

type Path = { d: string; fill?: boolean };

const ICONS: Record<string, Path[]> = {
  // --- Actions ---
  refresh:        [{ d: "M21 12a9 9 0 1 1-2.64-6.36" }, { d: "M21 4v5h-5" }],
  play:           [{ d: "M6 4l14 8-14 8V4z", fill: true }],
  pause:          [{ d: "M7 4h4v16H7zM13 4h4v16h-4z", fill: true }],
  download:       [{ d: "M12 3v12" }, { d: "M7 10l5 5 5-5" }, { d: "M5 21h14" }],
  close:          [{ d: "M6 6l12 12M18 6L6 18" }],
  plus:           [{ d: "M12 5v14M5 12h14" }],
  trash:          [{ d: "M3 6h18" }, { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" }, { d: "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }],
  edit:           [{ d: "M11 4H4v16h16v-7" }, { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" }],
  check:          [{ d: "M5 13l4 4L19 7" }],
  "chevron-down": [{ d: "M6 9l6 6 6-6" }],
  "chevron-right":[{ d: "M9 6l6 6-6 6" }],

  // --- Section ---
  dashboard:      [{ d: "M3 13h8V3H3v10z" }, { d: "M13 21h8V11h-8v10z" }, { d: "M3 21h8v-6H3v6z" }, { d: "M13 3v6h8V3h-8z" }],
  siren:          [
    { d: "M7 18v-5a5 5 0 0 1 10 0v5" },
    { d: "M5 18h14v3H5z" },
    { d: "M12 4V2" },
    { d: "M19 7l1.5-1.5" },
    { d: "M5 7L3.5 5.5" },
  ],
  camera:         [
    { d: "M3 7h4l2-3h6l2 3h4v12H3z" },
    { d: "M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" },
  ],
  gavel:          [
    { d: "M14 4l6 6-3 3-6-6 3-3z" },
    { d: "M11 7L4 14l3 3 7-7" },
    { d: "M3 21h14" },
  ],
  chart:          [{ d: "M4 20V10" }, { d: "M10 20V4" }, { d: "M16 20v-8" }, { d: "M22 20H2" }],
  cog:            [
    { d: "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" },
    { d: "M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
  ],
  gauge:          [
    { d: "M12 14l4-4" },
    { d: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
    { d: "M12 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z", fill: true },
  ],
  shield:         [{ d: "M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" }],
  inbox:          [
    { d: "M3 14l3-9h12l3 9" },
    { d: "M3 14v6h18v-6h-6l-2 3h-2l-2-3H3z" },
  ],
  users:          [
    { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
    { d: "M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" },
    { d: "M22 21v-2a4 4 0 0 0-3-3.87" },
    { d: "M16 3.13a4 4 0 0 1 0 7.75" },
  ],
  bolt:           [{ d: "M13 2L3 14h7l-1 8 10-12h-7l1-8z", fill: true }],
  cloud:          [{ d: "M18 19a4 4 0 0 0 0-8 6 6 0 0 0-11.5-2A4.5 4.5 0 0 0 6 19h12z" }],
  road:           [
    { d: "M4 22L9 2" },
    { d: "M20 22l-5-20" },
    { d: "M12 6v2" },
    { d: "M12 12v2" },
    { d: "M12 18v2" },
  ],
  "traffic-light":[
    { d: "M9 2h6v20H9z" },
    { d: "M12 7a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" },
    { d: "M12 13a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" },
    { d: "M12 19a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" },
  ],
  "alert-triangle": [
    { d: "M10.3 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" },
    { d: "M12 9v4" },
    { d: "M12 17h.01" },
  ],
  clock:          [
    { d: "M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" },
    { d: "M12 7v5l3 2" },
  ],
};

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

export function Icon({ name, size = 16, className, style, "aria-label": ariaLabel }: IconProps) {
  const paths = ICONS[name];
  const decorative = !ariaLabel;
  if (!paths) {
    // Dev visibility for typos — never crashes the page.
    if (typeof console !== "undefined") console.warn(`[Icon] unknown name: "${name}"`);
    return <span className={className} style={{ display: "inline-block", width: size, height: size, ...style }} aria-hidden />;
  }
  return (
    <svg
      className={`icon-inline${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: "-2px", ...style }}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={ariaLabel}
    >
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill ? "currentColor" : "none"} />
      ))}
    </svg>
  );
}
