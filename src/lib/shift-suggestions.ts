// Stored, throttled shift suggestions: detection (database-facing wrapper around the pure
// detection in shift-detect.ts), listing, and approve / dismiss.

import { prisma } from '@/lib/prisma'
import { istDateKey, istDayStart, normalizeAllow, parseHHMM } from '@/lib/dashboard-calc'
import { buildObservedDays, detectShiftPattern, proposeShift } from '@/lib/shift-detect'
import { SHIFT_DETECTION } from '@/lib/shift-suggestions-config'
import { ALWAYS, currentShiftId, type AssignmentLite, type ShiftLite } from '@/lib/shift-lookup'
import { applyShiftChange, isValidDayKey, previewShiftChange, type ApplyResult } from '@/lib/shift-change-service'
import type { ChangeRequest, PreviewSummary } from '@/lib/shift-change'

const LOG = '[shift-suggestions]'
const DAY_MS = 86400000
const PROPOSED_ID = 'proposed:new'

/** Error carrying the HTTP status a route should answer with. */
export class SuggestionError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404,
  ) {
    super(message)
    this.name = 'SuggestionError'
  }
}

export type SuggestionView = {
  id: string
  staffId: string
  staffName: string
  fromShiftName: string | null
  medianIn: string
  medianOut: string | null
  daysObserved: number
  daysWithinTolerance: number
  lateDays: number
  patternSince: string
  direction: string
  suggestedShiftId: string | null
  suggestedStart: string
  suggestedEnd: string
}

/** True when forced, never run, or the last run was at least `throttleHours` ago. */
export function shouldRunDetection(lastRanAt: Date | null, now: Date, force: boolean): boolean {
  if (force || lastRanAt === null) return true
  return now.getTime() - lastRanAt.getTime() >= SHIFT_DETECTION.throttleHours * 3600000
}

/** A dismissal hides the same pattern until its date, unless the median arrival has moved a lot. */
export function isSuppressed(
  dismissed: { dismissedUntil: string | null; medianIn: string } | null,
  newMedianIn: string,
  todayKey: string,
): boolean {
  if (!dismissed || dismissed.dismissedUntil === null) return false
  if (todayKey > dismissed.dismissedUntil) return false
  return Math.abs(parseHHMM(newMedianIn) - parseHHMM(dismissed.medianIn)) < SHIFT_DETECTION.minDeviationMin
}

/** Day key shifted by whole days (calendar arithmetic on the key itself). */
function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

async function pendingCount(): Promise<number> {
  return prisma.shiftSuggestion.count({ where: { status: 'PENDING' } })
}

async function detectForTeacher(args: {
  staffId: string
  currentShift: ShiftLite
  allShifts: ShiftLite[]
  punchesByDay: Map<string, Date[]>
  skipDayKeys: ReadonlySet<string>
  allow: string
  todayKey: string
}): Promise<void> {
  const { staffId, currentShift, allShifts, punchesByDay, skipDayKeys, allow, todayKey } = args
  const days = buildObservedDays(punchesByDay, skipDayKeys)
  const pattern = detectShiftPattern(days, currentShift, allow)
  const existing = await prisma.shiftSuggestion.findFirst({ where: { staffId, status: 'PENDING' } })

  if (!pattern) {
    if (existing) await prisma.shiftSuggestion.delete({ where: { id: existing.id } })
    return
  }

  const dismissed = await prisma.shiftSuggestion.findFirst({
    where: { staffId, status: 'DISMISSED' },
    orderBy: { decidedAt: 'desc' },
  })
  if (isSuppressed(dismissed, pattern.medianIn, todayKey)) return

  const proposal = proposeShift(pattern, allShifts, currentShift)
  const data = {
    fromShiftId: currentShift.id,
    suggestedShiftId: proposal.shiftId,
    suggestedStart: proposal.start,
    suggestedEnd: proposal.end,
    medianIn: pattern.medianIn,
    medianOut: pattern.medianOut,
    daysObserved: pattern.daysObserved,
    daysWithinTolerance: pattern.daysWithinTolerance,
    lateDays: pattern.lateDays,
    patternSince: pattern.patternSince,
    direction: pattern.direction,
  }
  if (existing) await prisma.shiftSuggestion.update({ where: { id: existing.id }, data })
  else await prisma.shiftSuggestion.create({ data: { staffId, status: 'PENDING', ...data } })
}

