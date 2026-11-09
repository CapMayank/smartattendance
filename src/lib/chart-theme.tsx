"use client";

import type { CSSProperties } from "react";
import React from "react";
import { useTheme } from "@/components/ThemeProvider";

export type ResolvedTheme = "light" | "dark";

// Dark palette constants (Space Black)
export const DARK_ACCENT_HEX = { a1: "#A5ACFF", a2: "#7B85FF", a3: "#3B3FB8" } as const;
export const DARK_STATUS_HEX: Record<"present" | "late" | "absent" | "leave", string> = {
  present: "#34D399",
  late: "#F5A524",
  absent: "#F7606C",
  leave: "#A98BFF",
};

// Light palette constants (Slate-Paper)
export const LIGHT_ACCENT_HEX = { a1: "#4338CA", a2: "#4F46E5", a3: "#6366F1" } as const;
export const LIGHT_STATUS_HEX: Record<"present" | "late" | "absent" | "leave", string> = {
  present: "#059669",
  late: "#D97706",
  absent: "#DC2626",
  leave: "#7C3AED",
};

// Default / fallback exports for backward compatibility
export const ACCENT_HEX = DARK_ACCENT_HEX;
export const STATUS_HEX = DARK_STATUS_HEX;
export const CATEGORY_HEX = [
  DARK_ACCENT_HEX.a2,
  DARK_ACCENT_HEX.a1,
  DARK_ACCENT_HEX.a3,
  "#A1A1A8",
  "#7C7C85",
  "#52525B",
  "#3F3F46",
] as const;

export function getAccentHex(theme: ResolvedTheme) {
  return theme === "light" ? LIGHT_ACCENT_HEX : DARK_ACCENT_HEX;
}

export function getStatusHex(theme: ResolvedTheme) {
  return theme === "light" ? LIGHT_STATUS_HEX : DARK_STATUS_HEX;
}

export function getChartTheme(theme: ResolvedTheme) {
  const isLight = theme === "light";
  const text = isLight ? "#0F172A" : "#F4F4F5";
  const muted = isLight ? "#475569" : "#A1A1A8";
  const subtle = isLight ? "#64748B" : "#7C7C85";
  const cardHi = isLight ? "#FFFFFF" : "#161618";
  const line = isLight ? "#E2E8F0" : "#1E1E22";
  const grid = isLight ? "#E2E8F0" : "#18181B";

  const contentStyle: CSSProperties = {
    backgroundColor: cardHi,
    border: `1px solid ${line}`,
    borderRadius: 8,
    padding: "6px 9px",
    fontSize: 12,
    color: text,
    boxShadow: isLight ? "0 4px 12px -2px rgba(15, 23, 42, 0.08)" : "none",
  };

  return {
    axisTick: { fill: subtle, fontSize: 11 },
    grid: { stroke: grid, strokeDasharray: "3 3" },
    tooltip: {
      contentStyle,
      labelStyle: { color: muted, fontSize: 12, marginBottom: 2 } as CSSProperties,
      itemStyle: { color: text, fontSize: 12 } as CSSProperties,
      cursor: { fill: isLight ? "rgba(15, 23, 42, 0.04)" : "rgba(255, 255, 255, 0.03)" },
    },
  };
}

export const chartTheme = getChartTheme("dark");

const DARK_STOPS: Record<"accent" | "accentLight" | "neutral" | "present" | "late", [string, string, string]> = {
  accent: [DARK_ACCENT_HEX.a1, DARK_ACCENT_HEX.a2, DARK_ACCENT_HEX.a3],
  accentLight: ["#C7CBFF", DARK_ACCENT_HEX.a1, DARK_ACCENT_HEX.a1],
  neutral: ["#C4C4CA", "#A1A1A8", "#A1A1A8"],
  present: ["#6EE7B7", DARK_STATUS_HEX.present, DARK_STATUS_HEX.present],
  late: ["#FCD34D", DARK_STATUS_HEX.late, DARK_STATUS_HEX.late],
};

const LIGHT_STOPS: Record<"accent" | "accentLight" | "neutral" | "present" | "late", [string, string, string]> = {
  accent: [LIGHT_ACCENT_HEX.a3, LIGHT_ACCENT_HEX.a2, LIGHT_ACCENT_HEX.a1],
  accentLight: ["#818CF8", LIGHT_ACCENT_HEX.a2, LIGHT_ACCENT_HEX.a2],
  neutral: ["#94A3B8", "#64748B", "#475569"],
  present: ["#34D399", LIGHT_STATUS_HEX.present, "#047857"],
  late: ["#FBBF24", LIGHT_STATUS_HEX.late, "#B45309"],
};

/** Vertical gradient for bars; place inside <defs> and use fill={`url(#${id})`}. */
export function barGradient(
  id: string,
  tone: "accent" | "accentLight" | "neutral" | "present" | "late",
  theme: ResolvedTheme = "dark",
) {
  const stops = theme === "light" ? LIGHT_STOPS : DARK_STOPS;
  const [top, mid, bottom] = stops[tone];
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={top} />
      <stop offset="45%" stopColor={mid} />
      <stop offset="100%" stopColor={bottom} stopOpacity={theme === "light" ? 0.85 : 0.35} />
    </linearGradient>
  );
}

export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme;
  const currentChartTheme = getChartTheme(theme);
  const statusHex = getStatusHex(theme);
  const accentHex = getAccentHex(theme);

  const getBarGradient = (id: string, tone: "accent" | "accentLight" | "neutral" | "present" | "late") => {
    return barGradient(id, tone, theme);
  };

  return {
    theme,
    isDark: theme === "dark",
    isLight: theme === "light",
    chartTheme: currentChartTheme,
    statusHex,
    accentHex,
    barGradient: getBarGradient,
  };
}
