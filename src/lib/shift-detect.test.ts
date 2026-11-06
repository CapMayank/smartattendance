import { beforeAll, describe, expect, it } from "vitest"
import { ensureSchoolTimezone } from "./timezone"
import {
  buildObservedDays,
  detectShiftPattern,
  proposeShift,
  roundToFive,
  type ObservedDay,
} from "./shift-detect"

beforeAll(() => ensureSchoolTimezone())

const SHIFT = { startTime: "09:00", endTime: "17:00" }

function dayKey(i: number): string {
  const d = new Date(Date.UTC(2026, 9, 1 + i))
  return d.toISOString().slice(0, 10)
}

function days(times: string[], out: string | null = null): ObservedDay[] {
  return times.map((t, i) => ({ dayKey: dayKey(i), firstIn: t, lastOut: out }))
}

const rep = (t: string, n: number) => Array.from({ length: n }, () => t)

describe("detectShiftPattern", () => {
  it("detects a steady later arrival", () => {
    const times = Array.from({ length: 20 }, (_, i) => ["09:55", "10:00", "10:05", "10:10", "10:00"][i % 5])
    const p = detectShiftPattern(days(times), SHIFT, "00:15")
    expect(p).not.toBeNull()
    expect(p!.medianIn).toBe("10:00")
    expect(p!.direction).toBe("LATER")
    expect(p!.daysObserved).toBe(20)
  })

  it("detects a steady earlier arrival with 12 days", () => {
    const p = detectShiftPattern(days(rep("08:25", 12)), SHIFT, "00:15")
    expect(p?.direction).toBe("EARLIER")
    expect(p?.daysObserved).toBe(12)
  })

  it("needs enough days", () => {
    expect(detectShiftPattern(days(rep("08:25", 9)), SHIFT, "00:15")).toBeNull()
    expect(detectShiftPattern(days(rep("10:00", 12)), SHIFT, "00:15")).toBeNull()
    expect(detectShiftPattern(days(rep("10:00", 15)), SHIFT, "00:15")).not.toBeNull()
  })

  it("flags a chronically late teacher only with enough days", () => {
    const p = detectShiftPattern(days(rep("09:30", 20)), SHIFT, "00:15")
    expect(p?.direction).toBe("LATER")
    expect(p?.lateDays).toBe(20)
    expect(detectShiftPattern(days(rep("09:30", 12)), SHIFT, "00:15")).toBeNull()
  })

  it("rejects a deviation under 20 minutes", () => {
    expect(detectShiftPattern(days(rep("09:15", 20)), SHIFT, "00:15")).toBeNull()
  })

  it("rejects inconsistent arrivals", () => {
    const times = Array.from({ length: 20 }, (_, i) => {
      const m = 8 * 60 + 30 + Math.round((i * 120) / 19)
      return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
    })
    expect(detectShiftPattern(days(times), SHIFT, "00:15")).toBeNull()
  })

  it("sets patternSince to the first day of the latest in-tolerance run", () => {
    const p = detectShiftPattern(days([...rep("08:00", 3), ...rep("10:00", 15)]), SHIFT, "00:15")
    expect(p).not.toBeNull()
    expect(p!.patternSince).toBe(dayKey(3))
  })

  it("computes medianOut only with 8 departures", () => {
    const withOut = days(rep("10:00", 15), "18:02")
    expect(detectShiftPattern(withOut, SHIFT, "00:15")?.medianOut).toBe("18:00")
    const few = days(rep("10:00", 15)).map((d, i) => (i < 7 ? { ...d, lastOut: "18:00" } : d))
    expect(detectShiftPattern(few, SHIFT, "00:15")?.medianOut).toBeNull()
  })

  it("keeps patternSince when the newest day is odd", () => {
    const p = detectShiftPattern(days([...rep("10:00", 19), "08:00"]), SHIFT, "00:15")
    expect(p).not.toBeNull()
    expect(p!.patternSince).toBe(dayKey(0))
  })

  it("finds the run before a trailing odd day", () => {
    const p = detectShiftPattern(days([...rep("08:00", 3), ...rep("10:00", 12), "08:00"]), SHIFT, "00:15")
    expect(p).not.toBeNull()
    expect(p!.daysObserved).toBe(16)
    expect(p!.patternSince).toBe(dayKey(3))
  })

  it("EARLIER passes at exactly 10 days", () => {
    const p = detectShiftPattern(days(rep("08:25", 10)), SHIFT, "00:15")
    expect(p?.direction).toBe("EARLIER")
    expect(p?.daysObserved).toBe(10)
  })

  it("LATER needs exactly 15 days (14 is null)", () => {
    expect(detectShiftPattern(days(rep("10:00", 14)), SHIFT, "00:15")).toBeNull()
    expect(detectShiftPattern(days(rep("10:00", 15)), SHIFT, "00:15")?.daysObserved).toBe(15)
  })

  it("deviation of exactly 20 minutes passes, 15 after rounding fails", () => {
    const p = detectShiftPattern(days(rep("09:20", 20)), SHIFT, "00:15")
    expect(p?.medianIn).toBe("09:20")
    expect(detectShiftPattern(days(rep("09:18", 20)), SHIFT, "00:15")?.medianIn).toBe("09:20")
    expect(detectShiftPattern(days(rep("09:17", 20)), SHIFT, "00:15")).toBeNull()
  })

  it("consistency passes at 14 of 20 and fails at 13 of 20", () => {
    const mk = (low: number, mid: number, high: number) =>
      days([...rep("08:00", low), ...rep("10:00", mid), ...rep("12:00", high)])
    const ok = detectShiftPattern(mk(3, 14, 3), SHIFT, "00:15")
    expect(ok?.daysWithinTolerance).toBe(14)
    expect(ok?.medianIn).toBe("10:00")
    expect(detectShiftPattern(mk(4, 13, 3), SHIFT, "00:15")).toBeNull()
  })

  it("tolerance is inclusive at 15 minutes and exclusive at 16", () => {
    const at15 = detectShiftPattern(days([...rep("10:00", 14), ...rep("10:15", 6)]), SHIFT, "00:15")
    expect(at15?.medianIn).toBe("10:00")
    expect(at15?.daysWithinTolerance).toBe(20)
    const at16 = detectShiftPattern(days([...rep("10:00", 14), ...rep("10:16", 6)]), SHIFT, "00:15")
    expect(at16?.daysWithinTolerance).toBe(14)
  })

  it("lateDays is strictly after start plus allow", () => {
    const onEdge = detectShiftPattern(days(rep("09:30", 20)), SHIFT, "00:30")
    expect(onEdge?.lateDays).toBe(0)
    const past = detectShiftPattern(days(rep("09:30", 20)), SHIFT, "00:29")
    expect(past?.lateDays).toBe(20)
  })

  it("rounds the median of an even count twice (mean to minute, then to 5)", () => {
    const p = detectShiftPattern(days([...rep("10:02", 10), ...rep("10:03", 10)]), SHIFT, "00:15")
    expect(p?.medianIn).toBe("10:05")
  })
})

