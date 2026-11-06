import { normalizeAllow, parseHHMM } from "./dashboard-calc"
import type { ShiftLite } from "./shift-lookup"
import { SHIFT_DETECTION } from "./shift-suggestions-config"

export type ObservedDay = { dayKey: string; firstIn: string; lastOut: string | null }

export type Pattern = {
  medianIn: string
  medianOut: string | null
  daysObserved: number
  daysWithinTolerance: number
  lateDays: number
  patternSince: string
  direction: "EARLIER" | "LATER"
}

const MAX_MIN = 23 * 60 + 55
const MIN_DEPARTURE_DAYS = 8

const istFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

function istMinutes(d: Date): number {
  const parts = istFormatter.formatToParts(d)
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0)
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0)
  return (h % 24) * 60 + m
}

function fmt(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Nearest multiple of five; a remainder of 3 or more rounds up. */
export function roundToFive(hhmm: string): string {
  const mins = parseHHMM(hhmm)
  const r = mins % 5
  return fmt(Math.min(r >= 3 ? mins - r + 5 : mins - r, MAX_MIN))
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

const byDayKey = (a: { dayKey: string }, b: { dayKey: string }) =>
  a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0

export function buildObservedDays(
  punchesByDay: Map<string, Date[]>,
  skipDayKeys: ReadonlySet<string>,
): ObservedDay[] {
  const out: ObservedDay[] = []
  for (const [dayKey, punches] of punchesByDay) {
    if (skipDayKeys.has(dayKey) || punches.length === 0) continue
    const sorted = [...punches].sort((a, b) => a.getTime() - b.getTime())
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const gapMin = (last.getTime() - first.getTime()) / 60000
    const hasOut = sorted.length >= 2 && gapMin >= SHIFT_DETECTION.departureMinGapMin
    out.push({
      dayKey,
      firstIn: fmt(istMinutes(first)),
      lastOut: hasOut ? fmt(istMinutes(last)) : null,
    })
  }
  return out.sort(byDayKey)
}

export function detectShiftPattern(
  days: ObservedDay[],
  shift: { startTime: string; endTime: string },
  allow: string,
): Pattern | null {
  if (days.length === 0) return null
  const startMin = parseHHMM(shift.startTime)
  const allowMin = parseHHMM(normalizeAllow(allow))
  const sorted = [...days].sort(byDayKey)
  const ins = sorted.map((d) => parseHHMM(d.firstIn))

  const medianInMin = parseHHMM(roundToFive(fmt(median(ins))))
  if (medianInMin === startMin) return null
  const direction = medianInMin > startMin ? "LATER" : "EARLIER"

  const required = direction === "LATER" ? SHIFT_DETECTION.minDaysLater : SHIFT_DETECTION.minDays
  if (sorted.length < required) return null
  if (Math.abs(medianInMin - startMin) < SHIFT_DETECTION.minDeviationMin) return null

  const within = (m: number) => Math.abs(m - medianInMin) <= SHIFT_DETECTION.toleranceMin
  const daysWithinTolerance = ins.filter(within).length
  if (daysWithinTolerance / sorted.length < SHIFT_DETECTION.consistencyRatio) return null

  const lateDays = ins.filter((m) => m > startMin + allowMin).length

  const outs = sorted.flatMap((d) => (d.lastOut !== null ? [parseHHMM(d.lastOut)] : []))
  const medianOut = outs.length >= MIN_DEPARTURE_DAYS ? roundToFive(fmt(median(outs))) : null

  // Latest run of in-tolerance days, even if the newest day is a one-off odd day.
  let end = ins.length - 1
  while (end > 0 && !within(ins[end])) end--
  let sinceIdx = end
  while (sinceIdx > 0 && within(ins[sinceIdx - 1])) sinceIdx--

  return {
    medianIn: fmt(medianInMin),
    medianOut,
    daysObserved: sorted.length,
    daysWithinTolerance,
    lateDays,
    patternSince: sorted[sinceIdx].dayKey,
    direction,
  }
}

export function proposeShift(
  pattern: Pattern,
  shifts: ShiftLite[],
  currentShift: ShiftLite,
): { shiftId: string | null; start: string; end: string } {
  const inMin = parseHHMM(pattern.medianIn)
  const outMin = pattern.medianOut ? parseHHMM(pattern.medianOut) : null

  let best: ShiftLite | null = null
  let bestDist = Infinity
  for (const s of shifts) {
    const dist = Math.abs(parseHHMM(s.startTime) - inMin)
    if (dist > SHIFT_DETECTION.matchStartMin) continue
    if (outMin !== null && Math.abs(parseHHMM(s.endTime) - outMin) > SHIFT_DETECTION.matchEndMin) continue
    if (dist < bestDist) {
      best = s
      bestDist = dist
    }
  }
  if (best) return { shiftId: best.id, start: best.startTime, end: best.endTime }

  const length = parseHHMM(currentShift.endTime) - parseHHMM(currentShift.startTime)
  const endMin = outMin ?? inMin + length
  return {
    shiftId: null,
    start: fmt(Math.min(inMin, MAX_MIN)),
    end: fmt(Math.max(0, Math.min(endMin, MAX_MIN))),
  }
}
