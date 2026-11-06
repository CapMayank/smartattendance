"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { barGradient, chartTheme, STATUS_HEX } from "@/lib/chart-theme";
import { parseHHMM } from "@/lib/dashboard-calc";

type Bin = { label: string; onTime: number; late: number };

const SLOT = 15;

/** The bin that contains the grace time, and where inside it the line sits. */
function graceAnchor(bins: Bin[], grace: string | null) {
  if (!grace || bins.length === 0) return null;
  const g = parseHHMM(grace);
  for (const b of bins) {
    const start = parseHHMM(b.label);
    if (g >= start && g < start + SLOT) return { x: b.label, position: g === start ? ("start" as const) : ("middle" as const) };
  }
  const last = bins[bins.length - 1];
  if (g === parseHHMM(last.label) + SLOT) return { x: last.label, position: "end" as const };
  return null;
}

function addSlot(label: string) {
  const m = parseHHMM(label) + SLOT;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function ArrivalsChart({ arrivals, graceLabel }: { arrivals: Bin[]; graceLabel: string | null }) {
  const onTime = arrivals.reduce((n, b) => n + b.onTime, 0);
  const late = arrivals.reduce((n, b) => n + b.late, 0);
  const anchor = graceAnchor(arrivals, graceLabel);
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
            labelFormatter={(label) => `${label}–${addSlot(String(label))}`}
          />
          <Bar dataKey="onTime" name="On time" stackId="a" fill="url(#arr-on)" radius={[6, 6, 2, 2]} maxBarSize={56} />
          <Bar dataKey="late" name="Late" stackId="a" fill="url(#arr-late)" radius={[6, 6, 2, 2]} maxBarSize={56} />
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
