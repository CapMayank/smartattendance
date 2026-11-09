import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider, useTheme, ThemeScript } from "./ThemeProvider";

function TestConsumer() {
  const { theme, resolvedTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("renders children with default theme values in SSR / static markup", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider defaultTheme="light">
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(html).toContain('data-testid="theme">light</span>');
    expect(html).toContain('data-testid="resolved">light</span>');
  });

  it("renders children with dark default theme", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider defaultTheme="dark">
        <TestConsumer />
      </ThemeProvider>,
    );

    expect(html).toContain('data-testid="theme">dark</span>');
    expect(html).toContain('data-testid="resolved">dark</span>');
  });

  it("renders ThemeScript containing anti-flicker inline code", () => {
    const html = renderToStaticMarkup(<ThemeScript />);
    expect(html).toContain("<script>");
    expect(html).toContain("localStorage.getItem('theme')");
    expect(html).toContain("document.documentElement");
    expect(html).toContain("classList.add(target)");
  });
});
