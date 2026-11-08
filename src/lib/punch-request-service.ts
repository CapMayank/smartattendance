import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { isEmployedOnDate } from "@/lib/employment"
import { istDateKey } from "@/lib/dashboard-calc"
import { recalculateAttendance } from "@/lib/attendance"

export class PunchRequestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message)
    this.name = "PunchRequestError"
  }
}

export type PunchType = "IN" | "OUT" | "BOTH"

export type CreatePunchRequestInput = {
  date: string
  punchType: PunchType
  requestedTime?: string | null
  requestedInTime?: string | null
  requestedOutTime?: string | null
  reason: string
  explanation?: string | null
}

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDayKey(value: unknown): value is string {
  if (typeof value !== "string" || !DAY_KEY_REGEX.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function validateTimes(data: CreatePunchRequestInput) {
  if (data.punchType === "IN") {
    const time = data.requestedTime ?? data.requestedInTime
    if (!time || !TIME_REGEX.test(time)) {
      throw new PunchRequestError("Valid requestedTime (HH:MM) is required for IN punch", 400)
    }
  } else if (data.punchType === "OUT") {
    const time = data.requestedTime ?? data.requestedOutTime
    if (!time || !TIME_REGEX.test(time)) {
      throw new PunchRequestError("Valid requestedTime (HH:MM) is required for OUT punch", 400)
    }
  } else if (data.punchType === "BOTH") {
    if (!data.requestedInTime || !TIME_REGEX.test(data.requestedInTime)) {
      throw new PunchRequestError("Valid requestedInTime (HH:MM) is required for BOTH punches", 400)
    }
    if (!data.requestedOutTime || !TIME_REGEX.test(data.requestedOutTime)) {
      throw new PunchRequestError("Valid requestedOutTime (HH:MM) is required for BOTH punches", 400)
    }
  } else {
    throw new PunchRequestError("Invalid punchType: must be IN, OUT, or BOTH", 400)
  }
}

export async function createPunchRequest(staffId: string, data: CreatePunchRequestInput) {
  if (!staffId || typeof staffId !== "string") {
    throw new PunchRequestError("staffId is required", 400)
  }

  if (!isValidDayKey(data.date)) {
    throw new PunchRequestError("Invalid date format: must be YYYY-MM-DD", 400)
  }

  if (!data.reason || typeof data.reason !== "string" || data.reason.trim() === "") {
    throw new PunchRequestError("reason is required", 400)
  }

  validateTimes(data)

  // 1. Check if staff exists and was employed on date
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    include: { employmentPeriods: true },
  })
  if (!staff) {
    throw new PunchRequestError("Staff member not found", 404)
  }
  if (!isEmployedOnDate(staff, data.date)) {
    throw new PunchRequestError("Staff was not employed on this date", 400)
  }

  // 2. Check if payroll is locked for this month
  const [yStr, mStr] = data.date.split("-")
  const year = parseInt(yStr, 10)
  const month = parseInt(mStr, 10)

  const lockedPayroll = await prisma.monthlyPayroll.findUnique({
    where: {
      staffId_month_year: {
        staffId,
        month,
        year,
      },
    },
  })
  if (lockedPayroll?.isLocked) {
    throw new PunchRequestError("Cannot request punch regularization for a locked payroll month", 400)
  }

  // 3. Check if active PENDING request exists for this staff and date
  const existingPending = await prisma.punchRequest.findFirst({
    where: {
      staffId,
      date: data.date,
      status: "PENDING",
    },
  })
  if (existingPending) {
    throw new PunchRequestError("A pending request already exists for this date", 400)
  }

  // 4. Check submission cutoff if configured in SystemSetting
  const maxDaysSetting = await prisma.systemSetting.findUnique({
    where: { key: "PUNCH_REQUEST_MAX_DAYS" },
  })
  if (maxDaysSetting?.value) {
    const maxDays = parseInt(maxDaysSetting.value, 10)
    if (!isNaN(maxDays) && maxDays > 0) {
      const todayKey = istDateKey(new Date())
      const [tY, tM, tD] = todayKey.split("-").map(Number)
      const [rY, rM, rD] = data.date.split("-").map(Number)
      const todayUtc = Date.UTC(tY, tM - 1, tD)
      const reqUtc = Date.UTC(rY, rM - 1, rD)
      const diffDays = Math.floor((todayUtc - reqUtc) / (24 * 60 * 60 * 1000))
      if (diffDays > maxDays) {
        throw new PunchRequestError("Request exceeds the maximum allowed submission window", 400)
      }
    }
  }

  // Normalize stored times
  const requestedTime =
    data.punchType === "IN"
      ? (data.requestedTime ?? data.requestedInTime ?? null)
      : data.punchType === "OUT"
      ? (data.requestedTime ?? data.requestedOutTime ?? null)
      : null
  const requestedInTime =
    data.punchType === "BOTH"
      ? (data.requestedInTime ?? null)
      : data.punchType === "IN"
      ? (data.requestedInTime ?? data.requestedTime ?? null)
      : null
  const requestedOutTime =
    data.punchType === "BOTH"
      ? (data.requestedOutTime ?? null)
      : data.punchType === "OUT"
      ? (data.requestedOutTime ?? data.requestedTime ?? null)
      : null

  return await prisma.punchRequest.create({
    data: {
      staffId,
      date: data.date,
      punchType: data.punchType,
      requestedTime,
      requestedInTime,
      requestedOutTime,
      reason: data.reason,
      explanation: data.explanation ?? null,
      status: "PENDING",
    },
  })
}

