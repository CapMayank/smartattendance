"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

function pageList(page: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const set = new Set([1, count, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i && n - nums[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

const btn =
  "num grid h-[30px] min-w-[30px] place-items-center rounded-lg border border-transparent px-1 text-[12.5px] text-muted transition-colors duration-150 hover:text-text disabled:cursor-not-allowed disabled:opacity-40";

export function Pagination({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-end gap-1.5">
      <button type="button" aria-label="Previous page" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={16} aria-hidden="true" />
      </button>
      {pageList(page, pageCount).map((p, i) =>
        p === "gap" ? (
          <span key={`g${i}`} className="px-1 text-subtle" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPage(p)}
            className={cn(btn, p === page && "border-line bg-card-hi text-text")}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" aria-label="Next page" className={btn} disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        <ChevronRight size={16} aria-hidden="true" />
      </button>
    </nav>
  );
}
