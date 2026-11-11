import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"

type MockUser = {
  id: string
  name: string
  email: string
  role: "ADMIN" | "APPROVER" | "EMPLOYEE"
  password?: string | null
  disabledAt: Date | null
  mustChangePassword: boolean
  staffId?: string | null
  staff: unknown | null
  approverDepartments: { departmentId: string }[]
}

const usersDb: MockUser[] = []

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  monthlyPayroll: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  dailyRecord: {
    findMany: vi.fn(),
  },
  shift: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  staff: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  punchPhoto: {
    findUnique: vi.fn(),
  },
  attendanceLog: {
    findMany: vi.fn(),
  },
}))

let currentSession: { user: { id: string; name?: string; role?: string } } | null = null

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(async () => currentSession),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/shift-change-service", () => ({
  syncCurrentShifts: vi.fn(async () => {}),
  applyShiftChange: vi.fn(async () => ({ recalculated: true })),
  isValidDayKey: vi.fn(() => true),
  START_BEFORE_ALWAYS_ERROR: "Start date must be on or after 2000-01-01",
}))

vi.mock("@/lib/attendance", () => ({
  recalculateAttendance: vi.fn(async () => {}),
}))

import { GET as getUsers, POST as postUsers, PUT as putUsers, DELETE as deleteUsers } from "@/app/api/users/route"
import { GET as getMonthlyPayroll } from "@/app/api/payroll/monthly/route"
import { GET as getPayrollById } from "@/app/api/payroll/[id]/route"
import { GET as getShifts } from "@/app/api/shifts/route"
import { GET as getPhotoById } from "@/app/api/photos/[id]/route"
import { GET as getStaff, POST as postStaff } from "@/app/api/staff/route"
import { GET as getReports } from "@/app/api/reports/route"
import { GET as getPunches, POST as postPunches } from "@/app/api/punches/route"