/**
 * Looks at the last 28 India-time days (today excluded) of every teacher's punches and keeps
 * at most one PENDING suggestion per teacher. Throttled by `Policy.shiftDetectionRanAt`.
 */
export async function runDetection(
  opts: { force?: boolean; now?: Date } = {},
): Promise<{ ran: boolean; pending: number }> {
  const now = opts.now ?? new Date()
  const policy = await prisma.policy.findFirst()
  if (!shouldRunDetection(policy?.shiftDetectionRanAt ?? null, now, opts.force === true)) {
    return { ran: false, pending: await pendingCount() }
  }

  const todayKey = istDateKey(now)
  const windowStartKey = addDays(todayKey, -SHIFT_DETECTION.windowDays)
  const windowStart = istDayStart(new Date(now.getTime() - SHIFT_DETECTION.windowDays * DAY_MS))
  const windowEnd = new Date(istDayStart(now).getTime() - 1) // up to yesterday 23:59:59.999

  const [staffList, shifts, assignmentRows, holidays, logs] = await Promise.all([
    prisma.staff.findMany(),
    prisma.shift.findMany(),
    prisma.shiftAssignment.findMany(),
    prisma.holiday.findMany({ where: { date: { gte: windowStart, lte: windowEnd } } }),
    prisma.attendanceLog.findMany({
      where: { timestamp: { gte: windowStart, lte: windowEnd } },
      orderBy: { timestamp: 'asc' },
    }),
  ])

  const allShifts: ShiftLite[] = shifts.map((s) => ({ id: s.id, name: s.name, startTime: s.startTime, endTime: s.endTime }))
  const shiftsById = new Map(allShifts.map((s) => [s.id, s]))

  const assignmentsByStaff = new Map<string, AssignmentLite[]>()
  for (const a of assignmentRows) {
    const item = { effectiveFrom: a.effectiveFrom, shiftId: a.shiftId }
    const list = assignmentsByStaff.get(a.staffId)
    if (list) list.push(item)
    else assignmentsByStaff.set(a.staffId, [item])
  }

  const weekOffDays = (policy?.weekOffDays ?? '0').split(',').map(Number)
  const holidayKeys = new Set(holidays.map((h) => istDateKey(h.date)))
  const skipDayKeys = new Set<string>(holidayKeys)
  for (let key = windowStartKey; key < todayKey; key = addDays(key, 1)) {
    if (weekOffDays.includes(weekdayOf(key))) skipDayKeys.add(key)
  }
  const allow = normalizeAllow(policy?.lateArrivalAllow ?? '00:15')

  const punchesByStaff = new Map<string, Map<string, Date[]>>()
  for (const log of logs) {
    let byDay = punchesByStaff.get(log.staffId)
    if (!byDay) punchesByStaff.set(log.staffId, (byDay = new Map()))
    const key = istDateKey(log.timestamp)
    const list = byDay.get(key)
    if (list) list.push(log.timestamp)
    else byDay.set(key, [log.timestamp])
  }

  for (const staff of staffList) {
    try {
      const shiftId = currentShiftId(assignmentsByStaff.get(staff.id) ?? [], staff.shiftId, todayKey)
      const currentShift = shiftId ? shiftsById.get(shiftId) : undefined
      if (!currentShift) continue
      await detectForTeacher({
        staffId: staff.id,
        currentShift,
        allShifts,
        punchesByDay: punchesByStaff.get(staff.id) ?? new Map(),
        skipDayKeys,
        allow,
        todayKey,
      })
    } catch (error) {
      console.error(`${LOG} detection failed for staff ${staff.id}:`, error)
    }
  }

  if (policy) await prisma.policy.update({ where: { id: policy.id }, data: { shiftDetectionRanAt: now } })
  else {
    const created = await prisma.policy.create({ data: {} })
    await prisma.policy.update({ where: { id: created.id }, data: { shiftDetectionRanAt: now } })
  }
  return { ran: true, pending: await pendingCount() }
}

