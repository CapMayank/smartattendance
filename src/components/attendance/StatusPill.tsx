import { CalendarDays, CheckCircle2, CircleDashed, Moon, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// Daily status pill: icon + word + tint (never colour alone). Holidays are neutral (leave is reserved).
const statusMeta: Record<string, { tone: string; icon: LucideIcon; word: string }> = {
  PRESENT: { tone: "tone-present", icon: CheckCircle2, word: "Present" },
  ABSENT: { tone: "tone-absent", icon: XCircle, word: "Absent" },
  HALF_DAY: { tone: "tone-late", icon: CircleDashed, word: "Half day" },
  HOLIDAY: { tone: "tone-muted", icon: CalendarDays, word: "Holiday" },
  WEEKOFF: { tone: "tone-muted", icon: Moon, word: "Week off" },
};

function humanize(code: string) {
  const s = code.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusPill({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { tone: "tone-late", icon: CircleDashed, word: humanize(status) };
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs",
        meta.tone,
        meta.tone === "tone-muted" ? "border border-line bg-card-hi text-muted" : "tint-badge",
      )}
    >
      <Icon size={13} aria-hidden="true" />
      {meta.word}
    </span>
  );
}
