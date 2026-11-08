import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { ensureSchoolTimezone } from "@/lib/timezone"
import { createFakePrisma } from "@/test-utils/fake-prisma"
import { PDFDocument } from "pdf-lib"
import { istDateKey } from "@/lib/dashboard-calc"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

import { getServerSession } from "next-auth/next"
import { recalculateAttendance } from "@/lib/attendance"
import { GET as getPunchRequests, POST as createPunchRequestRoute } from "@/app/api/punch-requests/route"
import { PATCH as updatePunchRequestRoute } from "@/app/api/punch-requests/[id]/route"
import { GET as getToSchoolRoute } from "@/app/api/employee/to-school/route"
import { GET as getPayrollPdfRoute } from "@/app/api/payroll/[id]/pdf/route"

const sessionMock = vi.mocked(getServerSession)

beforeAll(() => {
  ensureSchoolTimezone()
})

const DEPARTMENT_SCIENCE = { id: "dept-science", name: "Science Department" }
const DESIGNATION_LECTURER = { id: "desig-lecturer", name: "Senior Lecturer" }
const SHIFT_STANDARD = {
  id: "shift-std",
  name: "Standard 9 to 5",
  startTime: "09:00",
  endTime: "17:00",
}

const STAFF_RAHUL = {
  id: "staff-rahul",
  name: "Rahul Verma",
  employeeCode: "EMP-101",
  machineId: "201",
  departmentId: "dept-science",
  department: DEPARTMENT_SCIENCE,
  designationId: "desig-lecturer",
  designation: DESIGNATION_LECTURER,
  shiftId: "shift-std",
  shift: SHIFT_STANDARD,
  employmentPeriods: [{ startDate: "2024-01-01", endDate: null }],
  payrollInfo: {
    id: "pinfo-rahul",
    staffId: "staff-rahul",
    payGroup: "BANK_EPF",
    monthlyCtc: 35000,
    bankAccount: "123456789012",
    ifsc: "SBIN0001234",
    pan: "ABCDE1234F",
    uan: "101234567890",
  },
}

const POLICY = {
  lateArrivalAllow: "00:15",
  halfDayIfWorkHrsLessThan: "06:00",
  absentIfWorkHrsLessThan: "00:00",
  allInOut: "First IN Last OUT",
  weekOffDays: "0", // Sunday
}

const USERS = [
  {
    id: "user-employee",
    name: "Rahul Verma",
    email: "rahul@school.test",
    role: "EMPLOYEE",
    staffId: "staff-rahul",
    staff: STAFF_RAHUL,
    approverDepartments: [],
  },
  {
    id: "user-approver",
    name: "Dr. Arvind Gupta",
    email: "arvind@school.test",
    role: "APPROVER",
    staffId: null,
    staff: null,
    approvesAllDepartments: false,
    approverDepartments: [{ departmentId: "dept-science" }],
  },
  {
    id: "user-admin",
    name: "System Admin",
    email: "admin@school.test",
    role: "ADMIN",
    staffId: null,
    staff: null,
    approverDepartments: [],
  },
]

const PAYROLL_OCTOBER = {
  id: "payroll-oct-2026",
  staffId: "staff-rahul",
  month: 10,
  year: 2026,
  payGroup: "BANK_EPF",
  totalDays: 31,
  presentDays: 26,
  ncpDays: 5,
  actualCtc: 35000,
  grossWage: 32000,
  basicWage: 26000,
  bonusAmount: 2000,
  bonusDays: 0,
  bonusType: "CUSTOM",
  isBonusPfApplicable: false,
  epfWages: 26000,
  epsWages: 15000,
  edliWages: 15000,
  employeeEpf: 2600,
  employerEps: 1250,
  employerEpf: 1350,
  refundOfAdvance: 0,
  netPayment: 29400,
  isLocked: true,
  createdAt: new Date("2026-10-31T00:00:00+05:30"),
  updatedAt: new Date("2026-10-31T00:00:00+05:30"),
  staff: STAFF_RAHUL,
}

