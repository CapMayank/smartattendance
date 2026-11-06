import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-medium tracking-[-0.02em] text-text sm:text-[30px]">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] text-subtle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ml-auto flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
