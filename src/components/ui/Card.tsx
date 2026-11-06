import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: ElementType;
}) {
  return (
    <Tag className={cn("lit min-w-0 rounded-2xl border border-line bg-card px-5 py-[18px]", className)}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
        <h2 className="text-[15px] font-medium text-text">{title}</h2>
        {caption ? <p className="text-[12.5px] text-subtle">{caption}</p> : null}
      </div>
      {action ? <div className="text-[12.5px]">{action}</div> : null}
    </div>
  );
}
