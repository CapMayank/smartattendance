import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  holiday: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockRecalculateAttendance = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("@/lib/attendance", () => ({
  recalculateAttendance: mockRecalculateAttendance,
}))

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

import { getServerSession } from "next-auth/next"
import { GET, POST, DELETE } from "./route"

const mockGetServerSession = vi.mocked(getServerSession)

describe("Holidays API (/api/holidays)", () => {
  const adminUser = {
    id: "admin-1",
    role: "ADMIN",
    disabledAt: null,
    mustChangePassword: false,
    staff: null,
    approverDepartments: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerSession.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    } as any)
    mockPrisma.user.findUnique.mockResolvedValue(adminUser as any)
    mockRecalculateAttendance.mockResolvedValue(10)
  })

  describe("POST /api/holidays", () => {
    it("creates a single holiday when date is provided", async () => {
      mockPrisma.holiday.upsert.mockResolvedValue({
        id: "h-1",
        name: "Republic Day",
        date: new Date("2026-01-26T00:00:00.000Z"),
      })

      const req = new Request("http://localhost/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Republic Day", date: "2026-01-26" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)

      expect(mockPrisma.holiday.upsert).toHaveBeenCalledTimes(1)
      expect(mockRecalculateAttendance).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      )
    })

    it("creates multiple holidays when startDate and endDate range is provided", async () => {
      mockPrisma.holiday.upsert.mockImplementation(({ create }) =>
        Promise.resolve({ id: `h-${create.date.getTime()}`, ...create })
      )

      const req = new Request("http://localhost/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Diwali Holidays",
          startDate: "2026-11-01",
          endDate: "2026-11-03",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.success).toBe(true)
      expect(data.count).toBe(3)
      expect(mockPrisma.holiday.upsert).toHaveBeenCalledTimes(3)
      expect(mockRecalculateAttendance).toHaveBeenCalledTimes(1)
    })

    it("returns 400 when endDate is before startDate in range mode", async () => {
      const req = new Request("http://localhost/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Invalid Break",
          startDate: "2026-11-05",
          endDate: "2026-11-01",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toMatch(/end date cannot be before start date/i)
    })

    it("returns 400 when name is missing or neither date nor range is provided", async () => {
      const req = new Request("http://localhost/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })

  describe("GET /api/holidays", () => {
    it("fetches holidays within date interval", async () => {
      mockPrisma.holiday.findMany.mockResolvedValue([
        { id: "h-1", name: "Republic Day", date: new Date("2026-01-26") },
      ])

      const req = new Request(
        "http://localhost/api/holidays?startDate=2026-01-01&endDate=2026-01-31"
      )
      const res = await GET(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data).toHaveLength(1)
      expect(data[0].name).toBe("Republic Day")
    })
  })

  describe("DELETE /api/holidays", () => {
    it("deletes a holiday and recalculates attendance", async () => {
      mockPrisma.holiday.findUnique.mockResolvedValue({
        id: "h-1",
        name: "Republic Day",
        date: new Date("2026-01-26T00:00:00.000Z"),
      })
      mockPrisma.holiday.delete.mockResolvedValue({ id: "h-1" })

      const req = new Request("http://localhost/api/holidays?id=h-1", {
        method: "DELETE",
      })
      const res = await DELETE(req)
      expect(res.status).toBe(200)
      expect(mockPrisma.holiday.delete).toHaveBeenCalledWith({ where: { id: "h-1" } })
      expect(mockRecalculateAttendance).toHaveBeenCalledWith(
        new Date("2026-01-26T00:00:00.000Z"),
        new Date("2026-01-26T00:00:00.000Z")
      )
    })
  })
})
