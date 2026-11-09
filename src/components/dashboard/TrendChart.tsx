"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/lib/chart-theme";

export type TrendDay = {
  date: string;
  label: string;
  weekday: string;
  onTime: number;
  late: number;
  saturday: boolean;
};

export function TrendChart({ trend, total }: { trend: TrendDay[]; total: number }) {
  const { chartTheme, statusHex, barGradient } = useChartTheme();
  const byDate = new Map(trend.map((d) => [d.date, d]));
  const avg = trend.length ? Math.round(trend.reduce((n, d) => n + d.onTime + d.late, 0) / trend.length) : 0;
  const summary = `Staff present per working day over the last ${trend.length} working days, average ${avg} of ${total}`;

  return (
    <div role="figure" aria-label={summary} className="h-[170px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={trend} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
          <defs>{barGradient("trend-acc", "accent")}</defs>
          <CartesianGrid vertical={false} {...chartTheme.grid} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => byDate.get(d)?.label ?? d}
            interval={1}
            tick={chartTheme.axisTick}
            tickLine={false}
            axisLine={{ stroke: chartTheme.grid.stroke }}
          />
          <YAxis allowDecimals={false} tick={chartTheme.axisTick} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            {...chartTheme.tooltip}
            labelFormatter={(d) => {
              const day = byDate.get(String(d));
              return day ? `${day.weekday} ${day.label} · ${day.onTime + day.late}/${total}` : String(d);
            }}
          />
          <Bar isAnimationActive={false} dataKey="onTime" name="On time" stackId="t" fill="url(#trend-acc)" radius={[2, 2, 2, 2]} maxBarSize={44}>
            {trend.map((d) => (
              <Cell key={d.date} fillOpacity={d.saturday ? 0.45 : 1} />
            ))}
          </Bar>
          <Bar isAnimationActive={false} dataKey="late" name="Late" stackId="t" fill={statusHex.late} radius={[5, 5, 0, 0]} maxBarSize={44}>
            {trend.map((d) => (
              <Cell key={d.date} fillOpacity={d.saturday ? 0.45 : 0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
