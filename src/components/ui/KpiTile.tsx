import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { DeltaPill, type DeltaDirection } from "./DeltaPill";
import { Sparkline } from "./Sparkline";
import { toneClass, type Tone } from "./tone";
import { cn } from "@/lib/cn";

export type { Tone };

export function KpiTile({
  tone,
  icon: Icon,
  label,
  value,
  total,
  delta,
  foot,
  spark,
}: {
  tone: Tone;
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  total?: number;
  delta?: { text: string; direction: DeltaDirection; good: boolean };
  foot?: ReactNode;
  spark?: number[];
}) {
  return (
    <div className={cn("kpi-tile", toneClass[tone])}>
      <div className="flex items-center gap-2.5">
        <span className="kpi-ico">
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="text-[13.5px] text-muted">{label}</span>
        {delta ? (
          <span className="ml-auto">
            <DeltaPill {...delta} />
          </span>
        ) : null}
      </div>
      <div className="num mt-4 text-[34px] font-medium leading-none tracking-[-0.035em] text-text">
        {value}
        {total !== undefined ? (
          <small className="text-base font-normal tracking-normal text-subtle"> / {total}</small>
        ) : null}
      </div>
      {foot ? <div className="mt-1.5 text-xs text-subtle">{foot}</div> : null}
      {spark && spark.length >= 2 ? (
        <div className="-mx-[18px] mt-2.5">
          <Sparkline values={spark} tone={tone} />
        </div>
      ) : (
        <div className="h-4" />
      )}
    </div>
  );
}
