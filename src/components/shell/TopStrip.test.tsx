import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ShellData } from "@/lib/shell-data";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

import { TopStrip } from "./TopStrip";
import { ThemeProvider } from "@/components/ThemeProvider";

const mockShell: ShellData = {
  userName: "Ramesh Sharma",
  userRole: "Administrator",
  roleCode: "ADMIN",
  employeeCode: "ADM001",
  staffCount: 42,
  devices: [{ id: "d1", name: "Main Gate", online: true, lastPing: new Date().toISOString() }],
  recentPunches: [],
};

describe("TopStrip", () => {
  it("renders ThemeToggle inside TopStrip", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider defaultTheme="dark">
        <TopStrip shell={mockShell} />
      </ThemeProvider>,
    );

    expect(html).toContain('aria-label="Switch to light mode"');
  });

  it("renders staff photo when profilePhotoId is present and falls back to initials when absent", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider defaultTheme="dark">
        <TopStrip
          shell={{
            ...mockShell,
            recentPunches: [
              {
                staffId: "s1",
                name: "Anita Gupta",
                profilePhotoId: "photo-1",
                time: "2026-11-13T04:14:00.000Z",
                device: null,
              },
              {
                staffId: "s2",
                name: "Rohan Yadav",
                profilePhotoId: null,
                time: "2026-11-13T04:10:00.000Z",
                device: null,
              },
            ],
          }}
        />
      </ThemeProvider>,
    );

    expect(html).toContain('src="/api/staff/s1/photo?v=photo-1"');
    expect(html).toContain("RY");
  });
});