export type ListPunchRequestsFilters = {
  staffId?: string
  status?: string
  date?: string
  month?: string
  allowedDepartmentIds?: string[] | null
}

export async function listPunchRequests(filters: ListPunchRequestsFilters = {}) {
  const where: Record<string, unknown> = {}

  if (filters.staffId) {
    where.staffId = filters.staffId
  }
  if (filters.status) {
    where.status = filters.status
  }
  if (filters.date) {
    where.date = filters.date
  } else if (filters.month) {
    where.date = { startsWith: filters.month }
  }
  if (filters.allowedDepartmentIds) {
    where.staff = {
      departmentId: { in: filters.allowedDepartmentIds },
    }
  }

  return await prisma.punchRequest.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          employeeCode: true,
          machineId: true,
          departmentId: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })
}

export async function approvePunchRequest(params: {
  requestId: string
  reviewerUserId: string
  reviewerDepartmentIds?: string[] | null
  isApproverRole?: boolean
  decisionRemarks?: string | null
}) {
  const preCheck = await prisma.punchRequest.findUnique({
    where: { id: params.requestId },
    include: {
      staff: {
        include: {
          department: true,
        },
      },
    },
  })

  if (!preCheck) {
    throw new PunchRequestError("Punch request not found", 404)
  }

  // Check department authority for scoped approvers
  if (params.isApproverRole && params.reviewerDepartmentIds) {
    const deptId = preCheck.staff?.departmentId
    if (!deptId || !params.reviewerDepartmentIds.includes(deptId)) {
      throw new PunchRequestError("Forbidden", 403)
    }
  }

  // Perform transaction with concurrency protection: verify pending status and locked payroll atomically
  const { updated, targetDate } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const request = await tx.punchRequest.findUnique({
      where: { id: params.requestId },
    })

    if (!request) {
      throw new PunchRequestError("Punch request not found", 404)
    }

    if (request.status !== "PENDING") {
      throw new PunchRequestError("Only pending requests can be approved", 400)
    }

    // Check if payroll month is locked inside transaction
    const [yStr, mStr] = request.date.split("-")
    const year = parseInt(yStr, 10)
    const month = parseInt(mStr, 10)

    const lockedPayroll = await tx.monthlyPayroll.findUnique({
      where: {
        staffId_month_year: {
          staffId: request.staffId,
          month,
          year,
        },
      },
    })
    if (lockedPayroll?.isLocked) {
      throw new PunchRequestError("Cannot approve request for a locked payroll month", 400)
    }

    // 1. Create AttendanceLogs in IST
    if (request.punchType === "IN") {
      const time = request.requestedTime ?? request.requestedInTime
      if (!time) throw new PunchRequestError("Missing requested IN time", 400)
      await tx.attendanceLog.create({
        data: {
          staffId: request.staffId,
          timestamp: new Date(`${request.date}T${time}:00+05:30`),
          type: "IN",
        },
      })
    } else if (request.punchType === "OUT") {
      const time = request.requestedOutTime ?? request.requestedTime
      if (!time) throw new PunchRequestError("Missing requested OUT time", 400)
      await tx.attendanceLog.create({
        data: {
          staffId: request.staffId,
          timestamp: new Date(`${request.date}T${time}:00+05:30`),
          type: "OUT",
        },
      })
    } else if (request.punchType === "BOTH") {
      if (!request.requestedInTime || !request.requestedOutTime) {
        throw new PunchRequestError("Missing requested IN or OUT time", 400)
      }
      await tx.attendanceLog.create({
        data: {
          staffId: request.staffId,
          timestamp: new Date(`${request.date}T${request.requestedInTime}:00+05:30`),
          type: "IN",
        },
      })
      await tx.attendanceLog.create({
        data: {
          staffId: request.staffId,
          timestamp: new Date(`${request.date}T${request.requestedOutTime}:00+05:30`),
          type: "OUT",
        },
      })
    }

    // 2. Update PunchRequest
    const updatedReq = await tx.punchRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        decidedByUserId: params.reviewerUserId,
        decidedAt: new Date(),
        decisionRemarks: params.decisionRemarks ?? null,
      },
    })

    // 3. Create AuditLog
    await tx.auditLog.create({
      data: {
        actorUserId: params.reviewerUserId,
        action: "PUNCH_REQUEST_APPROVED",
        targetType: "PunchRequest",
        targetId: request.id,
        details: JSON.stringify({
          staffId: request.staffId,
          date: request.date,
          punchType: request.punchType,
          decisionRemarks: params.decisionRemarks ?? null,
        }),
      },
    })

    return {
      updated: updatedReq,
      targetDate: new Date(`${request.date}T00:00:00+05:30`),
    }
  })

  // 4. Recalculate attendance for the day outside transaction
  await recalculateAttendance(targetDate, targetDate)

  return updated
}

