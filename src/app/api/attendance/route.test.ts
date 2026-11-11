import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  staff: { findUnique: vi.fn(), create: vi.fn() },
  device: { upsert: vi.fn() },
  attendanceLog: { count: vi.fn(), create: vi.fn() },
  unmatchedPunch: { create: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }))

import { POST } from "./route"

const push = (body: unknown, key?: string) =>
  POST(
    new Request("http://localhost/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { "x-attendance-key": key } : {}) },
      body: JSON.stringify(body),
    })
  )

const punch = { staffId: "101", timestamp: "2026-11-06T08:45:00+05:30", type: "IN" }

describe("POST /api/attendance (gateway push)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.ATTENDANCE_PUSH_SECRET
  })

  it("is disabled when no shared secret is configured", async () => {
    const res = await push(punch, "anything")
    expect(res.status).toBe(403)
    expect(mockPrisma.attendanceLog.create).not.toHaveBeenCalled()
  })

  it("rejects a missing or wrong key", async () => {
    process.env.ATTENDANCE_PUSH_SECRET = "gateway-secret"
    expect((await push(punch)).status).toBe(401)
    expect((await push(punch, "wrong")).status).toBe(401)
    expect(mockPrisma.staff.findUnique).not.toHaveBeenCalled()
  })

  it("stores a punch for a known, employed staff member", async () => {
    process.env.ATTENDANCE_PUSH_SECRET = "gateway-secret"
    mockPrisma.staff.findUnique.mockResolvedValue({ id: "s1", machineId: "101", employmentPeriods: [] })
    mockPrisma.attendanceLog.create.mockResolvedValue({ id: "log1" })

    const res = await push(punch, "gateway-secret")
    expect(res.status).toBe(201)
    expect(mockPrisma.attendanceLog.create).toHaveBeenCalledWith({
      data: { staffId: "s1", timestamp: new Date("2026-11-06T08:45:00+05:30"), type: "IN" },
    })
  })

  it("never creates staff: an unknown machine ID goes to the unmatched queue", async () => {
    process.env.ATTENDANCE_PUSH_SECRET = "gateway-secret"
    mockPrisma.staff.findUnique.mockResolvedValue(null)
    mockPrisma.unmatchedPunch.create.mockResolvedValue({ id: "um1" })

    const res = await push({ ...punch, staffId: "9999", name: "Injected" }, "gateway-secret")
    expect(res.status).toBe(202)
    expect(mockPrisma.staff.create).not.toHaveBeenCalled()
    expect(mockPrisma.attendanceLog.create).not.toHaveBeenCalled()
    expect(mockPrisma.unmatchedPunch.create.mock.calls[0][0].data.reason).toBe("UNKNOWN_ID")
  })

  it("diverts a punch outside the employment period to the unmatched queue", async () => {
    process.env.ATTENDANCE_PUSH_SECRET = "gateway-secret"
    mockPrisma.staff.findUnique.mockResolvedValue({
      id: "s1",
      machineId: "101",
      employmentPeriods: [{ startDate: "2020-01-01", endDate: "2020-12-31" }],
    })
    mockPrisma.unmatchedPunch.create.mockResolvedValue({ id: "um2" })

    const res = await push(punch, "gateway-secret")
    expect(res.status).toBe(202)
    expect(mockPrisma.unmatchedPunch.create.mock.calls[0][0].data.reason).toBe("NOT_EMPLOYED")
  })

  it("rejects an invalid timestamp with 400", async () => {
    process.env.ATTENDANCE_PUSH_SECRET = "gateway-secret"
    const res = await push({ ...punch, timestamp: "garbage" }, "gateway-secret")
    expect(res.status).toBe(400)
  })
})
