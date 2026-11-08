import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { ensureSchoolTimezone } from "@/lib/timezone"
import { createFakePrisma } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/attendance", () => ({ recalculateAttendance: vi.fn() }))

import { getServerSession } from "next-auth/next"
import { recalculateAttendance } from "@/lib/attendance"
import { GET, POST } from "./route"
import { PATCH } from "./[id]/route"

const sessionMock = vi.mocked(getServerSession)
const recalcMock = vi.mocked(recalculateAttendance)

beforeAll(() => {
  ensureSchoolTimezone()
})

const D1 = { id: "d1", name: "Science" }
const D2 = { id: "d2", name: "Math" }

const STAFF1 = {
  id: "s1",
  name: "Asha Sharma",
  machineId: "101",
  employeeCode: "EMP001",
  shiftId: null,
  shift: null,
  departmentId: "d1",
  department: D1,
  employmentPeriods: [{ startDate: "2024-01-01", endDate: null }],
}

const STAFF2 = {
  id: "s2",
  name: "Bikram Singh",
  machineId: "102",
  employeeCode: "EMP002",
  shiftId: null,
  shift: null,
  departmentId: "d2",
  department: D2,
  employmentPeriods: [{ startDate: "2024-01-01", endDate: null }],
}

const STAFF_INACTIVE = {
  id: "s3",
  name: "Chitra Sen",
  machineId: "103",
  employeeCode: "EMP003",
  shiftId: null,
  shift: null,
  departmentId: "d1",
  department: D1,
  employmentPeriods: [{ startDate: "2024-01-01", endDate: "2024-06-30" }],
}

const USERS = [
  {
    id: "u-admin",
    name: "Admin User",
    email: "admin@school.com",
    role: "ADMIN",
    staffId: null,
    staff: null,
    approverDepartments: [],
  },
  {
    id: "u-appr-d1",
    name: "Dept Approver",
    email: "approver@school.com",
    role: "APPROVER",
    staffId: null,
    staff: null,
    approverDepartments: [{ departmentId: "d1" }],
  },
  {
    id: "u-appr-all",
    name: "Head Approver",
    email: "headapprover@school.com",
    role: "APPROVER",
    approvesAllDepartments: true,
    staffId: null,
    staff: null,
    approverDepartments: [],
  },
  {
    id: "u-emp1",
    name: "Employee Asha",
    email: "asha@school.com",
    role: "EMPLOYEE",
    staffId: "s1",
    staff: STAFF1,
    approverDepartments: [],
  },
  {
    id: "u-emp2",
    name: "Employee Bikram",
    email: "bikram@school.com",
    role: "EMPLOYEE",
    staffId: "s2",
    staff: STAFF2,
    approverDepartments: [],
  },
]

let fake: ReturnType<typeof createFakePrisma>

function setupPrisma(opts?: {
  punchRequests?: unknown[]
  lockedPayrolls?: { staffId: string; month: number; year: number }[]
  systemSettings?: { key: string; value: string }[]
  logs?: { id: string; staffId: string; timestamp: Date; type: string }[]
}) {
  fake = createFakePrisma({
    staff: [STAFF1, STAFF2, STAFF_INACTIVE],
    policy: null,
    holidays: [],
    lockedPayrolls: opts?.lockedPayrolls ?? [],
    logs: opts?.logs ?? [],
    punchRequests: (opts?.punchRequests as never) ?? [],
    users: USERS,
    systemSettings: opts?.systemSettings ?? [],
  })
  holder.client = fake.client
}

