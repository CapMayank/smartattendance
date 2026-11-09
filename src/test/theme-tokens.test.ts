import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("globals.css theme tokens", () => {
  const cssPath = path.resolve(__dirname, "../app/globals.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  it("defines light theme tokens in :root or html.light", () => {
    expect(css).toMatch(/--color-ground:\s*#F1F3F7/i);
    expect(css).toMatch(/--color-canvas:\s*#F8FAFC/i);
    expect(css).toMatch(/--color-card:\s*#FFFFFF/i);
    expect(css).toMatch(/--color-card-hi:\s*#F1F4F9/i);
    expect(css).toMatch(/--color-line:\s*#E2E8F0/i);
    expect(css).toMatch(/--color-text:\s*#0F172A/i);
    expect(css).toMatch(/--color-muted:\s*#475569/i);
    expect(css).toMatch(/--color-subtle:\s*#64748B/i);
    expect(css).toMatch(/--color-present:\s*#059669/i);
    expect(css).toMatch(/--color-late:\s*#D97706/i);
    expect(css).toMatch(/--color-absent:\s*#DC2626/i);
  });

  it("defines dark theme tokens in html.dark", () => {
    expect(css).toContain("html.dark");
    expect(css).toMatch(/--color-ground:\s*#000000/i);
    expect(css).toMatch(/--color-canvas:\s*#060607/i);
    expect(css).toMatch(/--color-card:\s*#0c0c0e/i);
    expect(css).toMatch(/--color-text:\s*#f4f4f5/i);
  });

  it("includes adaptive styles for kpi-tile in both light and dark themes", () => {
    expect(css).toContain(".kpi-tile");
    expect(css).toMatch(/html\.dark\s+\.kpi-tile/);
  });
});
