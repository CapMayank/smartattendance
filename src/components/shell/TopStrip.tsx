import { Search } from "lucide-react";
import { formatTime } from "@/lib/format";
import type { ShellData } from "@/lib/shell-data";
import { MobileNav } from "./MobileNav";

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}

export function TopStrip({ shell }: { shell: ShellData }) {
  const last = shell.recentPunches[0];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <MobileNav shell={shell} />
      {shell.recentPunches.length > 0 ? (
        <div className="flex max-[600px]:hidden" role="group" aria-label="Most recent punches">
          {shell.recentPunches.map((p, i) => (
            <span
              key={`${p.name}-${p.time}-${i}`}
              title={p.name}
              className="-ml-1.5 grid size-[38px] place-items-center rounded-[11px] border-2 border-ground bg-card-hi text-xs font-semibold text-muted first:ml-0"
            >
              {initials(p.name)}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2.5 text-[13px] text-muted">
        {last ? (
          <>
            <span aria-hidden="true" className="live-pulse size-2 rounded-full bg-present" />
            <span>
              Live · last punch <span className="num text-text">{formatTime(new Date(last.time))}</span>
              {last.device ? ` at ${last.device}` : ""}
            </span>
          </>
        ) : (
          <span>No punches yet today</span>
        )}
      </div>
      <label className="ml-auto flex h-10 w-[min(340px,100%)] items-center gap-2 rounded-[10px] border border-line px-3 text-subtle focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-acc-2 max-[600px]:ml-0 max-[600px]:w-full">
        <Search size={18} aria-hidden="true" className="flex-none" />
        <input
          type="search"
          aria-label="Search staff, ID, department"
          placeholder="Search staff, ID, department"
          className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-subtle"
        />
        <kbd className="num rounded-[5px] border border-line px-1.5 py-px text-[11px] text-subtle max-[600px]:hidden">
          Ctrl K
        </kbd>
      </label>
    </div>
  );
}
