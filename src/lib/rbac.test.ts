import { describe, expect, it, vi, beforeEach } from "vitest"
import type { Session } from "next-auth"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

import { requireRole } from "./rbac"
import { istDateKey } from "./dashboard-calc"

describe("requireRole guard", () => {
  const todayKey = istDateKey(new Date())

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when session is null or has no user id", async () => {
    const res1 = await requireRole(null, ["EMPLOYEE"])
    expect(res1.errorResponse?.status).toBe(401)
    const body1 = await res1.errorResponse?.json()
    expect(body1).toEqual({ error: "Unauthorized" })
    expect(res1.user).toBeUndefined()

    const res2 = await requireRole({ user: {} } as unknown as Session, ["EMPLOYEE"])
    expect(res2.errorResponse?.status).toBe(401)
    const body2 = await res2.errorResponse?.json()
    expect(body2).toEqual({ error: "Unauthorized" })
  })

  it("returns 401 when user is not found in database", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const session = { user: { id: "u-not-found" } } as Session

    const res = await requireRole(session, ["EMPLOYEE"])
    expect(res.errorResponse?.status).toBe(401)
    const body = await res.errorResponse?.json()
    expect(body).toEqual({ error: "Account disabled or not found" })
  })

  it("returns 401 when user is disabled in database (immediate revocation)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-disabled",
      name: "Disabled User",
      role: "EMPLOYEE",
      disabledAt: new Date("2026-11-01T00:00:00Z"),
      staff: null,
      approverDepartments: [],
      mustChangePassword: false,
    })
    const session = { user: { id: "u-disabled" } } as Session

    const res = await requireRole(session, ["EMPLOYEE"])
    expect(res.errorResponse?.status).toBe(401)
    const body = await res.errorResponse?.json()
    expect(body).toEqual({ error: "Account disabled or not found" })
  })

  it("returns 401 when employee has ended employment periods (exited staff)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-exited",
      name: "Exited Staff",
      role: "EMPLOYEE",
      disabledAt: null,
      staff: {
        id: "s-1",
        name: "Exited Staff",
        employeeCode: "SAR-2024-001",
        employmentPeriods: [
          {
            id: "ep-1",
            staffId: "s-1",
            startDate: "2024-01-01",
            endDate: "2024-06-30", // expired
          },
        ],
      },
      approverDepartments: [],
      mustChangePassword: false,
    })
    const session = { user: { id: "u-exited" } } as Session

    const res = await requireRole(session, ["EMPLOYEE"])
    expect(res.errorResponse?.status).toBe(401)
    const body = await res.errorResponse?.json()
    expect(body).toEqual({ error: "Employment period ended" })
  })

  it("allows legacy staff with no recorded employment periods", async () => {
    const mockUser = {
      id: "u-legacy",
      name: "Legacy Staff",
      role: "EMPLOYEE",
      disabledAt: null,
      staff: {
        id: "s-legacy",
        name: "Legacy Staff",
        employeeCode: "SAR-2024-002",
        employmentPeriods: [],
      },
      approverDepartments: [],
      mustChangePassword: false,
    }
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    const session = { user: { id: "u-legacy" } } as Session

    const res = await requireRole(session, ["EMPLOYEE"])
    expect(res.errorResponse).toBeUndefined()
    expect(res.user?.id).toBe("u-legacy")
  })

  it("does not block ADMIN even if linked staff has ended employment period", async () => {
    const mockAdmin = {
      id: "u-admin-staff",
      name: "Admin Staff",
      role: "ADMIN",
      disabledAt: null,
      staff: {
        id: "s-admin",
        name: "Admin Staff",
        employmentPeriods: [
          {
            id: "ep-past",
            staffId: "s-admin",
            startDate: "2020-01-01",
            endDate: "2021-01-01",
          },
        ],
      },
      approverDepartments: [],
      mustChangePassword: false,
    }
    mockPrisma.user.findUnique.mockResolvedValue(mockAdmin)
    const session = { user: { id: "u-admin-staff" } } as Session

    const res = await requireRole(session, ["ADMIN"])
    expect(res.errorResponse).toBeUndefined()
    expect(res.user?.id).toBe("u-admin-staff")
  })

  describe("Role Hierarchy", () => {
    it("allows ADMIN to access ADMIN, APPROVER, and EMPLOYEE routes", async () => {
      const mockAdmin = {
        id: "u-admin",
        role: "ADMIN",
        disabledAt: null,
        staff: null,
        approverDepartments: [],
        mustChangePassword: false,
      }
      mockPrisma.user.findUnique.mockResolvedValue(mockAdmin)
      const session = { user: { id: "u-admin" } } as Session

      const resAdmin = await requireRole(session, ["ADMIN"])
      expect(resAdmin.errorResponse).toBeUndefined()

      const resApprover = await requireRole(session, ["APPROVER"])
      expect(resApprover.errorResponse).toBeUndefined()

      const resEmployee = await requireRole(session, ["EMPLOYEE"])
      expect(resEmployee.errorResponse).toBeUndefined()
    })

    it("allows APPROVER to access APPROVER and EMPLOYEE routes, but blocks from ADMIN routes", async () => {
      const mockApprover = {
        id: "u-approver",
        role: "APPROVER",
        disabledAt: null,
        staff: null,
        approverDepartments: [{ departmentId: "d1" }],
        mustChangePassword: false,
      }
      mockPrisma.user.findUnique.mockResolvedValue(mockApprover)
      const session = { user: { id: "u-approver" } } as Session

      const resApprover = await requireRole(session, ["APPROVER"])
      expect(resApprover.errorResponse).toBeUndefined()

      const resEmployee = await requireRole(session, ["EMPLOYEE"])
      expect(resEmployee.errorResponse).toBeUndefined()

      const resAdmin = await requireRole(session, ["ADMIN"])
      expect(resAdmin.errorResponse?.status).toBe(403)
      const body = await resAdmin.errorResponse?.json()
      expect(body).toEqual({ error: "Forbidden" })
    })

    it("allows EMPLOYEE to access EMPLOYEE routes, but blocks from APPROVER and ADMIN routes", async () => {
      const mockEmployee = {
        id: "u-emp",
        role: "EMPLOYEE",
        disabledAt: null,
        staff: null,
        approverDepartments: [],
        mustChangePassword: false,
      }
      mockPrisma.user.findUnique.mockResolvedValue(mockEmployee)
      const session = { user: { id: "u-emp" } } as Session

      const resEmployee = await requireRole(session, ["EMPLOYEE"])
      expect(resEmployee.errorResponse).toBeUndefined()

      const resApprover = await requireRole(session, ["APPROVER"])
      expect(resApprover.errorResponse?.status).toBe(403)
      expect(await resApprover.errorResponse?.json()).toEqual({ error: "Forbidden" })

      const resAdmin = await requireRole(session, ["ADMIN"])
      expect(resAdmin.errorResponse?.status).toBe(403)
      expect(await resAdmin.errorResponse?.json()).toEqual({ error: "Forbidden" })
    })
  })

  describe("mustChangePassword enforcement", () => {
    it("returns 403 when user must change password and route does not allow it", async () => {
      const mockUser = {
        id: "u-temp-pass",
        role: "EMPLOYEE",
        disabledAt: null,
        staff: null,
        approverDepartments: [],
        mustChangePassword: true,
      }
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      const session = { user: { id: "u-temp-pass" } } as Session

      const res = await requireRole(session, ["EMPLOYEE"])
      expect(res.errorResponse?.status).toBe(403)
      const body = await res.errorResponse?.json()
      expect(body).toEqual({ error: "Password change required", mustChangePassword: true })
    })

    it("allows user when mustChangePassword is true if allowMustChangePassword option is passed", async () => {
      const mockUser = {
        id: "u-temp-pass",
        role: "EMPLOYEE",
        disabledAt: null,
        staff: null,
        approverDepartments: [],
        mustChangePassword: true,
      }
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)
      const session = { user: { id: "u-temp-pass" } } as Session

      const res = await requireRole(session, ["EMPLOYEE"], { allowMustChangePassword: true })
      expect(res.errorResponse).toBeUndefined()
      expect(res.user?.id).toBe("u-temp-pass")
    })
  })
})
