import { describe, it, expect } from "vitest";
import { getChartTheme, getStatusHex, getAccentHex } from "./chart-theme";

describe("chart-theme adaptation", () => {
  it("returns dark palette when theme is dark", () => {
    const theme = getChartTheme("dark");
    const status = getStatusHex("dark");
    const accent = getAccentHex("dark");

    expect(status.present).toBe("#34D399");
    expect(status.late).toBe("#F5A524");
    expect(status.absent).toBe("#F7606C");
    expect(accent.a2).toBe("#7B85FF");

    expect(theme.grid.stroke).toBe("#18181B");
    expect(theme.tooltip.contentStyle.backgroundColor).toBe("#161618");
    expect(theme.axisTick.fill).toBe("#7C7C85");
  });

  it("returns light palette when theme is light", () => {
    const theme = getChartTheme("light");
    const status = getStatusHex("light");
    const accent = getAccentHex("light");

    expect(status.present).toBe("#059669");
    expect(status.late).toBe("#D97706");
    expect(status.absent).toBe("#DC2626");
    expect(accent.a2).toBe("#4F46E5");

    expect(theme.grid.stroke).toBe("#E2E8F0");
    expect(theme.tooltip.contentStyle.backgroundColor).toBe("#FFFFFF");
    expect(theme.tooltip.contentStyle.border).toContain("#E2E8F0");
    expect(theme.axisTick.fill).toBe("#64748B");
  });
});