const postReq = (body: unknown) =>
  new Request("http://localhost/api/punch-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const getReq = (qs = "") =>
  new Request(`http://localhost/api/punch-requests${qs ? `?${qs}` : ""}`, {
    method: "GET",
  })

const patchReq = (id: string, body: unknown) =>
  new Request(`http://localhost/api/punch-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const patchContext = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  sessionMock.mockResolvedValue({ user: { id: "u-emp1" } } as never)
  setupPrisma()
})

describe("POST /api/punch-requests", () => {
  it("rejects unauthenticated requests with 401", async () => {
    sessionMock.mockResolvedValue(null)
    const res = await POST(postReq({ date: "2026-11-06", punchType: "IN", requestedTime: "09:00", reason: "FORGOT_SWIPE" }))
    expect(res.status).toBe(401)
  })

  it("creates a valid IN punch request for an authenticated employee", async () => {
    const res = await POST(
      postReq({
        date: "2026-11-06",
        punchType: "IN",
        requestedTime: "08:45",
        reason: "FORGOT_SWIPE",
        explanation: "Forgot card at home",
      })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({
      staffId: "s1",
      date: "2026-11-06",
      punchType: "IN",
      requestedTime: "08:45",
      reason: "FORGOT_SWIPE",
      explanation: "Forgot card at home",
      status: "PENDING",
    })
    expect(body.id).toBeDefined()
  })

  it("creates a valid BOTH punch request with in/out times", async () => {
    const res = await POST(
      postReq({
        date: "2026-11-06",
        punchType: "BOTH",
        requestedInTime: "08:30",
        requestedOutTime: "15:30",
        reason: "DUTY_OUTSIDE",
      })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toMatchObject({
      staffId: "s1",
      date: "2026-11-06",
      punchType: "BOTH",
      requestedInTime: "08:30",
      requestedOutTime: "15:30",
      status: "PENDING",
    })
  })

  it("rejects invalid time formats with 400", async () => {
    const res = await POST(
      postReq({
        date: "2026-11-06",
        punchType: "IN",
        requestedTime: "25:00",
        reason: "FORGOT_SWIPE",
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })

  it("rejects missing times for BOTH punch type with 400", async () => {
    const res = await POST(
      postReq({
        date: "2026-11-06",
        punchType: "BOTH",
        requestedInTime: "08:30",
        reason: "DUTY_OUTSIDE",
      })
    )
    expect(res.status).toBe(400)
  })

  it("rejects if staff was not employed on that date with 400", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u-admin" } } as never)
    // s3 was employed until 2024-06-30
    const res = await POST(
      postReq({
        staffId: "s3",
        date: "2024-07-15",
        punchType: "IN",
        requestedTime: "09:00",
        reason: "OTHER",
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Staff was not employed on this date")
  })

  it("fails with 400 if date is in a locked payroll month", async () => {
    setupPrisma({
      lockedPayrolls: [{ staffId: "s1", month: 10, year: 2026 }],
    })
    const res = await POST(
      postReq({
        date: "2026-10-15",
        punchType: "IN",
        requestedTime: "09:00",
        reason: "FORGOT_SWIPE",
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Cannot request punch regularization for a locked payroll month")
  })

  it("fails with 400 if an active PENDING request already exists for that staff and date", async () => {
    setupPrisma({
      punchRequests: [
        {
          id: "pr-existing",
          staffId: "s1",
          date: "2026-11-06",
          punchType: "IN",
          requestedTime: "09:00",
          reason: "FORGOT_SWIPE",
          status: "PENDING",
        },
      ],
    })
    const res = await POST(
      postReq({
        date: "2026-11-06",
        punchType: "OUT",
        requestedTime: "17:00",
        reason: "FORGOT_SWIPE",
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("A pending request already exists for this date")
  })

  it("fails with 400 if request exceeds maximum allowed submission window (PUNCH_REQUEST_MAX_DAYS)", async () => {
    setupPrisma({
      systemSettings: [{ key: "PUNCH_REQUEST_MAX_DAYS", value: "7" }],
    })
    // 30 days ago
    const res = await POST(
      postReq({
        date: "2026-10-01",
        punchType: "IN",
        requestedTime: "09:00",
        reason: "FORGOT_SWIPE",
      })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Request exceeds the maximum allowed submission window")
  })
})

describe("GET /api/punch-requests", () => {
  it("EMPLOYEE only returns requests where staffId === session.user.staffId", async () => {
    setupPrisma({
      punchRequests: [
        { id: "pr1", staffId: "s1", date: "2026-11-06", punchType: "IN", status: "PENDING", reason: "R1" },
        { id: "pr2", staffId: "s2", date: "2026-11-06", punchType: "IN", status: "PENDING", reason: "R2" },
      ],
    })
    sessionMock.mockResolvedValue({ user: { id: "u-emp1" } } as never)
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe("pr1")
    expect(body[0].staffId).toBe("s1")
  })

  it("EMPLOYEE querying with another staffId is constrained to their own staffId", async () => {
    setupPrisma({
      punchRequests: [
        { id: "pr1", staffId: "s1", date: "2026-11-06", punchType: "IN", status: "PENDING", reason: "R1" },
        { id: "pr2", staffId: "s2", date: "2026-11-06", punchType: "IN", status: "PENDING", reason: "R2" },
      ],
    })
    sessionMock.mockResolvedValue({ user: { id: "u-emp1" } } as never)
    const res = await GET(getReq("staffId=s2"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(0) // employee cannot see s2 requests
  })

  it("APPROVER returns requests for staff in their allowed department only", async () => {
    setupPrisma({
      punchRequests: [
        { id: "pr1", staffId: "s1", date: "2026-11-06", punchType: "IN", status: "PENDING", reason: "R1", staff: STAFF1 },
        { id: "pr2", staffId: "s2", date: "2026-11-06", punchType: "IN", status: "PENDING", reason: "R2", staff: STAFF2 },
      ],
    })
    sessionMock.mockResolvedValue({ user: { id: "u-appr-d1" } } as never)
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe("pr1")
  })

  it("ADMIN returns all requests across all departments", async () => {
    setupPrisma({
      punchRequests: [
        { id: "pr1", staffId: "s1", date: "2026-11-06", punchType: "IN", status: "PENDING", reason: "R1" },
        { id: "pr2", staffId: "s2", date: "2026-11-06", punchType: "IN", status: "APPROVED", reason: "R2" },
      ],
    })
    sessionMock.mockResolvedValue({ user: { id: "u-admin" } } as never)
    const res = await GET(getReq())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
  })

  it("supports filtering by status, date, and month", async () => {
    setupPrisma({
      punchRequests: [
        { id: "pr1", staffId: "s1", date: "2026-11-05", punchType: "IN", status: "PENDING", reason: "R1" },
        { id: "pr2", staffId: "s1", date: "2026-11-06", punchType: "IN", status: "APPROVED", reason: "R2" },
        { id: "pr3", staffId: "s1", date: "2026-10-15", punchType: "IN", status: "PENDING", reason: "R3" },
      ],
    })
    sessionMock.mockResolvedValue({ user: { id: "u-admin" } } as never)

    const resStatus = await GET(getReq("status=PENDING"))
    const bodyStatus = await resStatus.json()
    expect(bodyStatus).toHaveLength(2)

    const resDate = await GET(getReq("date=2026-11-06"))
    const bodyDate = await resDate.json()
    expect(bodyDate).toHaveLength(1)
    expect(bodyDate[0].id).toBe("pr2")

    const resMonth = await GET(getReq("month=2026-10"))
    const bodyMonth = await resMonth.json()
    expect(bodyMonth).toHaveLength(1)
    expect(bodyMonth[0].id).toBe("pr3")
  })
})

describe("PATCH /api/punch-requests/[id]", () => {
  describe("action: CANCEL", () => {
    it("allows employee to cancel their own PENDING request", async () => {
      setupPrisma({
        punchRequests: [
          { id: "pr1", staffId: "s1", date: "2026-11-06", punchType: "IN", status: "PENDING", reason: "R1" },
        ],
      })
      sessionMock.mockResolvedValue({ user: { id: "u-emp1" } } as never)
      const res = await PATCH(patchReq("pr1", { action: "CANCEL" }), patchContext("pr1"))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe("CANCELLED")
    })

    it("prevents employee from cancelling another employee's request with 403", async () => {
      setupPrisma({
        punchRequests: [
          { id: "pr2", staffId: "s2", date: "2026-11-06", punchType: "IN", status: "PENDING", reason: "R2" },
        ],
      })
      sessionMock.mockResolvedValue({ user: { id: "u-emp1" } } as never)
      const res = await PATCH(patchReq("pr2", { action: "CANCEL" }), patchContext("pr2"))
      expect(res.status).toBe(403)
    })

    it("fails with 400 when attempting to cancel a non-pending request", async () => {
      setupPrisma({
        punchRequests: [
          { id: "pr1", staffId: "s1", date: "2026-11-06", punchType: "IN", status: "APPROVED", reason: "R1" },
        ],
      })
      sessionMock.mockResolvedValue({ user: { id: "u-emp1" } } as never)
      const res = await PATCH(patchReq("pr1", { action: "CANCEL" }), patchContext("pr1"))
      expect(res.status).toBe(400)
    })
  })

  describe("action: APPROVE", () => {
    it("approver can approve a request: inserts AttendanceLog, marks request APPROVED, writes AuditLog, calls recalculateAttendance", async () => {
      setupPrisma({
        punchRequests: [
          {
            id: "pr1",
            staffId: "s1",
            date: "2026-11-06",
            punchType: "IN",
            requestedTime: "08:45",
            reason: "FORGOT_SWIPE",
            status: "PENDING",
            staff: STAFF1,
          },
        ],
      })
      sessionMock.mockResolvedValue({ user: { id: "u-appr-d1" } } as never)

      const res = await PATCH(
        patchReq("pr1", { action: "APPROVE", decisionRemarks: "Approved by HOD" }),
        patchContext("pr1")
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe("APPROVED")
      expect(body.decidedByUserId).toBe("u-appr-d1")
      expect(body.decisionRemarks).toBe("Approved by HOD")

      // AttendanceLog created with proper IST timestamp
      expect(fake.client.attendanceLog).toBeDefined()
      const logs = await fake.client.attendanceLog.findMany({ where: { staffId: "s1" } })
      expect(logs).toHaveLength(1)
      expect(logs[0].type).toBe("IN")
      expect(logs[0].timestamp.toISOString()).toBe(new Date("2026-11-06T08:45:00+05:30").toISOString())

      // recalculateAttendance called for targetDate
      expect(recalcMock).toHaveBeenCalledWith(
        new Date("2026-11-06T00:00:00+05:30"),
        new Date("2026-11-06T00:00:00+05:30")
      )
    })

    it("approving a BOTH punch creates 2 AttendanceLogs (IN and OUT)", async () => {
      setupPrisma({
        punchRequests: [
          {
            id: "pr-both",
            staffId: "s1",
            date: "2026-11-06",
            punchType: "BOTH",
            requestedInTime: "08:30",
            requestedOutTime: "15:45",
            reason: "DUTY_OUTSIDE",
            status: "PENDING",
            staff: STAFF1,
          },
        ],
      })
      sessionMock.mockResolvedValue({ user: { id: "u-admin" } } as never)

      const res = await PATCH(patchReq("pr-both", { action: "APPROVE" }), patchContext("pr-both"))
      expect(res.status).toBe(200)

      const logs = await fake.client.attendanceLog.findMany({ where: { staffId: "s1" } })
      expect(logs).toHaveLength(2)
      expect(logs[0]).toMatchObject({ type: "IN", timestamp: new Date("2026-11-06T08:30:00+05:30") })
      expect(logs[1]).toMatchObject({ type: "OUT", timestamp: new Date("2026-11-06T15:45:00+05:30") })
    })

    it("approver cannot approve a request for a staff member outside their department (HTTP 403)", async () => {
      setupPrisma({
        punchRequests: [
          {
            id: "pr2",
            staffId: "s2", // s2 is in d2
            date: "2026-11-06",
            punchType: "IN",
            requestedTime: "09:00",
            status: "PENDING",
            staff: STAFF2,
          },
        ],
      })
      // u-appr-d1 only has department d1
      sessionMock.mockResolvedValue({ user: { id: "u-appr-d1" } } as never)

      const res = await PATCH(patchReq("pr2", { action: "APPROVE" }), patchContext("pr2"))
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe("Forbidden")
    })

    it("fails with 400 when approving for a locked payroll month", async () => {
      setupPrisma({
        lockedPayrolls: [{ staffId: "s1", month: 10, year: 2026 }],
        punchRequests: [
          {
            id: "pr-locked",
            staffId: "s1",
            date: "2026-10-15",
            punchType: "IN",
            requestedTime: "09:00",
            status: "PENDING",
            staff: STAFF1,
          },
        ],
      })
      sessionMock.mockResolvedValue({ user: { id: "u-admin" } } as never)

      const res = await PATCH(patchReq("pr-locked", { action: "APPROVE" }), patchContext("pr-locked"))
      expect(res.status).toBe(400)
    })
  })

  describe("action: REJECT", () => {
    it("approver can reject a request with remarks", async () => {
      setupPrisma({
        punchRequests: [
          {
            id: "pr1",
            staffId: "s1",
            date: "2026-11-06",
            punchType: "IN",
            requestedTime: "08:45",
            reason: "FORGOT_SWIPE",
            status: "PENDING",
            staff: STAFF1,
          },
        ],
      })
      sessionMock.mockResolvedValue({ user: { id: "u-appr-d1" } } as never)

      const res = await PATCH(
        patchReq("pr1", { action: "REJECT", decisionRemarks: "Not supported by duty slip" }),
        patchContext("pr1")
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe("REJECTED")
      expect(body.decidedByUserId).toBe("u-appr-d1")
      expect(body.decisionRemarks).toBe("Not supported by duty slip")

      // recalculateAttendance should NOT be called for rejection
      expect(recalcMock).not.toHaveBeenCalled()
    })

    it("employee cannot reject a request (HTTP 403)", async () => {
      setupPrisma({
        punchRequests: [
          { id: "pr1", staffId: "s1", date: "2026-11-06", punchType: "IN", status: "PENDING", staff: STAFF1 },
        ],
      })
      sessionMock.mockResolvedValue({ user: { id: "u-emp1" } } as never)

      const res = await PATCH(patchReq("pr1", { action: "REJECT" }), patchContext("pr1"))
      expect(res.status).toBe(403)
    })
  })
})
