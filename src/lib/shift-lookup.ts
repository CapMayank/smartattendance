// Pure per-day shift resolution from a teacher's dated shift assignments.
// Day keys are India-time `YYYY-MM-DD` strings (see istDateKey in dashboard-calc.ts),
// so plain string comparison orders them correctly.

/** The "always" start date used for the INITIAL assignment. */
export const ALWAYS = "2000-01-01"

export type ShiftLite = { id: string; name: string; startTime: string; endTime: string }
export type AssignmentLite = { effectiveFrom: string; shiftId: string | null }

/** Assignment with the greatest effectiveFrom <= dayKey, or null if none is effective yet. */
function effectiveAssignment(assignments: AssignmentLite[], dayKey: string): AssignmentLite | null {
  let best: AssignmentLite | null = null
  for (const a of assignments) {
    if (a.effectiveFrom <= dayKey && (best === null || a.effectiveFrom > best.effectiveFrom)) {
      best = a
    }
  }
  return best
}

function resolveShiftId(
  assignments: AssignmentLite[],
  fallbackShiftId: string | null,
  dayKey: string
): string | null {
  const a = effectiveAssignment(assignments, dayKey)
  return a ? a.shiftId : fallbackShiftId
}

export function shiftOn(
  assignments: AssignmentLite[],
  fallbackShiftId: string | null,
  shiftsById: ReadonlyMap<string, ShiftLite>,
  dayKey: string
): ShiftLite | null {
  const id = resolveShiftId(assignments, fallbackShiftId, dayKey)
  if (id === null) return null
  return shiftsById.get(id) ?? null
}

export function shiftStartForDay(
  assignments: AssignmentLite[],
  fallbackShiftId: string | null,
  shiftsById: ReadonlyMap<string, ShiftLite>,
  dayKey: string
): string | null {
  return shiftOn(assignments, fallbackShiftId, shiftsById, dayKey)?.startTime ?? null
}

export function currentShiftId(
  assignments: AssignmentLite[],
  fallbackShiftId: string | null,
  todayKey: string
): string | null {
  return resolveShiftId(assignments, fallbackShiftId, todayKey)
}