describe("buildObservedDays", () => {
  const at = (s: string) => new Date(`${s}+05:30`)

  it("skips keys and reads IST times, oldest first", () => {
    const m = new Map<string, Date[]>([
      ["2026-11-03", [at("2026-11-03T09:20:00")]],
      ["2026-11-02", [at("2026-11-02T09:05:00")]],
      ["2026-11-04", [at("2026-11-04T09:00:00")]],
      ["2026-11-05", []],
    ])
    const r = buildObservedDays(m, new Set(["2026-11-04"]))
    expect(r.map((d) => d.dayKey)).toEqual(["2026-11-02", "2026-11-03"])
    expect(r[0].firstIn).toBe("09:05")
    expect(r[0].lastOut).toBeNull()
  })

  it("sets lastOut only with a 3 hour gap", () => {
    const m = new Map<string, Date[]>([
      ["2026-11-02", [at("2026-11-02T11:00:00"), at("2026-11-02T09:00:00")]],
      ["2026-11-03", [at("2026-11-03T09:00:00"), at("2026-11-03T15:00:00")]],
    ])
    const r = buildObservedDays(m, new Set())
    expect(r[0].lastOut).toBeNull()
    expect(r[1].lastOut).toBe("15:00")
  })

  it("lastOut needs exactly 180 minutes (179 is null)", () => {
    const m = new Map<string, Date[]>([
      ["2026-11-02", [at("2026-11-02T09:00:00"), at("2026-11-02T12:00:00")]],
      ["2026-11-03", [at("2026-11-03T09:00:00"), at("2026-11-03T11:59:00")]],
    ])
    const r = buildObservedDays(m, new Set())
    expect(r[0].lastOut).toBe("12:00")
    expect(r[1].lastOut).toBeNull()
  })

  it("reads punches in IST regardless of UTC date", () => {
    const m = new Map<string, Date[]>([["2026-11-02", [new Date("2026-11-01T19:00:00Z")]]])
    expect(buildObservedDays(m, new Set())[0].firstIn).toBe("00:30")
  })
})

