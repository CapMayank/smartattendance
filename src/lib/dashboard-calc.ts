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

function formatHHMM(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Late = strictly after shiftStart + allow. False when no shift. */
export function isLate(firstPunch: Date, shiftStart: string | null, allow: string): boolean {
  if (!shiftStart) return false
  const p = istParts(firstPunch)
  const exact = p.hour * 60 + p.minute + p.second / 60
  return exact > parseHHMM(shiftStart) + parseHHMM(allow)
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
  slot = 15,
): { label: string; onTime: number; late: number }[] {
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

/** Sums IN->OUT pairs; an open IN runs until now. */
export function dutyMinutes(punches: { at: Date; type: "IN" | "OUT" }[], now: Date): number {
  let ms = 0
  let openIn: Date | null = null
  for (const p of punches) {
    if (p.type === "IN") {
      if (!openIn) openIn = p.at
    } else if (openIn) {
      ms += p.at.getTime() - openIn.getTime()
      openIn = null
    }
  }
  if (openIn) ms += Math.max(0, now.getTime() - openIn.getTime())
  return Math.floor(ms / 60000)
}