describe("Punch Regularization End-to-End Integration Suite", () => {
  let fake: ReturnType<typeof createFakePrisma>

  beforeEach(() => {
    vi.clearAllMocks()

    fake = createFakePrisma({
      staff: [STAFF_RAHUL],
      policy: POLICY,
      holidays: [],
      lockedPayrolls: [PAYROLL_OCTOBER],
      // Step 1: Initial single IN punch on 2026-11-02 at 09:00 AM IST
      logs: [
        {
          id: "log-initial-in",
          staffId: "staff-rahul",
          timestamp: new Date("2026-11-02T09:00:00+05:30"),
          type: "IN",
        },
      ],
      users: USERS,
      dailyRecords: [],
    })

    holder.client = fake.client
  })

  it("completes full flow: single swipe -> missing checkout -> request -> approval -> recalculation -> ToSchool update -> payslip PDF generation", async () => {
    const targetDate = new Date("2026-11-02T00:00:00+05:30")

    // -------------------------------------------------------------------------
    // Step 2: Initial daily record computation has missing checkout (status HALF_DAY)
    // -------------------------------------------------------------------------
    const initialRecalc = await recalculateAttendance(targetDate, targetDate)
    expect(initialRecalc).toBe(1)

    const initialDailyRecords = await (fake.client as any).dailyRecord.findMany({
      where: { staffId: "staff-rahul" },
    })
    expect(initialDailyRecords).toHaveLength(1)
    const initialDay = initialDailyRecords[0]
    expect(istDateKey(initialDay.date)).toBe("2026-11-02")
    expect(initialDay.status).toBe("HALF_DAY")
    expect(initialDay.workMinutes).toBe(0)
    expect(initialDay.checkIn?.toISOString()).toBe(new Date("2026-11-02T09:00:00+05:30").toISOString())
    expect(initialDay.checkOut?.toISOString()).toBe(new Date("2026-11-02T09:00:00+05:30").toISOString())

    // Verify initial ToSchool view shows missing checkout / half day before regularization
    sessionMock.mockResolvedValue({ user: { id: "user-employee" } } as never)
    const initialToSchoolRes = await getToSchoolRoute(
      new Request("http://localhost/api/employee/to-school?month=11&year=2026")
    )
    expect(initialToSchoolRes.status).toBe(200)
    const initialToSchoolJson = await initialToSchoolRes.json()
    expect(initialToSchoolJson.success).toBe(true)
    const initialNov2 = initialToSchoolJson.data.days.find((d: any) => d.dateKey === "2026-11-02")
    expect(initialNov2).toBeDefined()
    expect(initialNov2.status).toBe("HALF_DAY")
    expect(initialNov2.hoursBracket).toBe("—")
    expect(initialNov2.isNoShow).toBe(true)
    expect(initialNov2.checkIn).toBe("09:00")
    expect(initialNov2.checkOut).toBe("09:00")

    // -------------------------------------------------------------------------
    // Step 3: Employee submits punch request for missing OUT punch at 16:30 via POST /api/punch-requests
    // -------------------------------------------------------------------------
    const submitReq = new Request("http://localhost/api/punch-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: "2026-11-02",
        punchType: "OUT",
        requestedTime: "16:30",
        reason: "FORGOT_SWIPE",
        explanation: "Forgot to swipe biometric scanner when leaving school gate at 4:30 PM",
      }),
    })

    const submitRes = await createPunchRequestRoute(submitReq)
    expect(submitRes.status).toBe(201)
    const createdRequest = await submitRes.json()
    expect(createdRequest).toMatchObject({
      staffId: "staff-rahul",
      date: "2026-11-02",
      punchType: "OUT",
      requestedTime: "16:30",
      reason: "FORGOT_SWIPE",
      explanation: "Forgot to swipe biometric scanner when leaving school gate at 4:30 PM",
      status: "PENDING",
    })
    expect(createdRequest.id).toBeDefined()
    const requestId = createdRequest.id

    // -------------------------------------------------------------------------
    // Step 4: Approver reviews pending request, verifies swipe, and approves via PATCH /api/punch-requests/[id]
    // -------------------------------------------------------------------------
    sessionMock.mockResolvedValue({ user: { id: "user-approver" } } as never)

    // Approver queries pending requests inbox
    const inboxRes = await getPunchRequests(
      new Request("http://localhost/api/punch-requests?status=PENDING")
    )
    expect(inboxRes.status).toBe(200)
    const inboxData = await inboxRes.json()
    const pendingTarget = inboxData.find((r: any) => r.id === requestId)
    expect(pendingTarget).toBeDefined()
    expect(pendingTarget.staff.id).toBe("staff-rahul")
    expect(pendingTarget.staff.name).toBe("Rahul Verma")
    expect(pendingTarget.staff.department.name).toBe("Science Department")

    // Approver inspects existing punches on 2026-11-02 to verify 09:00 AM IN swipe
    const existingLogs = await (fake.client as any).attendanceLog.findMany({
      where: { staffId: "staff-rahul" },
    })
    expect(existingLogs).toHaveLength(1)
    expect(existingLogs[0].type).toBe("IN")
    expect(existingLogs[0].timestamp.toISOString()).toBe(new Date("2026-11-02T09:00:00+05:30").toISOString())

    // Approver approves the punch request with remarks
    const patchReq = new Request(`http://localhost/api/punch-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "APPROVE",
        decisionRemarks: "Verified gate register and initial 09:00 AM punch; departure at 16:30 confirmed",
      }),
    })

    const patchRes = await updatePunchRequestRoute(patchReq, {
      params: Promise.resolve({ id: requestId }),
    })
    expect(patchRes.status).toBe(200)
    const patchBody = await patchRes.json()
    expect(patchBody.status).toBe("APPROVED")
    expect(patchBody.decidedByUserId).toBe("user-approver")
    expect(patchBody.decisionRemarks).toBe(
      "Verified gate register and initial 09:00 AM punch; departure at 16:30 confirmed"
    )

    // -------------------------------------------------------------------------
    // Step 5: Comprehensive Verifications
    // -------------------------------------------------------------------------

    // 5.1 PunchRequest status is APPROVED in database
    const savedPunchRequest = fake.punchRequests.find((r) => r.id === requestId)
    expect(savedPunchRequest).toBeDefined()
    expect(savedPunchRequest?.status).toBe("APPROVED")
    expect(savedPunchRequest?.decidedByUserId).toBe("user-approver")
    expect(savedPunchRequest?.decidedAt).toBeInstanceOf(Date)
    expect(savedPunchRequest?.decisionRemarks).toBe(
      "Verified gate register and initial 09:00 AM punch; departure at 16:30 confirmed"
    )

    // 5.2 AttendanceLog with type OUT is created at 2026-11-02T16:30:00+05:30
    const allLogs = await (fake.client as any).attendanceLog.findMany({
      where: { staffId: "staff-rahul" },
    })
    expect(allLogs).toHaveLength(2)
    const outPunchLog = allLogs.find((l: any) => l.type === "OUT")
    expect(outPunchLog).toBeDefined()
    expect(outPunchLog.timestamp.toISOString()).toBe(new Date("2026-11-02T16:30:00+05:30").toISOString())

    // 5.3 AuditLog is created with action PUNCH_REQUEST_APPROVED
    const approvalAudit = fake.auditLogs.find(
      (a) => a.action === "PUNCH_REQUEST_APPROVED"
    )
    expect(approvalAudit).toBeDefined()
    expect(approvalAudit?.actorUserId).toBe("user-approver")
    expect(approvalAudit?.targetType).toBe("PunchRequest")
    expect(approvalAudit?.targetId).toBe(requestId)
    const auditDetails = JSON.parse(approvalAudit?.details as string)
    expect(auditDetails).toMatchObject({
      staffId: "staff-rahul",
      date: "2026-11-02",
      punchType: "OUT",
      decisionRemarks: "Verified gate register and initial 09:00 AM punch; departure at 16:30 confirmed",
    })

    // 5.4 DailyRecord for 2026-11-02 is recalculated to PRESENT with ~450 workMinutes
    const updatedDailyRecords = await (fake.client as any).dailyRecord.findMany({
      where: { staffId: "staff-rahul" },
    })
    const nov2Record = updatedDailyRecords.find((r: any) => istDateKey(r.date) === "2026-11-02")
    expect(nov2Record).toBeDefined()
    expect(nov2Record.status).toBe("PRESENT")
    expect(nov2Record.workMinutes).toBe(450) // 09:00 to 16:30 = 7.5 hrs = 450 minutes
    expect(nov2Record.lateMinutes).toBe(0)
    expect(nov2Record.checkIn?.toISOString()).toBe(new Date("2026-11-02T09:00:00+05:30").toISOString())
    expect(nov2Record.checkOut?.toISOString()).toBe(new Date("2026-11-02T16:30:00+05:30").toISOString())

    // 5.5 GET /api/employee/to-school reflects PRESENT, hours bracket 7-9 Hrs, and isNoShow: false
    sessionMock.mockResolvedValue({ user: { id: "user-employee" } } as never)
    const toSchoolRes = await getToSchoolRoute(
      new Request("http://localhost/api/employee/to-school?month=11&year=2026")
    )
    expect(toSchoolRes.status).toBe(200)
    const toSchoolJson = await toSchoolRes.json()
    expect(toSchoolJson.success).toBe(true)
    const nov2ToSchool = toSchoolJson.data.days.find((d: any) => d.dateKey === "2026-11-02")
    expect(nov2ToSchool).toBeDefined()
    expect(nov2ToSchool.status).toBe("PRESENT")
    expect(nov2ToSchool.hoursBracket).toBe("7-9 Hrs")
    expect(nov2ToSchool.isNoShow).toBe(false)
    expect(nov2ToSchool.workMinutes).toBe(450)
    expect(nov2ToSchool.checkIn).toBe("09:00")
    expect(nov2ToSchool.checkOut).toBe("16:30")
    expect(nov2ToSchool.lateMinutes).toBe(0)

    // 5.6 GET /api/payroll/[id]/pdf streams valid A4 PDF with HTTP 200 and Content-Disposition attachment
    const pdfRes = await getPayrollPdfRoute(
      new Request("http://localhost/api/payroll/payroll-oct-2026/pdf"),
      { params: Promise.resolve({ id: "payroll-oct-2026" }) }
    )
    expect(pdfRes.status).toBe(200)
    expect(pdfRes.headers.get("Content-Type")).toBe("application/pdf")
    const contentDisposition = pdfRes.headers.get("Content-Disposition")
    expect(contentDisposition).toBe('attachment; filename="Payslip_Rahul_Verma_10_2026.pdf"')

    const pdfBuffer = await pdfRes.arrayBuffer()
    expect(pdfBuffer.byteLength).toBeGreaterThan(1000)

    // Verify %PDF- magic bytes
    const pdfHeader = Buffer.from(pdfBuffer.slice(0, 5)).toString("utf-8")
    expect(pdfHeader).toBe("%PDF-")

    // Load with pdf-lib and check A4 dimensions (595.28 x 841.89 pt)
    const pdfDoc = await PDFDocument.load(pdfBuffer)
    expect(pdfDoc.getPageCount()).toBe(1)
    const pdfPage = pdfDoc.getPage(0)
    const { width, height } = pdfPage.getSize()
    expect(Math.round(width)).toBe(595)
    expect(Math.round(height)).toBe(842)
  })

  it("enforces role boundaries: employee cannot approve and cannot access other staff payslips", async () => {
    // 1. Employee creates a request
    sessionMock.mockResolvedValue({ user: { id: "user-employee" } } as never)
    const submitRes = await createPunchRequestRoute(
      new Request("http://localhost/api/punch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: "2026-11-03",
          punchType: "BOTH",
          requestedInTime: "09:00",
          requestedOutTime: "17:00",
          reason: "OUTSTATION_DUTY",
          explanation: "Attended educational conference",
        }),
      })
    )
    expect(submitRes.status).toBe(201)
    const { id: reqId } = await submitRes.json()

    // 2. Employee tries to approve their own request -> 403 Forbidden
    const approveAttempt = await updatePunchRequestRoute(
      new Request(`http://localhost/api/punch-requests/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      }),
      { params: Promise.resolve({ id: reqId }) }
    )
    expect(approveAttempt.status).toBe(403)

    // 3. Employee tries to download another staff member's payslip -> 403 Forbidden
    const otherPayroll = {
      id: "payroll-other-staff",
      staffId: "staff-other",
      month: 10,
      year: 2026,
      payGroup: "CASH",
      totalDays: 31,
      presentDays: 20,
      ncpDays: 11,
      actualCtc: 20000,
      grossWage: 18000,
      basicWage: 15000,
      bonusAmount: 0,
      bonusDays: 0,
      bonusType: "NONE",
      isBonusPfApplicable: false,
      epfWages: 0,
      epsWages: 0,
      edliWages: 0,
      employeeEpf: 0,
      employerEps: 0,
      employerEpf: 0,
      refundOfAdvance: 0,
      netPayment: 18000,
      isLocked: true,
      staff: {
        id: "staff-other",
        name: "Other Employee",
        employeeCode: "EMP-999",
        machineId: "999",
        departmentId: "dept-science",
        designationId: "desig-lecturer",
        shiftId: null,
        payrollInfo: null,
      },
    }
    ;(fake.client as any).monthlyPayroll.findUnique = vi.fn().mockResolvedValue(otherPayroll)

    const payslipOtherRes = await getPayrollPdfRoute(
      new Request("http://localhost/api/payroll/payroll-other-staff/pdf"),
      { params: Promise.resolve({ id: "payroll-other-staff" }) }
    )
    expect(payslipOtherRes.status).toBe(403)
  })
})
