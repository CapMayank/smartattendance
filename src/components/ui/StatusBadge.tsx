import type { ReactNode } from "react";
import { AlarmClock, CircleDashed, Lock, LogIn, LogOut, Wifi, WifiOff, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type Status = "on-duty" | "left" | "late" | "absent" | "half-day" | "online" | "offline" | "locked";

const map: Record<Status, { icon: LucideIcon; word: string; tone: string }> = {
  "on-duty": { icon: LogIn, word: "On duty", tone: "tone-present" },
  left: { icon: LogOut, word: "Left", tone: "tone-muted" },
  late: { icon: AlarmClock, word: "Late", tone: "tone-late" },
  absent: { icon: XCircle, word: "Absent", tone: "tone-absent" },
  "half-day": { icon: CircleDashed, word: "Half day", tone: "tone-leave" },
  online: { icon: Wifi, word: "Online", tone: "tone-present" },
  offline: { icon: WifiOff, word: "Offline", tone: "tone-absent" },
  locked: { icon: Lock, word: "Locked", tone: "tone-muted" },
};

export function StatusBadge({ status, children }: { status: Status; children?: ReactNode }) {
  const { icon: Icon, word, tone } = map[status];
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs",
        tone,
        tone === "tone-muted" ? "border border-line bg-card-hi text-muted" : "tint-badge",
      )}
    >
      <Icon size={13} aria-hidden="true" />
      {children ?? word}
    </span>
  );
}
