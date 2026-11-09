import { describe, expect, it, vi } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const mockUseSession = vi.fn().mockReturnValue({
  data: { user: { role: "ADMIN" } },
  status: "authenticated",
})

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}))

// Mock global fetch for CalendarPage
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [
    { id: "h-1", name: "Republic Day", date: "2026-01-26T00:00:00.000Z" },
    { id: "h-2", name: "Independence Day", date: "2026-08-15T00:00:00.000Z" },
  ],
})

import CalendarPage from "./page"

describe("Admin Attendance Calendar Page", () => {
  it("renders the redesigned calendar with ToSchool layout elements", () => {
    const html = renderToStaticMarkup(<CalendarPage />)

    // Header & title
    expect(html).toContain("Attendance &amp; Holiday Calendar")
    expect(html).toContain("Sarvodaya English Higher Secondary School")

    // Legend
    expect(html).toContain("School Holiday")
    expect(html).toContain("Sunday Off")
    expect(html).toContain("Working Day")

    // Sidebar Overview & Stats
    expect(html).toContain("Monthly Overview")
    expect(html).toContain("Net Working Days")
    expect(html).toContain("Sundays")

    // Range action
    expect(html).toContain("Add Holiday / Range")

    // Weekday headers
    expect(html).toContain("Mon")
    expect(html).toContain("Tue")
    expect(html).toContain("Sun")
  })

  it("renders read-only notice and hides Add Holiday button for APPROVER", () => {
    mockUseSession.mockReturnValueOnce({
      data: { user: { role: "APPROVER" } },
      status: "authenticated",
    })

    const html = renderToStaticMarkup(<CalendarPage />)

    expect(html).toContain("Read-only view. Only administrators")
    expect(html).not.toContain("Add Holiday / Range")
  })
})
