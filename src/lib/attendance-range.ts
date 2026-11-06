import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, eachDayOfInterval, isAfter } from 'date-fns'
import { istDateKey } from '@/lib/dashboard-calc'
import { shiftOn, type AssignmentLite, type ShiftLite } from '@/lib/shift-lookup'
import { evaluateDay, type DayLog, type DayPolicy, type DayResult } from '@/lib/attendance-day'

export type DailyRecordRow = DayResult & { staffId: string; date: Date }

export type RangeInputs = {
  startDate: Date
  endDate: Date
  staffList: { id: string; shiftId: string | null; shift: { startTime: string } | null }[]
  /** Every shift by id; evaluation resolves each day's shift from these plus the assignments. */
  shiftsById: Map<string, ShiftLite>
  /** Per staff, their dated shift assignments (absent key = none, fall back to `shiftId`). */
  assignmentsByStaff: Map<string, AssignmentLite[]>
  policy: DayPolicy & { weekOffDays?: string }
  holidayKeys: Set<number>
  weekOffDays: number[]
  lockedKeys: Set<string>
  lockedPayrolls: { staffId: string; month: number; year: number }[]
  /** Keyed `${staffId}|${startOfDay(date).getTime()}`; each list ascending by timestamp. */
  logsByStaffDay: Map<string, DayLog[]>
  staffId?: string
}

const FALLBACK_POLICY: DayPolicy = {
  lateArrivalAllow: '00:15',
  halfDayIfWorkHrsLessThan: '06:00',
  absentIfWorkHrsLessThan: '00:00',
  allInOut: 'First IN Last OUT',
}

const staffDayKey = (staffId: string, date: Date) => `${staffId}|${startOfDay(date).getTime()}`
const lockedKey = (staffId: string, month: number, year: number) => `${staffId}-${month}-${year}`

function rangeDays(startDate: Date, endDate: Date) {
  return eachDayOfInterval({ start: startOfDay(startDate), end: startOfDay(endDate) })
}

export async function loadRangeInputs(opts: { startDate: Date; endDate: Date; staffId?: string }): Promise<RangeInputs> {
  const { startDate, endDate, staffId } = opts
  const staffScope = staffId ? { staffId } : {}

  const staffList = await prisma.staff.findMany({
    ...(staffId ? { where: { id: staffId } } : {}),
    include: { shift: true },
  })

  const shifts = await prisma.shift.findMany()
  const shiftsById = new Map<string, ShiftLite>(shifts.map(sh => [sh.id, sh]))
  const assignments = await prisma.shiftAssignment.findMany({ ...(staffId ? { where: { staffId } } : {}) })
  const assignmentsByStaff = new Map<string, AssignmentLite[]>()
  for (const a of assignments) {
    const list = assignmentsByStaff.get(a.staffId)
    const item = { effectiveFrom: a.effectiveFrom, shiftId: a.shiftId }
    if (list) list.push(item)
    else assignmentsByStaff.set(a.staffId, [item])
  }

  const policy: DayPolicy & { weekOffDays?: string } = (await prisma.policy.findFirst()) || FALLBACK_POLICY

  const holidays = await prisma.holiday.findMany({
    where: {
      date: {
        gte: startOfDay(startDate),
        lte: startOfDay(endDate),
      },
    },
  })
  const holidayKeys = new Set(holidays.map(h => h.date.getTime()))
  const weekOffDays = policy.weekOffDays ? policy.weekOffDays.split(',').map(Number) : [0] // default Sunday

  // Locked payrolls within this range: their daily records are never modified
  const lockedPayrolls = await prisma.monthlyPayroll.findMany({
    where: {
      isLocked: true,
      year: { gte: startDate.getFullYear(), lte: endDate.getFullYear() },
      ...staffScope,
    },
    select: { staffId: true, month: true, year: true },
  })
  const lockedKeys = new Set(lockedPayrolls.map(p => lockedKey(p.staffId, p.month, p.year)))

  // One query for the whole range, grouped by staff and local day
  const logs = await prisma.attendanceLog.findMany({
    where: {
      timestamp: {
        gte: startOfDay(startDate),
        lte: endOfDay(endDate),
      },
      ...staffScope,
    },
    orderBy: { timestamp: 'asc' },
  })
  const logsByStaffDay = new Map<string, DayLog[]>()
  for (const log of logs) {
    const key = staffDayKey(log.staffId, log.timestamp)
    const list = logsByStaffDay.get(key)
    if (list) list.push(log)
    else logsByStaffDay.set(key, [log])
  }

  return {
    startDate,
    endDate,
    staffList,
    shiftsById,
    assignmentsByStaff,
    policy,
    holidayKeys,
    weekOffDays,
    lockedKeys,
    lockedPayrolls,
    logsByStaffDay,
    ...(staffId ? { staffId } : {}),
  }
}