describe("RBAC Route Gating and User Management", () => {
  const adminUser: MockUser = {
    id: "u-admin",
    name: "Admin User",
    email: "admin@sehss.edu",
    role: "ADMIN",
    disabledAt: null,
    mustChangePassword: false,
    staff: null,
    approverDepartments: [],
  }

  const approverUser: MockUser = {
    id: "u-approver",
    name: "Approver User",
    email: "approver@sehss.edu",
    role: "APPROVER",
    disabledAt: null,
    mustChangePassword: false,
    staff: null,
    approverDepartments: [],
  }

  const employeeUser: MockUser = {
    id: "u-employee",
    name: "Employee User",
    email: "emp@sehss.edu",
    role: "EMPLOYEE",
    disabledAt: null,
    mustChangePassword: false,
    staff: null,
    approverDepartments: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    usersDb.length = 0
    usersDb.push({ ...adminUser }, { ...approverUser }, { ...employeeUser })

    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
      const u = usersDb.find((x) => (where.id ? x.id === where.id : x.email === where.email))
      return u ? { ...u } : null
    })

    mockPrisma.user.findMany.mockImplementation(async () => {
      return usersDb.map(({ id, name, email, role, disabledAt, mustChangePassword }) => ({
        id,
        name,
        email,
        role,
        disabledAt,
        mustChangePassword,
      }))
    })

    mockPrisma.user.count.mockImplementation(async ({ where }: { where?: { role?: string; disabledAt?: null } } = {}) => {
      return usersDb.filter((u) => {
        if (where?.role && u.role !== where.role) return false
        if (where?.disabledAt === null && u.disabledAt !== null) return false
        return true
      }).length
    })

    mockPrisma.user.create.mockImplementation(async ({ data }: { data: any }) => {
      const newUser = { id: `u-${Date.now()}`, disabledAt: null, mustChangePassword: false, staff: null, approverDepartments: [], ...data }
      usersDb.push(newUser)
      return newUser
    })

    mockPrisma.user.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: any }) => {
      const idx = usersDb.findIndex((u) => u.id === where.id)
      if (idx === -1) throw new Error("User not found")
      usersDb[idx] = { ...usersDb[idx], ...data }
      return usersDb[idx]
    })

    mockPrisma.user.delete.mockImplementation(async ({ where }: { where: { id: string } }) => {
      const idx = usersDb.findIndex((u) => u.id === where.id)
      if (idx === -1) throw new Error("User not found")
      return usersDb.splice(idx, 1)[0]
    })

    mockPrisma.monthlyPayroll.findMany.mockResolvedValue([])
    mockPrisma.monthlyPayroll.findUnique.mockResolvedValue({
      id: "pr-1",
      staffId: "s-1",
      month: 11,
      year: 2026,
      staff: {
        department: null,
        designation: null,
        payrollInfo: null,
        createdAt: new Date("2026-01-01"),
      },
    })
    mockPrisma.dailyRecord.findMany.mockResolvedValue([])
    mockPrisma.shift.findMany.mockResolvedValue([{ id: "s-1", name: "General Shift", startTime: "09:55", endTime: "17:00" }])
    mockPrisma.staff.findMany.mockResolvedValue([])
    mockPrisma.punchPhoto.findUnique.mockResolvedValue({
      id: "ph-1",
      staffId: "s-1",
      data: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    })
    mockPrisma.attendanceLog.findMany.mockResolvedValue([])
  })

  describe("1. Gating verification across routes", () => {
    it("EMPLOYEE calling /api/users returns 403", async () => {
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const res = await getUsers()
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("Forbidden")
    })

    it("APPROVER calling /api/users returns 403", async () => {
      currentSession = { user: { id: approverUser.id, role: "APPROVER" } }
      const res = await getUsers()
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("Forbidden")
    })

    it("ADMIN calling /api/users is permitted (200)", async () => {
      currentSession = { user: { id: adminUser.id, role: "ADMIN" } }
      const res = await getUsers()
      expect(res.status).toBe(200)
    })

    it("EMPLOYEE calling /api/payroll/monthly returns 403", async () => {
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/payroll/monthly?month=11&year=2026")
      const res = await getMonthlyPayroll(req)
      expect(res.status).toBe(403)
    })

    it("EMPLOYEE calling /api/shifts returns 403", async () => {
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const res = await getShifts()
      expect(res.status).toBe(403)
    })

    it("Unauthenticated calling /api/payroll/[id] returns 401", async () => {
      currentSession = null
      const req = new Request("http://localhost/api/payroll/pr-1")
      const res = await getPayrollById(req, { params: Promise.resolve({ id: "pr-1" }) })
      expect(res.status).toBe(401)
    })

    it("EMPLOYEE calling /api/payroll/[id] returns 403", async () => {
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/payroll/pr-1")
      const res = await getPayrollById(req, { params: Promise.resolve({ id: "pr-1" }) })
      expect(res.status).toBe(403)
    })

    it("Unauthenticated calling /api/photos/[id] returns 401", async () => {
      currentSession = null
      const req = new Request("http://localhost/api/photos/ph-1")
      const res = await getPhotoById(req, { params: Promise.resolve({ id: "ph-1" }) })
      expect(res.status).toBe(401)
    })

    it("EMPLOYEE calling /api/photos/[id] for their own photo is permitted (200)", async () => {
      usersDb.find((u) => u.id === employeeUser.id)!.staffId = "s-1"
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/photos/ph-1")
      const res = await getPhotoById(req, { params: Promise.resolve({ id: "ph-1" }) })
      expect(res.status).toBe(200)
    })

    it("EMPLOYEE calling /api/photos/[id] for someone else's photo returns 403", async () => {
      usersDb.find((u) => u.id === employeeUser.id)!.staffId = "s-other"
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/photos/ph-1")
      const res = await getPhotoById(req, { params: Promise.resolve({ id: "ph-1" }) })
      expect(res.status).toBe(403)
    })

    it("EMPLOYEE with no linked staff record cannot read any photo (403)", async () => {
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/photos/ph-1")
      const res = await getPhotoById(req, { params: Promise.resolve({ id: "ph-1" }) })
      expect(res.status).toBe(403)
    })

    it("EMPLOYEE calling /api/staff (GET) returns 403", async () => {
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const res = await getStaff()
      expect(res.status).toBe(403)
    })

    it("APPROVER calling /api/staff (GET) is permitted (200)", async () => {
      currentSession = { user: { id: approverUser.id, role: "APPROVER" } }
      const res = await getStaff()
      expect(res.status).toBe(200)
    })

    it("APPROVER calling /api/staff (POST) returns 403", async () => {
      currentSession = { user: { id: approverUser.id, role: "APPROVER" } }
      const req = new Request("http://localhost/api/staff", {
        method: "POST",
        body: JSON.stringify({ name: "New Staff", machineId: "99" }),
      })
      const res = await postStaff(req)
      expect(res.status).toBe(403)
    })

    it("EMPLOYEE calling /api/reports returns 403", async () => {
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/reports?type=daily&date=2026-11-08")
      const res = await getReports(req)
      expect(res.status).toBe(403)
    })

    it("APPROVER calling /api/reports is permitted (200)", async () => {
      currentSession = { user: { id: approverUser.id, role: "APPROVER" } }
      const req = new Request("http://localhost/api/reports?type=daily&date=2026-11-08")
      const res = await getReports(req)
      expect(res.status).toBe(200)
    })

    it("EMPLOYEE calling /api/punches (GET) for their own record is permitted (200)", async () => {
      usersDb.find((u) => u.id === employeeUser.id)!.staffId = "s-1"
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/punches?staffId=s-1&date=2026-11-08")
      const res = await getPunches(req)
      expect(res.status).toBe(200)
    })

    it("EMPLOYEE calling /api/punches (GET) for another staff member returns 403", async () => {
      usersDb.find((u) => u.id === employeeUser.id)!.staffId = "s-other"
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/punches?staffId=s-1&date=2026-11-08")
      const res = await getPunches(req)
      expect(res.status).toBe(403)
    })

    it("EMPLOYEE with no linked staff record cannot read anyone's punches (403)", async () => {
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/punches?staffId=s-1&date=2026-11-08")
      const res = await getPunches(req)
      expect(res.status).toBe(403)
    })

    it("department-scoped APPROVER cannot read punches outside their departments (403)", async () => {
      const approver = usersDb.find((u) => u.id === approverUser.id)!
      approver.approverDepartments = [{ departmentId: "d-science" }]
      mockPrisma.staff.findUnique.mockResolvedValue({ departmentId: "d-arts" })
      currentSession = { user: { id: approverUser.id, role: "APPROVER" } }
      const req = new Request("http://localhost/api/punches?staffId=s-1&date=2026-11-08")
      const res = await getPunches(req)
      expect(res.status).toBe(403)
    })

    it("EMPLOYEE calling /api/punches (POST) returns 403", async () => {
      currentSession = { user: { id: employeeUser.id, role: "EMPLOYEE" } }
      const req = new Request("http://localhost/api/punches", {
        method: "POST",
        body: JSON.stringify({ staffId: "s-1", timestamp: new Date().toISOString(), type: "IN" }),
      })
      const res = await postPunches(req)
      expect(res.status).toBe(403)
    })
  })

  describe("2. /api/users security & bcrypt requirements", () => {
    it("hashes new passwords with bcrypt, never exposes hash in response or list", async () => {
      currentSession = { user: { id: adminUser.id, role: "ADMIN" } }
      const req = new Request("http://localhost/api/users", {
        method: "POST",
        body: JSON.stringify({ name: "Teacher One", email: "teacher1@sehss.edu", password: "Password123" }),
      })
      const res = await postUsers(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.password).toBeUndefined()
      expect(data.email).toBe("teacher1@sehss.edu")

      // Verify created record in DB has bcrypt hash
      const created = usersDb.find((u) => u.email === "teacher1@sehss.edu")
      expect(created).toBeDefined()
      expect(created?.password).toMatch(/^\$2[aby]\$\d+\$/)
      expect(await bcrypt.compare("Password123", created!.password!)).toBe(true)

      // Verify list endpoint never exposes password
      const listRes = await getUsers()
      const list = await listRes.json()
      for (const u of list) {
        expect(u.password).toBeUndefined()
      }
    })

    it("hashes updated passwords with bcrypt on PUT", async () => {
      currentSession = { user: { id: adminUser.id, role: "ADMIN" } }
      const req = new Request("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: employeeUser.id, password: "NewStrongPassword456" }),
      })
      const res = await putUsers(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.password).toBeUndefined()

      const updated = usersDb.find((u) => u.id === employeeUser.id)
      expect(updated?.password).toMatch(/^\$2[aby]\$\d+\$/)
      expect(await bcrypt.compare("NewStrongPassword456", updated!.password!)).toBe(true)
    })

    it("prevents deleting the last remaining active Admin user", async () => {
      const secondAdmin: MockUser = {
        id: "u-admin-2",
        name: "Admin 2",
        email: "admin2@sehss.edu",
        role: "ADMIN",
        disabledAt: null,
        mustChangePassword: false,
        staff: null,
        approverDepartments: [],
      }
      usersDb.push(secondAdmin)
      currentSession = { user: { id: secondAdmin.id, role: "ADMIN" } }

      // Simulate that adminUser is the only active admin left in system
      mockPrisma.user.count.mockResolvedValueOnce(1)

      const req = new Request(`http://localhost/api/users?id=${adminUser.id}`, {
        method: "DELETE",
      })
      const res = await deleteUsers(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/last remaining active Admin/i)
      // Verify user was NOT deleted
      expect(usersDb.some((u) => u.id === adminUser.id)).toBe(true)
    })

    it("prevents demoting or disabling the last remaining active Admin user", async () => {
      currentSession = { user: { id: adminUser.id, role: "ADMIN" } }
      const reqDemote = new Request("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: adminUser.id, role: "EMPLOYEE" }),
      })
      const resDemote = await putUsers(reqDemote)
      expect(resDemote.status).toBe(400)
      const bodyDemote = await resDemote.json()
      expect(bodyDemote.error).toMatch(/last remaining active Admin/i)

      const reqDisable = new Request("http://localhost/api/users", {
        method: "PUT",
        body: JSON.stringify({ id: adminUser.id, disabledAt: new Date().toISOString() }),
      })
      const resDisable = await putUsers(reqDisable)
      expect(resDisable.status).toBe(400)
      const bodyDisable = await resDisable.json()
      expect(bodyDisable.error).toMatch(/last remaining active Admin/i)
    })
  })
})
