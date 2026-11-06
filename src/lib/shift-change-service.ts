// The one place that changes a teacher's shift: writes the dated assignment, keeps
// Staff.shiftId mirroring today's shift, and recalculates the affected days.
// Every writer of Staff.shiftId for an existing teacher must go through here.

import { startOfDay, eachDayOfInterval } from 'date-fns'
import { prisma } from '@/lib/prisma'
import { istDateKey } from '@/lib/dashboard-calc'
import { ALWAYS, currentShiftId, type AssignmentLite } from '@/lib/shift-lookup'
import {
  planShiftChange,
  summarizeChange,
  type ChangeOps,
  type ChangeRequest,
  type PreviewSummary,
} from '@/lib/shift-change'
import { computeRangeRecords, loadRangeInputs, recalculateRange } from '@/lib/attendance-range'

export type ApplyResult = {
  assignmentSaved: true
  recalculated: boolean
  summary: PreviewSummary
  error?: string
}

/** A start before ALWAYS changes nothing: the INITIAL row at ALWAYS covers every real day. */
export const START_BEFORE_ALWAYS_ERROR = `Start date must be on or after ${ALWAYS}`

const EMPTY_SUMMARY: PreviewSummary = { recalculatedDays: 0, changedDays: 0, transitions: {}, lockedSkippedDays: 0 }

