import { beforeEach, describe, expect, it, vi } from "vitest"

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  monthlyPayroll: {
    findUnique: vi.fn(),
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

const mockGetServerSession = vi.mocked(getServerSession)

describe("GET /api/payroll/[id]/pdf", () => {
  const mockStaff1 = {
    id: "staff-1",
    machineId: "101",
    name: "Aman Sharma",
    employeeCode: "SEHSS-042",
    joiningDate: "2024-06-15",
    departmentId: "dept-1",
    designationId: "desig-1",
    department: { id: "dept-1", name: "Mathematics" },
    designation: { id: "desig-1", name: "Senior Teacher" },
    payrollInfo: {
      id: "pinfo-1",
      staffId: "staff-1",
      payGroup: "BANK_EPF",
      bankAccount: "123456789012",
      ifsc: "SBIN0001234",
      uan: "101234567890",
      pan: "ABCDE1234F",
      monthlyCtc: 25000,
    },
  }

  const mockStaff2 = {
    id: "staff-2",
    machineId: "102",
    name: "Pooja Verma",
    employeeCode: "SEHSS-043",
    joiningDate: "2024-07-01",
    departmentId: "dept-2",
    designationId: "desig-2",
    department: { id: "dept-2", name: "Science" },
    designation: { id: "desig-2", name: "Primary Teacher" },
    payrollInfo: {
      id: "pinfo-2",
      staffId: "staff-2",
      payGroup: "CASH",
      bankAccount: null,
      ifsc: null,
      uan: null,
      pan: null,
      monthlyCtc: 15000,
    },
  }

  const mockPayroll1 = {
    id: "payroll-1",
    staffId: "staff-1",
    payGroup: "BANK_EPF",
    month: 3,
    year: 2026,
    totalDays: 31,
    presentDays: 26,
    ncpDays: 5,
    actualCtc: 25000,
    grossWage: 21000,
    basicWage: 18000,
    bonusAmount: 3000,
    bonusDays: 2,
    bonusType: "CUSTOM",
    isBonusPfApplicable: false,
    epfWages: 18000,
    epsWages: 15000,
    edliWages: 15000,
    employeeEpf: 1800,
    employerEps: 1250,
    employerEpf: 550,
    refundOfAdvance: 500,
    netPayment: 18700,
    isLocked: true,
    staff: mockStaff1,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when user is not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null)

    const req = new Request("http://localhost:3000/api/payroll/payroll-1/pdf")
    const res = await GET(req, { params: Promise.resolve({ id: "payroll-1" }) })

    expect(res.status).toBe(401)
  })

  it("returns 404 when payroll record does not exist", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-admin", role: "ADMIN" },
    } as any)

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-admin",
      role: "ADMIN",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    } as any)

    mockPrisma.monthlyPayroll.findUnique.mockResolvedValue(null)

    const req = new Request("http://localhost:3000/api/payroll/payroll-missing/pdf")
    const res = await GET(req, { params: Promise.resolve({ id: "payroll-missing" }) })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/not found/i)
  })

  it("allows employee to download their own payslip PDF", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-emp-1", role: "EMPLOYEE", staffId: "staff-1" },
    } as any)

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-emp-1",
      role: "EMPLOYEE",
      staffId: "staff-1",
      disabledAt: null,
      mustChangePassword: false,
      staff: { id: "staff-1", employmentPeriods: [] },
      approverDepartments: [],
    } as any)

    mockPrisma.monthlyPayroll.findUnique.mockResolvedValue(mockPayroll1 as any)

    const req = new Request("http://localhost:3000/api/payroll/payroll-1/pdf")
    const res = await GET(req, { params: Promise.resolve({ id: "payroll-1" }) })

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    expect(res.headers.get("Content-Disposition")).toContain('attachment; filename="Payslip_Aman_Sharma_3_2026.pdf"')

    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    expect(buffer.toString("utf-8", 0, 5)).toBe("%PDF-")
  })

  it("returns 403 when employee attempts to download another staff member's payslip", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-emp-2", role: "EMPLOYEE", staffId: "staff-2" },
    } as any)

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-emp-2",
      role: "EMPLOYEE",
      staffId: "staff-2",
      disabledAt: null,
      mustChangePassword: false,
      staff: { id: "staff-2", employmentPeriods: [] },
      approverDepartments: [],
    } as any)

    mockPrisma.monthlyPayroll.findUnique.mockResolvedValue(mockPayroll1 as any)

    const req = new Request("http://localhost:3000/api/payroll/payroll-1/pdf")
    const res = await GET(req, { params: Promise.resolve({ id: "payroll-1" }) })

    expect(res.status).toBe(403)
  })

  it("allows admin to download any staff member's payslip", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "user-admin", role: "ADMIN" },
    } as any)

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-admin",
      role: "ADMIN",
      staffId: null,
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    } as any)

    mockPrisma.monthlyPayroll.findUnique.mockResolvedValue(mockPayroll1 as any)

    const req = new Request("http://localhost:3000/api/payroll/payroll-1/pdf")
    const res = await GET(req, { params: Promise.resolve({ id: "payroll-1" }) })

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("application/pdf")
    expect(res.headers.get("Content-Disposition")).toContain('attachment; filename="Payslip_Aman_Sharma_3_2026.pdf"')
  })
})
