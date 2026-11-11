import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "./route"
import { getServerSession } from "next-auth/next"
import { recalculateAttendance } from "@/lib/attendance"
import { prisma } from "@/lib/prisma"

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/attendance", () => ({ recalculateAttendance: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    staff: {
      count: vi.fn(),
    },
    monthlyPayroll: {
      findFirst: vi.fn(),
    },
    attendanceLog: {
      createMany: vi.fn(),
    },
  },
}))

const session = vi.mocked(getServerSession)
const mockRecalculate = vi.mocked(recalculateAttendance)
const mockUserFindUnique = vi.mocked(prisma.user.findUnique)
const mockPayrollFindFirst = vi.mocked(prisma.monthlyPayroll.findFirst)
const mockCreateMany = vi.mocked(prisma.attendanceLog.createMany)
const mockStaffCount = vi.mocked(prisma.staff.count)

describe("POST /api/punches/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Every staff id in a request exists unless a test says otherwise
    mockStaffCount.mockImplementation((async (args?: { where?: { id?: { in?: string[] } } }) =>
      new Set(args?.where?.id?.in ?? []).size) as never)
    session.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } } as never)
    mockUserFindUnique.mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    } as never)
    mockPayrollFindFirst.mockResolvedValue(null)
    mockCreateMany.mockResolvedValue({ count: 2 })
    mockRecalculate.mockResolvedValue(undefined as never)
  })

  it("returns 401/error if not an ADMIN", async () => {
    session.mockResolvedValue({ user: { id: "u2", role: "EMPLOYEE" } } as never)
    mockUserFindUnique.mockResolvedValue({
      id: "u2",
      role: "EMPLOYEE",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    } as never)
    const req = new Request("http://localhost/api/punches/bulk", {
      method: "POST",
      body: JSON.stringify({
        staffIds: ["s1"],
        startDate: "2026-01-10",
        endDate: "2026-01-10",
        time: "09:00",
        type: "IN",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("returns 400 if required fields are missing", async () => {
    const req = new Request("http://localhost/api/punches/bulk", {
      method: "POST",
      body: JSON.stringify({
        staffIds: [],
        startDate: "2026-01-10",
        endDate: "2026-01-10",
        time: "09:00",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Missing required fields")
  })

  it("rejects future dates", async () => {
    const req = new Request("http://localhost/api/punches/bulk", {
      method: "POST",
      body: JSON.stringify({
        staffIds: ["s1"],
        startDate: "2099-01-10",
        endDate: "2099-01-10",
        time: "09:00",
        type: "IN",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("future")
  })

  it("rejects if any staff payroll is locked for the range", async () => {
    mockPayrollFindFirst.mockResolvedValueOnce({ id: "pay-1", isLocked: true } as never)
    const req = new Request("http://localhost/api/punches/bulk", {
      method: "POST",
      body: JSON.stringify({
        staffIds: ["s1", "s2"],
        startDate: "2026-01-05",
        endDate: "2026-01-05",
        time: "09:00",
        type: "IN",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain("locked payroll month")
  })

  it("creates punches with explicit IST offset (+05:30) and calls recalculateAttendance", async () => {
    const req = new Request("http://localhost/api/punches/bulk", {
      method: "POST",
      body: JSON.stringify({
        staffIds: ["s1", "s2"],
        startDate: "2026-01-05",
        endDate: "2026-01-06",
        time: "09:30",
        type: "IN",
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.createdCount).toBe(4) // 2 staff * 2 days

    // Verify createMany was called with timestamps ending in +05:30 ISO representation
    // 2026-01-05 09:30:00 IST is 2026-01-05T04:00:00.000Z in UTC
    expect(mockCreateMany).toHaveBeenCalledTimes(2)
    const firstCallData = mockCreateMany.mock.calls[0][0].data as Array<{ staffId: string; timestamp: Date; type: string }>
    expect(firstCallData).toHaveLength(2)
    expect(firstCallData[0].timestamp.toISOString()).toBe("2026-01-05T04:00:00.000Z")
    expect(firstCallData[0].type).toBe("IN")

    const secondCallData = mockCreateMany.mock.calls[1][0].data as Array<{ staffId: string; timestamp: Date; type: string }>
    expect(secondCallData[0].timestamp.toISOString()).toBe("2026-01-06T04:00:00.000Z")

    // Verify recalculateAttendance was called with IST boundary dates
    expect(mockRecalculate).toHaveBeenCalledWith(
      new Date("2026-01-05T00:00:00+05:30"),
      new Date("2026-01-06T23:59:59+05:30")
    )
  })
})