/** Pure: evaluates every staff on every day of the range. Skips future days with no punches and locked staff-months. */
export function computeRangeRecords(inputs: RangeInputs, now: Date): DailyRecordRow[] {
  const { staffList, shiftsById, assignmentsByStaff, policy, holidayKeys, weekOffDays, lockedKeys, logsByStaffDay } = inputs
  const today = startOfDay(now)
  const records: DailyRecordRow[] = []

  for (const date of rangeDays(inputs.startDate, inputs.endDate)) {
    const day = startOfDay(date)
    const isHoliday = holidayKeys.has(day.getTime())
    const isWeekOff = weekOffDays.includes(date.getDay())
    const isFutureDate = isAfter(day, today)

    for (const staff of staffList) {
      if (inputs.staffId && staff.id !== inputs.staffId) continue
      const myLogs = logsByStaffDay.get(staffDayKey(staff.id, day)) || []

      // If the date is strictly in the future and has no punches, skip creating any record
      if (isFutureDate && myLogs.length === 0) continue

      if (lockedKeys.has(lockedKey(staff.id, date.getMonth() + 1, date.getFullYear()))) continue

      const shift = shiftOn(assignmentsByStaff.get(staff.id) ?? [], staff.shiftId, shiftsById, istDateKey(date))
      const result = evaluateDay({ date, logs: myLogs, shift, policy, isHoliday, isWeekOff })
      records.push({ staffId: staff.id, date: day, ...result })
    }
  }

  return records
}

/** Replaces the range's daily records in one transaction, never touching locked staff-months. */
export async function persistRangeRecords(inputs: RangeInputs, records: DailyRecordRow[]): Promise<void> {
  const { startDate, endDate, lockedPayrolls, staffId } = inputs
  const scoped = staffId ? lockedPayrolls.filter(p => p.staffId === staffId) : lockedPayrolls

  const where: Prisma.DailyRecordWhereInput = {
    ...(staffId ? { staffId } : {}),
    date: {
      gte: startOfDay(startDate),
      lte: startOfDay(endDate),
    },
  }
  if (scoped.length > 0) {
    // Exclude locked staff/months; local timezone matches the 'startOfDay' dates in the DB
    where.NOT = {
      OR: scoped.map(p => ({
        staffId: p.staffId,
        date: {
          gte: startOfDay(new Date(p.year, p.month - 1, 1)),
          lte: endOfDay(new Date(p.year, p.month, 0)),
        },
      })),
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.dailyRecord.deleteMany({ where })

    const chunkSize = 100
    for (let i = 0; i < records.length; i += chunkSize) {
      await tx.dailyRecord.createMany({ data: records.slice(i, i + chunkSize) })
    }
  })
}

export async function recalculateRange(opts: {
  startDate: Date
  endDate: Date
  staffId?: string
}): Promise<{ days: number; records: number }> {
  const days = rangeDays(opts.startDate, opts.endDate).length
  const inputs = await loadRangeInputs(opts)
  const records = computeRangeRecords(inputs, new Date())
  await persistRangeRecords(inputs, records)
  return { days, records: records.length }
}
