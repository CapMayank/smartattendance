import type { ReactNode } from "react";

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[11.5px] uppercase tracking-[0.09em] text-subtle after:h-px after:flex-1 after:bg-line-soft after:content-['']">
      {children}
    </div>
  );
}
