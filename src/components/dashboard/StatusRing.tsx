"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { chartTheme, STATUS_HEX } from "@/lib/chart-theme";
import { turnoutPercent } from "@/lib/dashboard-calc";
import { cn } from "@/lib/cn";

const SIZE = 168;

export function StatusRing({ onTime, late, absent }: { onTime: number; late: number; absent: number }) {
  const total = onTime + late + absent;
  const pct = turnoutPercent(onTime + late, total);
  const segments = [
    { key: "present", name: "On time", value: onTime, color: STATUS_HEX.present, tone: "tone-present" },
    { key: "late", name: "Late", value: late, color: STATUS_HEX.late, tone: "tone-late" },
    { key: "absent", name: "Absent", value: absent, color: STATUS_HEX.absent, tone: "tone-absent" },
  ];
  const drawn = segments.filter((s) => s.value > 0);
  const summary =
    total > 0
      ? `Today: ${onTime} on time, ${late} late, ${absent} absent, ${pct}% turned up`
      : "Today: no attendance expected or recorded";

  return (
    <div className="flex h-full flex-col items-stretch gap-[22px] min-[600px]:flex-row min-[600px]:items-center">
      <div role="figure" aria-label={summary} className="relative mx-auto flex-none" style={{ width: SIZE, height: SIZE }}>
        <PieChart width={SIZE} height={SIZE}>
          <Pie
            data={[{ name: "track", value: 1 }]}
            dataKey="value"
            innerRadius={66}
            outerRadius={78}
            fill={chartTheme.grid.stroke}
            stroke="none"
            isAnimationActive={false}
            tooltipType="none"
          />
          {drawn.length > 0 ? (
            <Pie
              data={drawn}
              dataKey="value"
              nameKey="name"
              innerRadius={66}
              outerRadius={78}
              startAngle={90}
              endAngle={-270}
              paddingAngle={drawn.length > 1 ? 2.6 : 0}
              cornerRadius={6}
              stroke="none"
              isAnimationActive={false}
            >
              {drawn.map((s) => (
                <Cell key={s.key} fill={s.color} style={{ filter: `drop-shadow(0 0 4px ${s.color}33)` }} />
              ))}
            </Pie>
          ) : null}
          <Tooltip {...chartTheme.tooltip} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <b className="num text-[34px] font-medium leading-none tracking-[-0.03em] text-text">
            {pct === null ? "—" : `${pct}%`}
          </b>
          <span className="mt-1.5 text-[12.5px] text-muted">turned up</span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {segments.map((s) => (
          <li
            key={s.key}
            className="flex items-center gap-[9px] whitespace-nowrap rounded-[10px] border border-line px-[11px] py-2 text-[13px] text-muted"
          >
            <span className={cn("size-2 flex-none rounded-full bg-(--h)", s.tone)} aria-hidden="true" />
            {s.name}
            <b className="num ml-auto font-medium text-text">{s.value}</b>
            <em className="num w-[34px] text-right text-[11.5px] not-italic text-subtle">
              {total > 0 ? `${Math.round((s.value / total) * 100)}%` : "—"}
            </em>
          </li>
        ))}
      </ul>
    </div>
  );
}
