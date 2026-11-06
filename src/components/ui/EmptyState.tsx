import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
      <span className="grid size-10 place-items-center rounded-[10px] border border-line bg-card-hi text-muted">
        <Icon size={18} aria-hidden="true" />
      </span>
      <p className="text-sm font-medium text-text">{title}</p>
      {hint ? <p className="max-w-sm text-[12.5px] text-subtle">{hint}</p> : null}
    </div>
  );
}
