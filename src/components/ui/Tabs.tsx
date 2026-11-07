"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

export type TabItem = { id: string; label: string; count?: number };

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const uid = useId();
  const hasSelected = tabs.some((t) => t.id === value);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    const id = tabs[next].id;
    onChange(id);
    refs.current[id]?.focus();
  }

  return (
    <div role="tablist" className="flex gap-7 overflow-x-auto overflow-y-hidden border-b border-line [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            id={`${uid}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected || (!hasSelected && i === 0) ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "ui-tab relative flex shrink-0 items-center gap-2 pb-3 text-[17px] transition-colors duration-150",
              selected ? "text-text" : "text-subtle hover:text-muted",
            )}
          >
            {t.label}
            {t.count !== undefined ? (
              <span className="num rounded-full bg-card-hi px-2 py-px text-xs text-muted">{t.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
