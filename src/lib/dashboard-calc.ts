import { SCHOOL_TZ } from "@/lib/format"

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

function istParts(d: Date) {
  const o: Record<string, number> = {}
  for (const p of partsFmt.formatToParts(d)) {
    if (p.type !== "literal") o[p.type] = Number(p.value)
  }
  // Some engines render midnight as hour 24 with hour12:false
  if (o.hour === 24) o.hour = 0
  return o as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** yyyy-MM-dd of d's IST date, built from parts so it does not depend on a locale's format string. */
export function istDateKey(d: Date): string {
  const p = istParts(d)
  return `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

/** Offset of SCHOOL_TZ from UTC, in ms, at instant d. */
function tzOffsetMs(d: Date): number {
  const p = istParts(d)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(d.getTime() / 1000) * 1000
}

/** The instant of 00:00 IST on d's IST date. */
export function istDayStart(d: Date): Date {
  const p = istParts(d)
  const midnightAsUtc = Date.UTC(p.year, p.month - 1, p.day)
  return new Date(midnightAsUtc - tzOffsetMs(new Date(midnightAsUtc - tzOffsetMs(d))))
}

/** Minutes since IST midnight. */
export function istMinutes(d: Date): number {
  const p = istParts(d)
  return p.hour * 60 + p.minute
}

export function parseHHMM(s: string): number {
  const [h, m] = s.split(":").map(Number)
  return h * 60 + (m || 0)
}

/** The allowance when the policy value is missing or malformed (policy default). */
export function normalizeAllow(allow: string | null | undefined): string {
  return typeof allow === "string" && /^\d{1,2}:\d{2}$/.test(allow) ? allow : "00:15"
}

export function formatHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Late = strictly after shiftStart + allow. False when no shift. */
export function isLate(firstPunch: Date, shiftStart: string | null, allow: string): boolean {
  if (!shiftStart) return false
  const p = istParts(firstPunch)
  const exact = p.hour * 60 + p.minute + p.second / 60
  return exact > parseHHMM(shiftStart) + parseHHMM(normalizeAllow(allow))
}

/** Minutes late measured from shift start (not from the grace limit); 0 when no shift or early. */
export function lateMinutes(firstPunch: Date, shiftStart: string | null): number {
  if (!shiftStart) return 0
  return Math.max(0, istMinutes(firstPunch) - parseHHMM(shiftStart))
}

export function binArrivals(
  firstPunches: { at: Date; late: boolean }[],
  fromHHMM = "07:45",
  toHHMM = "09:45",
  slotMinutes = 15,
): { label: string; onTime: number; late: number }[] {
  const slot = slotMinutes > 0 ? slotMinutes : 15
  const from = parseHHMM(fromHHMM)
  const to = parseHHMM(toHHMM)
  const bins: { label: string; onTime: number; late: number }[] = []
  for (let m = from; m < to; m += slot) bins.push({ label: formatHHMM(m), onTime: 0, late: 0 })
  if (bins.length === 0) return bins
  for (const { at, late } of firstPunches) {
    const idx = Math.floor((istMinutes(at) - from) / slot)
    const bin = bins[Math.min(Math.max(idx, 0), bins.length - 1)]
    if (late) bin.late++
    else bin.onTime++
  }
  return bins
}

export function turnoutPercent(present: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((present / total) * 100)
}

export function isDeviceOnline(lastPing: Date, now: Date): boolean {
  return now.getTime() - lastPing.getTime() < 5 * 60 * 1000
}

/** Consecutive working days (newest first) not in presentDates, stopping at the first present day. */
export function absenceStreak(presentDates: Set<string>, workingDays: string[]): number {
  let n = 0
  for (const day of workingDays) {
    if (presentDates.has(day)) break
    n++
  }
  return n
}

export function weekdayDelta(
  today: number,
  sameWeekdayLastWeek: number,
): { text: string; direction: "up" | "down" | "flat" } {
  const diff = today - sameWeekdayLastWeek
  if (diff > 0) return { text: `+${diff}`, direction: "up" }
  if (diff < 0) return { text: `−${-diff}`, direction: "down" }
  return { text: "same", direction: "flat" }
}

/**
 * Resolve each log to IN/OUT. Explicit IN/OUT are kept. If any explicit OUT exists,
 * PUNCH is treated as IN. Otherwise a single log is IN; with several, odd indexes and the last are OUT.
 */
export function inferPunchTypes(logs: { type: string; timestamp: Date }[]): ("IN" | "OUT")[] {
  const hasExplicitOut = logs.some(l => l.type === "OUT")
  return logs.map((l, idx) => {
    if (l.type === "IN") return "IN"
    if (l.type === "OUT") return "OUT"
    if (hasExplicitOut || logs.length === 1) return "IN"
    return idx === logs.length - 1 || idx % 2 === 1 ? "OUT" : "IN"
  })
}

/** Arrivals window in minutes since midnight around a shift start, clamped to 00:00-23:59 (no wrap). */
export function arrivalsWindow(commonStart: string | null, before = 45, after = 75): { from: number; to: number } {
  const start = commonStart ? parseHHMM(commonStart) : parseHHMM("08:30")
  return { from: Math.max(0, start - before), to: Math.min(1439, start + after) }
}

/** True when the day's punches end on an IN (the person has not punched out). */
export function hasMissingOut(logs: { type: string; timestamp: Date }[]): boolean {
  if (logs.length === 0) return false
  const types = inferPunchTypes(logs)
  return types[types.length - 1] === "IN"
}

/**
 * Sums IN->OUT pairs like the recalculate route: the latest IN replaces an open IN, an OUT with
 * no open IN is ignored, each pair is floored to whole minutes, and an open IN runs until now.
 */
export function dutyMinutes(punches: { at: Date; type: "IN" | "OUT" }[], now: Date): number {
  let total = 0
  let openIn: Date | null = null
  for (const p of punches) {
    if (p.type === "IN") {
      openIn = p.at
    } else if (openIn) {
      total += Math.floor((p.at.getTime() - openIn.getTime()) / 60000)
      openIn = null
    }
  }
  if (openIn) total += Math.floor(Math.max(0, now.getTime() - openIn.getTime()) / 60000)
  return total
}
