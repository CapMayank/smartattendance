import { GraduationCap } from "lucide-react";
import { cn } from "@/lib/cn";
import { APP_NAME, APP_TAGLINE, SCHOOL_NAME, SCHOOL_PLACE, SCHOOL_SHORT } from "@/lib/brand";

/** The Intime mark: a clock face whose hands form an "i". */
export function IntimeMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 36 36" className={cn("flex-none", className)}>
      <defs>
        <linearGradient id="intime-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-acc-2)" />
          <stop offset="1" stopColor="var(--color-acc-3)" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="10" fill="url(#intime-mark-g)" />
      <circle cx="18" cy="18" r="10.5" fill="none" stroke="#000" strokeOpacity="0.3" strokeWidth="1.5" />
      <circle cx="18" cy="11.2" r="2" fill="#000" />
      <rect x="16.4" y="15" width="3.2" height="10.5" rx="1.6" fill="#000" />
    </svg>
  );
}

/** Product lockup: mark, name and tagline. */
export function IntimeLockup({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <IntimeMark size={size} />
      <span className="min-w-0">
        <b className="block text-[15px] leading-tight font-semibold tracking-tight">{APP_NAME}</b>
        <span className="block text-xs text-subtle">{APP_TAGLINE}</span>
      </span>
    </span>
  );
}

/** School identity: crest tile, full name and place. */
export function SchoolBadge({ className, centered }: { className?: string; centered?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", centered && "justify-center", className)}>
      <span
        aria-hidden="true"
        className="grid size-8 flex-none place-items-center rounded-[9px] border border-line bg-card-hi text-acc-1"
      >
        <GraduationCap size={17} />
      </span>
      <span className="min-w-0 text-left">
        <b className="block text-[12.5px] leading-tight font-medium text-text">{SCHOOL_NAME}</b>
        <span className="block text-[11.5px] text-subtle">
          {SCHOOL_PLACE} · {SCHOOL_SHORT}
        </span>
      </span>
    </span>
  );
}
