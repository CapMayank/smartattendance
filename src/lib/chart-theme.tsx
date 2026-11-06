import type { CSSProperties } from "react";

// Recharts cannot read CSS variables in every prop, so raw hex lives only here.
export const ACCENT_HEX = { a1: "#A5ACFF", a2: "#7B85FF", a3: "#3B3FB8" } as const;

/** Decorative category ramp (accent + neutral greys) for non-status series such as departments. */
export const CATEGORY_HEX = [ACCENT_HEX.a2, ACCENT_HEX.a1, ACCENT_HEX.a3, "#A1A1A8", "#7C7C85", "#52525B", "#3F3F46"] as const;

export const STATUS_HEX: Record<"present" | "late" | "absent" | "leave", string> = {
  present: "#34D399",
  late: "#F5A524",
  absent: "#F7606C",
  leave: "#A98BFF",
};

const TEXT = "#F4F4F5";
const MUTED = "#A1A1A8";
const SUBTLE = "#7C7C85";
const CARD_HI = "#161618";
const LINE = "#1E1E22";
const GRID = "#18181B";

const contentStyle: CSSProperties = {
  backgroundColor: CARD_HI,
  border: `1px solid ${LINE}`,
  borderRadius: 8,
  padding: "6px 9px",
  fontSize: 12,
  color: TEXT,
  boxShadow: "none",
};

export const chartTheme = {
  axisTick: { fill: SUBTLE, fontSize: 11 },
  grid: { stroke: GRID, strokeDasharray: "3 3" },
  tooltip: {
    contentStyle,
    labelStyle: { color: MUTED, fontSize: 12, marginBottom: 2 } as CSSProperties,
    itemStyle: { color: TEXT, fontSize: 12 } as CSSProperties,
    cursor: { fill: "rgba(255,255,255,0.03)" },
  },
};

const STOPS: Record<"accent" | "accentLight" | "neutral" | "present" | "late", [string, string, string]> = {
  accent: [ACCENT_HEX.a1, ACCENT_HEX.a2, ACCENT_HEX.a3],
  accentLight: ["#C7CBFF", ACCENT_HEX.a1, ACCENT_HEX.a1],
  neutral: ["#C4C4CA", MUTED, MUTED],
  present: ["#6EE7B7", STATUS_HEX.present, STATUS_HEX.present],
  late: ["#FCD34D", STATUS_HEX.late, STATUS_HEX.late],
};

/** Vertical gradient for bars; place inside <defs> and use fill={`url(#${id})`}. */
export function barGradient(id: string, tone: "accent" | "accentLight" | "neutral" | "present" | "late") {
  const [top, mid, bottom] = STOPS[tone];
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={top} />
      <stop offset="45%" stopColor={mid} />
      <stop offset="100%" stopColor={bottom} stopOpacity={0.35} />
    </linearGradient>
  );
}
