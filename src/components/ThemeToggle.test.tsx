import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("renders light mode toggle button when theme is dark", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(html).toContain('aria-label="Switch to light mode"');
    expect(html).toContain("<svg");
  });

  it("renders dark mode toggle button when theme is light", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider defaultTheme="light">
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(html).toContain('aria-label="Switch to dark mode"');
    expect(html).toContain("<svg");
  });
});
