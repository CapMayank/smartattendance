"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { barGradient, chartTheme, STATUS_HEX } from "@/lib/chart-theme";
import { parseHHMM } from "@/lib/dashboard-calc";

type Bin = { label: string; onTime: number; late: number; overflow?: "before" | "after" };

const SLOT = 15;

/** Start minute of a regular bin, or of an "after" overflow bin ("11:10+"); null for "before". */
function binStart(b: Bin): number | null {
  if (b.overflow === "before") return null;
  return parseHHMM(b.overflow === "after" ? b.label.slice(0, -1) : b.label);
}

/** The bin that contains the grace time, and where inside it the line sits. Never inside an overflow bin. */
function graceAnchor(bins: Bin[], grace: string | null) {
  if (!grace) return null;
  const g = parseHHMM(grace);
  const regular = bins.filter((b) => !b.overflow);
  for (const b of regular) {
    const start = parseHHMM(b.label);
    if (g >= start && g < start + SLOT) return { x: b.label, position: g === start ? ("start" as const) : ("middle" as const) };
  }
  const after = bins.find((b) => b.overflow === "after");
  if (after && binStart(after) === g) return { x: after.label, position: "start" as const };
  const last = regular[regular.length - 1];
  if (last && g === parseHHMM(last.label) + SLOT) return { x: last.label, position: "end" as const };
  return null;
}

function hhmm(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function slotText(b: Bin | undefined, label: string) {
  if (!b) return label;
  if (b.overflow === "before") return `Before ${b.label.slice(1)}`;
  if (b.overflow === "after") return `After ${b.label.slice(0, -1)}`;
  return `${b.label}–${hhmm(parseHHMM(b.label) + SLOT)}`;
}

export function ArrivalsChart({ arrivals, graceLabel }: { arrivals: Bin[]; graceLabel: string | null }) {
  const onTime = arrivals.reduce((n, b) => n + b.onTime, 0);
  const late = arrivals.reduce((n, b) => n + b.late, 0);
  const anchor = graceAnchor(arrivals, graceLabel);
  const byLabel = new Map(arrivals.map((b) => [b.label, b]));
  const summary =
    `Arrivals in ${SLOT}-minute slots: ${onTime} on time, ${late} late` +
    (graceLabel ? `, grace ends ${graceLabel}` : "");

  return (
    <div role="figure" aria-label={summary} className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={arrivals} margin={{ top: 18, right: 4, bottom: 0, left: -18 }}>
          <defs>
            {barGradient("arr-on", "present")}
            {barGradient("arr-late", "late")}
          </defs>
          <CartesianGrid vertical={false} {...chartTheme.grid} />
          <XAxis dataKey="label" tick={chartTheme.axisTick} tickLine={false} axisLine={{ stroke: chartTheme.grid.stroke }} />
          <YAxis allowDecimals={false} tick={chartTheme.axisTick} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            {...chartTheme.tooltip}
            labelFormatter={(label) => slotText(byLabel.get(String(label)), String(label))}
          />
          <Bar isAnimationActive={false} dataKey="onTime" name="On time" stackId="a" fill="url(#arr-on)" radius={[6, 6, 2, 2]} maxBarSize={56} />
          <Bar isAnimationActive={false} dataKey="late" name="Late" stackId="a" fill="url(#arr-late)" radius={[6, 6, 2, 2]} maxBarSize={56} />
          {anchor ? (
            <ReferenceLine
              x={anchor.x}
              position={anchor.position}
              stroke={STATUS_HEX.late}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{ value: `Grace ends ${graceLabel}`, position: "insideTopLeft", fill: STATUS_HEX.late, fontSize: 11, offset: 6, dy: -16 }}
            />
          ) : null}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
