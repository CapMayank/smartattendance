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

// Mock global fetch for ShiftsPage
global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url === "/api/shifts") {
    return Promise.resolve({
      ok: true,
      json: async () => [
        { id: "s-1", name: "General Shift", startTime: "09:00", endTime: "17:00" },
      ],
    })
  }
  return Promise.resolve({
    ok: true,
    json: async () => ({ suggestions: [] }),
  })
})

import ShiftsPage from "./page"

describe("Shifts Page", () => {
  it("renders Add shift form and action buttons for ADMIN", () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: "ADMIN" } },
      status: "authenticated",
    })

    const html = renderToStaticMarkup(<ShiftsPage />)

    expect(html).toContain("Shifts")
    expect(html).toContain("Add shift")
    expect(html).toContain("Create Shift")
    expect(html).toContain("Check now")
    expect(html).not.toContain("Read-only view. Only administrators")
  })

  it("renders read-only notice and hides Add shift form and Check now for APPROVER", () => {
    mockUseSession.mockReturnValue({
      data: { user: { role: "APPROVER" } },
      status: "authenticated",
    })

    const html = renderToStaticMarkup(<ShiftsPage />)

    expect(html).toContain("Read-only view. Only administrators")
    expect(html).not.toContain("Add shift")
    expect(html).not.toContain("Create Shift")
    expect(html).not.toContain("Check now")
  })
})
