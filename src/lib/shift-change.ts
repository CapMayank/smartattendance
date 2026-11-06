// Pure planning and preview summarising for a teacher's shift change.
// Day keys are India-time `YYYY-MM-DD` strings, compared as plain strings.

import { ALWAYS, type AssignmentLite } from "./shift-lookup"

export type ChangeRequest = {
  staffId: string
  shiftId: string | null
  effectiveFrom: string
  source: "MANUAL" | "SUGGESTION"
  createdByUserId?: string
}

export type ChangeOps = {
  createInitial: { effectiveFrom: string; shiftId: string | null } | null
  upsert: { effectiveFrom: string; shiftId: string | null; source: "MANUAL" | "SUGGESTION" }
  /** Value for Staff.shiftId when effective today or earlier; undefined when future-dated. */
  staffShiftId: string | null | undefined
  /** effectiveFrom when not in the future, else null. */
  recalcFrom: string | null
}

export function planShiftChange(
  existing: AssignmentLite[],
  currentShiftId: string | null,
  req: ChangeRequest,
  todayKey: string
): ChangeOps {
  const createInitial =
    existing.length === 0 ? { effectiveFrom: ALWAYS, shiftId: currentShiftId } : null
  const effectiveNow = req.effectiveFrom <= todayKey
  return {
    createInitial,
    upsert: { effectiveFrom: req.effectiveFrom, shiftId: req.shiftId, source: req.source },
    staffShiftId: effectiveNow ? req.shiftId : undefined,
    recalcFrom: effectiveNow ? req.effectiveFrom : null,
  }
}

export type StoredDay = { dayKey: string; status: string; lateMinutes: number }

export type PreviewSummary = {
  recalculatedDays: number
  changedDays: number
  transitions: Record<string, number>
  lockedSkippedDays: number
}

function label(d: { status: string; lateMinutes: number }): string {
  if (d.status === "PRESENT") return d.lateMinutes > 0 ? "LATE" : "ON_TIME"
  return d.status
}

export function summarizeChange(
  stored: StoredDay[],
  computed: { dayKey: string; status: string; lateMinutes: number }[],
  lockedSkippedDays: number
): PreviewSummary {
  const storedByDay = new Map(stored.map((d) => [d.dayKey, d]))
  const transitions: Record<string, number> = {}
  let changedDays = 0
  for (const c of computed) {
    const s = storedByDay.get(c.dayKey)
    const from = s ? label(s) : "NONE"
    const to = label(c)
    const labelChanged = from !== to
    if (labelChanged || (s !== undefined && s.lateMinutes !== c.lateMinutes)) changedDays++
    if (labelChanged) {
      const key = `${from}->${to}`
      transitions[key] = (transitions[key] ?? 0) + 1
    }
  }
  return { recalculatedDays: computed.length, changedDays, transitions, lockedSkippedDays }
}
