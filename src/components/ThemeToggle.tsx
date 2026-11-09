"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex size-10 items-center justify-center rounded-[10px] border border-line bg-card text-muted transition-colors duration-150 hover:bg-card-hi hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc-2",
        className,
      )}
    >
      {isDark ? (
        <Sun size={18} className="transition-transform duration-200 hover:rotate-12" aria-hidden="true" />
      ) : (
        <Moon size={18} className="transition-transform duration-200 hover:-rotate-12" aria-hidden="true" />
      )}
    </button>
  );
}
