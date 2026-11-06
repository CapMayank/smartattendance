"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { toneClass, type Tone } from "./tone";
import { cn } from "@/lib/cn";

export function Chip({
  pressed,
  onClick,
  dot,
  count,
  children,
  className,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "children"> & {
  pressed: boolean;
  onClick: () => void;
  dot?: Tone;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-[34px] items-center gap-2 rounded-full border px-[13px] text-[13px] transition-colors duration-150",
        pressed ? "border-line bg-card-hi text-text" : "border-line bg-transparent text-muted hover:text-text",
        className,
      )}
      {...rest}
    >
      {dot ? (
        <span className={cn("size-[7px] rounded-full bg-(--h)", toneClass[dot])} aria-hidden="true" />
      ) : null}
      {children}
      {count !== undefined ? (
        <span className="num rounded-full bg-card-hi px-[7px] text-[11px] text-muted">{count}</span>
      ) : null}
    </button>
  );
}

export function ChipGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {children}
    </div>
  );
}
