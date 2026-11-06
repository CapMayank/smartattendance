import { beforeAll, describe, expect, it } from "vitest"
import { ensureSchoolTimezone } from "@/lib/timezone"
import { evaluateDay, type DayLog, type DayPolicy } from "@/lib/attendance-day"

beforeAll(() => {
  ensureSchoolTimezone()
})

const SHIFT = { startTime: "09:00" }
const POLICY: DayPolicy = {
  lateArrivalAllow: "00:15",
  halfDayIfWorkHrsLessThan: "06:00",
  absentIfWorkHrsLessThan: "00:00",
  allInOut: "First IN Last OUT",
}
const MON = "2026-11-02"
const date = new Date(`${MON}T00:00:00+05:30`)
const at = (hm: string) => new Date(`${MON}T${hm}:00+05:30`)

function punches(times: string[], types?: string[]): DayLog[] {
  return times.map((t, i) => ({ timestamp: at(t), type: types?.[i] ?? (i % 2 === 0 ? "IN" : "OUT") }))
}

function run(over: Partial<Parameters<typeof evaluateDay>[0]> = {}) {
  return evaluateDay({
    date,
    logs: [],
    shift: SHIFT,
    policy: POLICY,
    isHoliday: false,
    isWeekOff: false,
    ...over,
  })
}

describe("evaluateDay", () => {
  const cases: [string, string[], string, number, number][] = [
    ["on time", ["08:55", "15:10"], "PRESENT", 0, 375],
    ["inside grace", ["09:10", "15:30"], "PRESENT", 0, 380],
    ["late beyond grace", ["09:20", "15:30"], "PRESENT", 20, 370],
    ["half day", ["09:00", "12:00"], "HALF_DAY", 0, 180],
    ["single punch", ["09:00"], "HALF_DAY", 0, 0],
    ["exactly 360 minutes is not half day", ["09:00", "15:00"], "PRESENT", 0, 360],
    ["arrival exactly at grace limit 09:15", ["09:15", "15:30"], "PRESENT", 0, 375],
    ["arrival one minute past grace 09:16", ["09:16", "15:30"], "PRESENT", 16, 374],
  ]
  it.each(cases)("%s", (_n, times, status, lateMinutes, workMinutes) => {
    expect(run({ logs: punches(times) })).toEqual({
      status,
      checkIn: at(times[0]),
      checkOut: at(times[times.length - 1]),
      lateMinutes,
      workMinutes,
      overtimeMinutes: 0,
    })
  })

  it("absent", () => {
    expect(run()).toEqual({
      status: "ABSENT",
      checkIn: null,
      checkOut: null,
      lateMinutes: 0,
      workMinutes: 0,
      overtimeMinutes: 0,
    })
  })

  it("holiday, no punches", () => {
    expect(run({ isHoliday: true })).toEqual({
      status: "HOLIDAY",
      checkIn: null,
      checkOut: null,
      lateMinutes: 0,
      workMinutes: 0,
      overtimeMinutes: 0,
    })
  })

  it("holiday with punches", () => {
    expect(run({ isHoliday: true, logs: punches(["09:00", "11:00"]) })).toEqual({
      status: "PRESENT",
      checkIn: at("09:00"),
      checkOut: at("11:00"),
      lateMinutes: 0,
      workMinutes: 120,
      overtimeMinutes: 0,
    })
  })

  it("week off, no punches", () => {
    expect(run({ isWeekOff: true })).toEqual({
      status: "WEEKOFF",
      checkIn: null,
      checkOut: null,
      lateMinutes: 0,
      workMinutes: 0,
      overtimeMinutes: 0,
    })
  })

  it("no shift is never late", () => {
    expect(run({ shift: null, logs: punches(["10:00", "16:00"]) })).toEqual({
      status: "PRESENT",
      checkIn: at("10:00"),
      checkOut: at("16:00"),
      lateMinutes: 0,
      workMinutes: 360,
      overtimeMinutes: 0,
    })
  })

  it("every-IN-OUT policy", () => {
    expect(
      run({
        policy: { ...POLICY, allInOut: "Every IN OUT" },
        logs: punches(["09:00", "12:00", "13:00", "15:00"], ["IN", "OUT", "IN", "OUT"]),
      }),
    ).toEqual({
      status: "HALF_DAY",
      checkIn: at("09:00"),
      checkOut: at("15:00"),
      lateMinutes: 0,
      workMinutes: 300,
      overtimeMinutes: 0,
    })
  })

  it("every-IN-OUT policy infers types by index when no punch is OUT", () => {
    // three punches all typed IN: inferred IN, OUT, OUT; only 09:00-12:00 pairs
    expect(
      run({
        policy: { ...POLICY, allInOut: "Every IN OUT" },
        logs: punches(["09:00", "12:00", "15:00"], ["IN", "IN", "IN"]),
      }),
    ).toEqual({
      status: "HALF_DAY",
      checkIn: at("09:00"),
      checkOut: at("15:00"),
      lateMinutes: 0,
      workMinutes: 180,
      overtimeMinutes: 0,
    })
  })

  it("every-IN-OUT policy ignores an OUT before any IN for pairing", () => {
    // checkIn is still the first punch (the orphan OUT)
    expect(
      run({
        policy: { ...POLICY, allInOut: "Every IN OUT" },
        logs: punches(["08:00", "09:00", "15:00"], ["OUT", "IN", "OUT"]),
      }),
    ).toEqual({
      status: "PRESENT",
      checkIn: at("08:00"),
      checkOut: at("15:00"),
      lateMinutes: 0,
      workMinutes: 360,
      overtimeMinutes: 0,
    })
  })

  it("absent threshold: 90 minutes under absentIfWorkHrsLessThan 02:00 on a working day is ABSENT", () => {
    expect(
      run({
        policy: { ...POLICY, absentIfWorkHrsLessThan: "02:00" },
        logs: punches(["09:00", "10:30"]),
      }),
    ).toEqual({
      status: "ABSENT",
      checkIn: at("09:00"),
      checkOut: at("10:30"),
      lateMinutes: 0,
      workMinutes: 90,
      overtimeMinutes: 0,
    })
  })

  it("week off with a 120-minute punch pair stays PRESENT (no half-day downgrade)", () => {
    expect(run({ isWeekOff: true, logs: punches(["09:00", "11:00"]) })).toEqual({
      status: "PRESENT",
      checkIn: at("09:00"),
      checkOut: at("11:00"),
      lateMinutes: 0,
      workMinutes: 120,
      overtimeMinutes: 0,
    })
  })
})