export async function rejectPunchRequest(params: {
  requestId: string
  reviewerUserId: string
  reviewerDepartmentIds?: string[] | null
  isApproverRole?: boolean
  decisionRemarks?: string | null
}) {
  const preCheck = await prisma.punchRequest.findUnique({
    where: { id: params.requestId },
    include: {
      staff: {
        include: {
          department: true,
        },
      },
    },
  })

  if (!preCheck) {
    throw new PunchRequestError("Punch request not found", 404)
  }

  // Check department authority for scoped approvers
  if (params.isApproverRole && params.reviewerDepartmentIds) {
    const deptId = preCheck.staff?.departmentId
    if (!deptId || !params.reviewerDepartmentIds.includes(deptId)) {
      throw new PunchRequestError("Forbidden", 403)
    }
  }

  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const request = await tx.punchRequest.findUnique({
      where: { id: params.requestId },
    })

    if (!request) {
      throw new PunchRequestError("Punch request not found", 404)
    }

    if (request.status !== "PENDING") {
      throw new PunchRequestError("Only pending requests can be rejected", 400)
    }

    const updatedReq = await tx.punchRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        decidedByUserId: params.reviewerUserId,
        decidedAt: new Date(),
        decisionRemarks: params.decisionRemarks ?? null,
      },
    })

    await tx.auditLog.create({
      data: {
        actorUserId: params.reviewerUserId,
        action: "PUNCH_REQUEST_REJECTED",
        targetType: "PunchRequest",
        targetId: request.id,
        details: JSON.stringify({
          staffId: request.staffId,
          date: request.date,
          punchType: request.punchType,
          decisionRemarks: params.decisionRemarks ?? null,
        }),
      },
    })

    return updatedReq
  })
}

export async function cancelPunchRequest(params: {
  requestId: string
  staffId: string
}) {
  const request = await prisma.punchRequest.findUnique({
    where: { id: params.requestId },
  })

  if (!request) {
    throw new PunchRequestError("Punch request not found", 404)
  }

  if (request.staffId !== params.staffId) {
    throw new PunchRequestError("Forbidden", 403)
  }

  if (request.status !== "PENDING") {
    throw new PunchRequestError("Only pending requests can be cancelled", 400)
  }

  return await prisma.punchRequest.update({
    where: { id: request.id },
    data: {
      status: "CANCELLED",
    },
  })
}