export async function listPendingSuggestions(): Promise<SuggestionView[]> {
  const rows = await prisma.shiftSuggestion.findMany({
    where: { status: 'PENDING' },
    orderBy: { patternSince: 'desc' },
  })
  if (rows.length === 0) return []
  const staffIds = [...new Set(rows.map((r) => r.staffId))]
  const [staff, shifts] = await Promise.all([
    prisma.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }),
    prisma.shift.findMany(),
  ])
  const staffName = new Map(staff.map((s) => [s.id, s.name]))
  const shiftName = new Map(shifts.map((s) => [s.id, s.name]))
  return rows.map((r) => ({
    id: r.id,
    staffId: r.staffId,
    staffName: staffName.get(r.staffId) ?? '',
    fromShiftName: r.fromShiftId ? (shiftName.get(r.fromShiftId) ?? null) : null,
    medianIn: r.medianIn,
    medianOut: r.medianOut ?? null,
    daysObserved: r.daysObserved,
    daysWithinTolerance: r.daysWithinTolerance,
    lateDays: r.lateDays,
    patternSince: r.patternSince,
    direction: r.direction,
    suggestedShiftId: r.suggestedShiftId ?? null,
    suggestedStart: r.suggestedStart,
    suggestedEnd: r.suggestedEnd,
  }))
}

async function loadPending(id: string) {
  const row = await prisma.shiftSuggestion.findFirst({ where: { id } })
  if (!row || row.status !== 'PENDING') throw new SuggestionError('Suggestion not found', 404)
  return row
}

/**
 * Applies a pending suggestion from `startDate`. A dry run writes nothing and previews the
 * change, even when the suggested shift does not exist yet.
 */
export async function approveSuggestion(
  id: string,
  startDate: string,
  opts: { dryRun?: boolean; userId?: string } = {},
): Promise<PreviewSummary | ApplyResult> {
  const suggestion = await loadPending(id)
  if (!isValidDayKey(startDate)) throw new SuggestionError('startDate must be a valid YYYY-MM-DD date', 400)
  if (startDate < ALWAYS) throw new SuggestionError(`Start date must be on or after ${ALWAYS}`, 400)

  // Target shift: the suggested one, else an existing shift with the same times, else a new one
  let shiftId: string | null = suggestion.suggestedShiftId ?? null
  if (shiftId === null) {
    const shifts = await prisma.shift.findMany()
    const same = shifts.find((s) => s.startTime === suggestion.suggestedStart && s.endTime === suggestion.suggestedEnd)
    if (same) shiftId = same.id
  }

  const base = {
    staffId: suggestion.staffId,
    effectiveFrom: startDate,
    source: 'SUGGESTION' as const,
    createdByUserId: opts.userId,
  }

  if (opts.dryRun) {
    if (shiftId !== null) return previewShiftChange({ ...base, shiftId } satisfies ChangeRequest)
    const proposed: ShiftLite = {
      id: PROPOSED_ID,
      name: `${suggestion.suggestedStart}-${suggestion.suggestedEnd}`,
      startTime: suggestion.suggestedStart,
      endTime: suggestion.suggestedEnd,
    }
    return previewShiftChange({ ...base, shiftId: PROPOSED_ID }, new Date(), [proposed])
  }

  let createdShift = false
  if (shiftId === null) {
    const created = await prisma.shift.create({
      data: {
        name: `${suggestion.suggestedStart}-${suggestion.suggestedEnd}`,
        startTime: suggestion.suggestedStart,
        endTime: suggestion.suggestedEnd,
      },
    })
    shiftId = created.id
    createdShift = true
  }

  const result = await applyShiftChange({ ...base, shiftId })
  if (result.assignmentSaved) {
    await prisma.shiftSuggestion.update({
      where: { id },
      data: {
        status: 'APPROVED',
        decidedByUserId: opts.userId ?? null,
        decidedAt: new Date(),
        ...(createdShift ? { suggestedShiftId: shiftId } : {}),
      },
    })
  }
  return result
}

/** Hides a pending suggestion for `dismissDays` days (it returns early if the pattern moves a lot). */
export async function dismissSuggestion(id: string, userId?: string): Promise<void> {
  await loadPending(id)
  await prisma.shiftSuggestion.update({
    where: { id },
    data: {
      status: 'DISMISSED',
      dismissedUntil: addDays(istDateKey(new Date()), SHIFT_DETECTION.dismissDays),
      decidedByUserId: userId ?? null,
      decidedAt: new Date(),
    },
  })
}
