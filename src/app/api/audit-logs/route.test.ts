import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

import { getServerSession } from "next-auth/next"
import { GET } from "./route"

const session = vi.mocked(getServerSession)

describe("GET /api/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("blocks non-admin users with 403", async () => {
    session.mockResolvedValue({ user: { id: "u-approver", role: "APPROVER" } } as never)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-approver",
      role: "APPROVER",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    })

    const res = await GET(new Request("http://localhost/api/audit-logs"))
    expect(res.status).toBe(403)
  })

  it("returns enriched audit logs for ADMIN and filters by query", async () => {
    session.mockResolvedValue({ user: { id: "u-admin", role: "ADMIN" } } as never)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-admin",
      name: "Principal Admin",
      role: "ADMIN",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    })
    mockPrisma.auditLog.findMany.mockResolvedValue([
      {
        id: "al-1",
        at: new Date("2026-11-08T10:00:00Z"),
        actorUserId: "u-admin",
        action: "STAFF_JOIN",
        targetType: "Staff",
        targetId: "s-1",
        details: JSON.stringify({ name: "Anita Verma", employeeCode: "SAR-2026-005" }),
      },
      {
        id: "al-2",
        at: new Date("2026-11-08T09:00:00Z"),
        actorUserId: "u-admin",
        action: "PASSWORD_RESET",
        targetType: "User",
        targetId: "u-2",
        details: JSON.stringify({ staffName: "Rajesh Sharma" }),
      },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u-admin", name: "Principal Admin", email: "admin@school.edu", role: "ADMIN" },
    ])

    const res = await GET(new Request("http://localhost/api/audit-logs?q=SAR-2026-005"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        id: "al-1",
        action: "STAFF_JOIN",
        actorName: "Principal Admin",
        parsedDetails: expect.objectContaining({
          name: "Anita Verma",
          employeeCode: "SAR-2026-005",
        }),
      })
    )
  })
})
