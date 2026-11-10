import Link from "next/link";
import {
  AlarmClock,
  AlertCircle,
  CalendarClock,
  ChevronRight,
  Clock,
  LogOut,
  ShieldCheck,
  WifiOff,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard";
import { cn } from "@/lib/cn";

type Item = DashboardData["attention"][number];

const look: Record<Item["kind"], { icon: LucideIcon; tone: string }> = {
  "absent-streak": { icon: XCircle, tone: "tone-absent" },
  "late-repeat": { icon: AlarmClock, tone: "tone-late" },
  "device-offline": { icon: WifiOff, tone: "tone-accent" },
  "missing-out": { icon: LogOut, tone: "tone-muted" },
  "shift-suggestions": { icon: CalendarClock, tone: "tone-accent" },
  "unmatched-punches": { icon: AlertCircle, tone: "tone-absent" },
  "pending-punch-requests": { icon: Clock, tone: "tone-late" },
  "pending-profile-requests": { icon: ShieldCheck, tone: "tone-accent" },
};

export function AttentionList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nothing needs attention"
        hint="No long absences, repeat late arrivals, offline devices or missing OUT punches."
      />
    );
  }
  return (
    <ul className="flex flex-col">
      {items.map((item, i) => {
        const { icon: Icon, tone } = look[item.kind];
        return (
          <li key={`${item.kind}-${i}`} className={cn(i > 0 && "border-t border-line-soft")}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors duration-150 hover:bg-card-hi"
            >
              <span className={cn("tint-pill grid size-8 flex-none place-items-center rounded-[9px]", tone)}>
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-medium text-text">{item.title}</b>
                <span className="block truncate text-xs text-subtle">{item.detail}</span>
              </span>
              <ChevronRight size={18} className="flex-none text-subtle" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
