import { beforeEach, describe, expect, it, vi } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { getServerSession } from "next-auth/next"
import { getDashboardData } from "@/lib/dashboard"
import { getEmployeePortalData } from "@/lib/employee-portal"

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }))
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
}))
vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light" }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))
vi.mock("@/lib/dashboard", () => ({
  getDashboardData: vi.fn(),
  istDateKey: vi.fn(() => "2026-11-09"),
}))
vi.mock("@/lib/employee-portal", () => ({
  getEmployeePortalData: vi.fn(),
}))

const session = vi.mocked(getServerSession)
const mockGetDashboardData = vi.mocked(getDashboardData)
const mockGetEmployeePortalData = vi.mocked(getEmployeePortalData)

import Dashboard from "./page"

describe("Dashboard Page", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders unlinked staff message for EMPLOYEE without staffId without calling getDashboardData", async () => {
    session.mockResolvedValue({
      user: {
        id: "u-emp",
        name: "Test Employee",
        role: "EMPLOYEE",
        staffId: null,
      },
    } as never)

    const jsx = await Dashboard({ searchParams: Promise.resolve({}) })
    const html = renderToStaticMarkup(jsx)

    expect(html).toContain("No linked staff profile found for your account")
    expect(mockGetDashboardData).not.toHaveBeenCalled()
  })

  it("calls getDashboardData for ADMIN role", async () => {
    session.mockResolvedValue({
      user: {
        id: "u-admin",
        name: "Admin User",
        role: "ADMIN",
      },
    } as never)

    mockGetDashboardData.mockResolvedValue({
      kpis: {
        inToday: 10,
        total: 10,
        late: 0,
        absent: 0,
        devicesOnline: 1,
        devicesTotal: 1,
        pendingRequests: { punches: 0, profile: 0, total: 0 },
        deltas: {
          in: { text: "same", direction: "flat" as const },
          late: { text: "same", direction: "flat" as const },
          absent: { text: "same", direction: "flat" as const },
        },
        spark: { in: [], late: [], absent: [], devices: [] },
      },
      arrivals: [],
      commonShift: { start: "09:00", end: "17:00" },
      graceLabel: "09:15",
      ring: { onTime: 10, late: 0, absent: 0 },
      departments: [],
      attention: [],
      attentionMore: 0,
      trend: [],
      staff: [],
      punchLog: [],
      workingDay: true,
      offDayName: null,
      now: new Date().toISOString(),
    })

    const jsx = await Dashboard({ searchParams: Promise.resolve({}) })
    const html = renderToStaticMarkup(jsx)

    expect(mockGetDashboardData).toHaveBeenCalled()
    expect(html).not.toContain("No linked staff profile found for your account")
  })

  it("renders pending requests alert card when there are pending requests", async () => {
    session.mockResolvedValue({
      user: {
        id: "u-admin",
        name: "Admin User",
        role: "ADMIN",
      },
    } as never)

    mockGetDashboardData.mockResolvedValue({
      kpis: {
        inToday: 10,
        total: 10,
        late: 0,
        absent: 0,
        devicesOnline: 1,
        devicesTotal: 1,
        pendingRequests: { punches: 2, profile: 1, total: 3 },
        deltas: {
          in: { text: "same", direction: "flat" as const },
          late: { text: "same", direction: "flat" as const },
          absent: { text: "same", direction: "flat" as const },
        },
        spark: { in: [], late: [], absent: [], devices: [] },
      },
      arrivals: [],
      commonShift: { start: "09:00", end: "17:00" },
      graceLabel: "09:15",
      ring: { onTime: 10, late: 0, absent: 0 },
      departments: [],
      attention: [],
      attentionMore: 0,
      trend: [],
      staff: [],
      punchLog: [],
      workingDay: true,
      offDayName: null,
      now: new Date().toISOString(),
    })

    const jsx = await Dashboard({ searchParams: Promise.resolve({}) })
    const html = renderToStaticMarkup(jsx)

    expect(html).toContain("3 Requests Pending Administrator Review")
    expect(html).toContain("2 punch regularizations")
    expect(html).toContain("1 profile &amp; KYC update")
    expect(html).toContain("Review Requests Inbox")
  })
})
