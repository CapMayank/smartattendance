"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { formatTime } from "@/lib/format";
import { initials } from "@/lib/initials";
import type { ShellData } from "@/lib/shell-data";
import { getNavForRole } from "./nav";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "@/components/ThemeToggle";

export function TopStrip({ shell }: { shell: ShellData }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const navItems = useMemo(() => {
    const groups = getNavForRole(shell.roleCode);
    return groups.flatMap((g) =>
      g.items.map((item) => ({
        ...item,
        group: g.group,
      })),
    );
  }, [shell.roleCode]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return navItems;
    return navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        item.href.toLowerCase().includes(q),
    );
  }, [navItems, query]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

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
            <span aria-hidden="true" className="size-2 rounded-full bg-subtle" />
            <span>
              Last punch <span className="num text-text">{formatTime(new Date(last.time))}</span>
              {last.device ? ` at ${last.device}` : ""}
            </span>
          </>
        ) : (
          <span>No punches yet today</span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2.5 max-[600px]:ml-0 max-[600px]:w-full">
        <ThemeToggle />
        <div ref={containerRef} className="relative w-[min(340px,100%)] max-[600px]:flex-1">
          <label className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-line px-3 text-subtle focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-acc-2">
            <Search size={18} aria-hidden="true" className="flex-none" />
          <input
            type="search"
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Enter" && matches.length > 0) {
                e.preventDefault();
                handleSelect(matches[0].href);
              }
            }}
            aria-label="Quick navigation search"
            placeholder="Jump to page..."
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-text outline-none placeholder:text-subtle"
          />
        </label>

        {open && query.trim().length > 0 && (
          <div
            role="listbox"
            aria-label="Quick navigation results"
            className="absolute right-0 left-0 z-40 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-lg"
          >
            {matches.length === 0 ? (
              <div className="px-3 py-2 text-xs text-subtle">No matching pages</div>
            ) : (
              matches.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSelect(item.href)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-text transition-colors hover:bg-card-hi"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={15} className="text-acc-2" aria-hidden="true" />
                      <span>{item.label}</span>
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-subtle">{item.group}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);
}