/** True for a `YYYY-MM-DD` string that names a real calendar date. */
export function isValidDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Local midnight of a day key (the process runs in the school's timezone). */
function dayKeyToLocalDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function assertRequest(req: ChangeRequest) {
  // An empty staffId would make recalculateRange recalculate every teacher
  if (typeof req.staffId !== 'string' || req.staffId.trim() === '') throw new Error('staffId is required')
  if (!isValidDayKey(req.effectiveFrom)) throw new Error('effectiveFrom must be a valid YYYY-MM-DD date')
  if (req.effectiveFrom < ALWAYS) throw new Error(START_BEFORE_ALWAYS_ERROR)
}

type Plan = { ops: ChangeOps; existing: AssignmentLite[]; staffShiftId: string | null }

/** The teacher's full assignment list once the change is applied (as the database will hold it). */
function resultingAssignments(existing: AssignmentLite[], ops: ChangeOps): AssignmentLite[] {
  const list = existing.filter((a) => a.effectiveFrom !== ops.upsert.effectiveFrom)
  // INITIAL on the same date as the change is replaced by the upsert, as in the database
  if (ops.createInitial && ops.createInitial.effectiveFrom !== ops.upsert.effectiveFrom) list.push(ops.createInitial)
  list.push({ effectiveFrom: ops.upsert.effectiveFrom, shiftId: ops.upsert.shiftId })
  return list
}

async function planFor(req: ChangeRequest, now: Date): Promise<Plan> {
  const staff = await prisma.staff.findUnique({ where: { id: req.staffId } })
  if (!staff) throw new Error(`Staff ${req.staffId} not found`)
  const rows = await prisma.shiftAssignment.findMany({ where: { staffId: req.staffId } })
  const existing = rows.map((a) => ({ effectiveFrom: a.effectiveFrom, shiftId: a.shiftId }))
  return { ops: planShiftChange(existing, staff.shiftId, req, istDateKey(now)), existing, staffShiftId: staff.shiftId }
}

/** Evaluates the planned change in memory against stored records. Writes nothing. */
async function summarize(req: ChangeRequest, ops: ChangeOps, now: Date): Promise<PreviewSummary> {
  if (ops.recalcFrom === null) return { ...EMPTY_SUMMARY, transitions: {} }

  const staffId = req.staffId
  const startDate = dayKeyToLocalDate(ops.recalcFrom)
  const endDate = startOfDay(now)
  const inputs = await loadRangeInputs({ startDate, endDate, staffId })

  // Apply the proposed assignment in memory only
  const proposed = resultingAssignments(inputs.assignmentsByStaff.get(staffId) ?? [], ops)
  const assignmentsByStaff = new Map(inputs.assignmentsByStaff)
  assignmentsByStaff.set(staffId, proposed)

  const computed = computeRangeRecords({ ...inputs, assignmentsByStaff }, now).map((r) => ({
    dayKey: istDateKey(r.date),
    status: r.status,
    lateMinutes: r.lateMinutes,
  }))

  const storedRows = await prisma.dailyRecord.findMany({
    where: { staffId, date: { gte: startOfDay(startDate), lte: startOfDay(endDate) } },
    select: { date: true, status: true, lateMinutes: true },
  })
  const stored = storedRows.map((r) => ({ dayKey: istDateKey(r.date), status: r.status, lateMinutes: r.lateMinutes }))

  let lockedSkippedDays = 0
  if (startDate.getTime() <= endDate.getTime()) {
    for (const day of eachDayOfInterval({ start: startDate, end: endDate })) {
      if (inputs.lockedKeys.has(`${staffId}-${day.getMonth() + 1}-${day.getFullYear()}`)) lockedSkippedDays++
    }
  }

  return summarizeChange(stored, computed, lockedSkippedDays)
}

/** Dry run: what the change would do from its start date to today. Writes nothing. */
export async function previewShiftChange(req: ChangeRequest, now: Date = new Date()): Promise<PreviewSummary> {
  assertRequest(req)
  const { ops } = await planFor(req, now)
  return summarize(req, ops, now)
}

/**
 * Saves the assignment (plus INITIAL on a teacher's first change) and Staff.shiftId in one
 * transaction, then recalculates that teacher from the start date to today. A recalculation
 * failure keeps the assignment and returns `recalculated: false` so the caller can retry.
 */
export async function applyShiftChange(req: ChangeRequest, now: Date = new Date()): Promise<ApplyResult> {
  assertRequest(req)
  const { ops, existing, staffShiftId } = await planFor(req, now)
  const summary = await summarize(req, ops, now)
  const { staffId } = req
  // Today's shift from the full resulting history: a back-dated change may sit behind
  // another assignment that is already effective
  const todayShiftId = currentShiftId(resultingAssignments(existing, ops), staffShiftId, istDateKey(now))
  const createdByUserId = req.createdByUserId ?? null

  await prisma.$transaction(async (tx) => {
    if (ops.createInitial && ops.createInitial.effectiveFrom !== ops.upsert.effectiveFrom) {
      await tx.shiftAssignment.create({
        data: {
          staffId,
          effectiveFrom: ops.createInitial.effectiveFrom,
          shiftId: ops.createInitial.shiftId,
          source: 'INITIAL',
          createdByUserId,
        },
      })
    }
    await tx.shiftAssignment.upsert({
      where: { staffId_effectiveFrom: { staffId, effectiveFrom: ops.upsert.effectiveFrom } },
      update: { shiftId: ops.upsert.shiftId, source: ops.upsert.source, createdByUserId },
      create: {
        staffId,
        effectiveFrom: ops.upsert.effectiveFrom,
        shiftId: ops.upsert.shiftId,
        source: ops.upsert.source,
        createdByUserId,
      },
    })
    if (ops.staffShiftId !== undefined) {
      await tx.staff.update({ where: { id: staffId }, data: { shiftId: todayShiftId } })
    }
  })

  // Future-dated: nothing to recalculate until the date arrives
  if (ops.recalcFrom === null) return { assignmentSaved: true, recalculated: true, summary }

  try {
    await recalculateRange({ staffId, startDate: dayKeyToLocalDate(ops.recalcFrom), endDate: startOfDay(now) })
    return { assignmentSaved: true, recalculated: true, summary }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { assignmentSaved: true, recalculated: false, summary, error: message }
  }
}

/** Points Staff.shiftId at today's shift for every teacher whose dated assignment has arrived. */
export async function syncCurrentShifts(now: Date = new Date()): Promise<void> {
  const assignments = await prisma.shiftAssignment.findMany()
  if (assignments.length === 0) return

  const byStaff = new Map<string, AssignmentLite[]>()
  for (const a of assignments) {
    const list = byStaff.get(a.staffId)
    const item = { effectiveFrom: a.effectiveFrom, shiftId: a.shiftId }
    if (list) list.push(item)
    else byStaff.set(a.staffId, [item])
  }

  const todayKey = istDateKey(now)
  const staff = await prisma.staff.findMany({
    where: { id: { in: [...byStaff.keys()] } },
    select: { id: true, shiftId: true },
  })
  for (const s of staff) {
    const target = currentShiftId(byStaff.get(s.id) ?? [], s.shiftId, todayKey)
    if (target !== s.shiftId) {
      await prisma.staff.update({ where: { id: s.id }, data: { shiftId: target } })
    }
  }
}