describe("proposeShift", () => {
  const cur = { id: "cur", name: "Cur", startTime: "09:00", endTime: "17:00" }
  const late = { id: "late", name: "Late", startTime: "10:00", endTime: "18:00" }
  const pat = (medianOut: string | null) => ({
    medianIn: "10:05",
    medianOut,
    daysObserved: 20,
    daysWithinTolerance: 20,
    lateDays: 20,
    patternSince: "2026-10-01",
    direction: "LATER" as const,
  })

  it("returns an existing shift that matches", () => {
    expect(proposeShift(pat("18:10"), [cur, late], cur)).toEqual({ shiftId: "late", start: "10:00", end: "18:00" })
  })

  it("proposes a new shift when end does not match", () => {
    expect(proposeShift(pat("19:30"), [cur, late], cur)).toEqual({ shiftId: null, start: "10:05", end: "19:30" })
  })

  const pm = (medianIn: string, medianOut: string | null) => ({ ...pat(medianOut), medianIn })
  const sh = (id: string, startTime: string, endTime: string) => ({ id, name: id, startTime, endTime })

  it("start match is inclusive at 15 minutes, not 16", () => {
    expect(proposeShift(pm("10:05", null), [sh("a", "09:50", "17:50")], cur).shiftId).toBe("a")
    expect(proposeShift(pm("10:05", null), [sh("a", "09:49", "17:49")], cur).shiftId).toBeNull()
  })

  it("end match is inclusive at 30 minutes, not 31", () => {
    expect(proposeShift(pm("10:05", "18:00"), [sh("a", "10:05", "18:30")], cur).shiftId).toBe("a")
    expect(proposeShift(pm("10:05", "18:00"), [sh("a", "10:05", "18:31")], cur).shiftId).toBeNull()
  })

  it("a tie on start distance goes to the first shift listed", () => {
    const a = sh("a", "09:50", "17:50")
    const b = sh("b", "10:10", "18:10")
    expect(proposeShift(pm("10:00", null), [a, b], cur).shiftId).toBe("a")
    expect(proposeShift(pm("10:00", null), [b, a], cur).shiftId).toBe("b")
  })

  it("never proposes a time past 23:55", () => {
    expect(proposeShift(pm("23:55", null), [], cur)).toEqual({ shiftId: null, start: "23:55", end: "23:55" })
  })

  it("adds the current shift length, shorter or longer", () => {
    expect(proposeShift(pm("10:05", null), [], sh("s", "09:00", "13:00")).end).toBe("14:05")
    expect(proposeShift(pm("10:05", null), [], sh("l", "08:00", "20:00")).end).toBe("22:05")
  })

  it("uses the current shift length when medianOut is unknown", () => {
    expect(proposeShift(pat(null), [cur], cur)).toEqual({ shiftId: null, start: "10:05", end: "18:05" })
  })
})

describe("roundToFive", () => {
  it("rounds to the nearest five", () => {
    expect(roundToFive("10:02")).toBe("10:00")
    expect(roundToFive("10:03")).toBe("10:05")
    expect(roundToFive("09:58")).toBe("10:00")
  })

  it("never exceeds 23:55", () => {
    expect(roundToFive("23:58")).toBe("23:55")
    expect(roundToFive("23:55")).toBe("23:55")
  })
})
