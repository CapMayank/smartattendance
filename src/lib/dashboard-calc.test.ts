import { describe, expect, test } from "vitest"
import {
  absenceStreak, binArrivals, dutyMinutes, inferPunchTypes, isDeviceOnline,
  isLate, istDayStart, istMinutes, lateMinutes, parseHHMM, turnoutPercent, weekdayDelta,
} from "./dashboard-calc"

describe("dashboard-calc", () => {
  test("binArrivals uses Asia/Kolkata", () => {
    const bins = binArrivals([{ at: new Date("2026-11-06T03:00:00Z"), late: false }]) // 08:30 IST
    expect(bins.find(b => b.label === "08:30")!.onTime).toBe(1)
    expect(bins.map(b => b.label)).toEqual(["07:45","08:00","08:15","08:30","08:45","09:00","09:15","09:30"])
  })
  test("binArrivals clamps early/late arrivals and splits by late flag", () => {
    const bins = binArrivals([
      { at: new Date("2026-11-06T01:00:00Z"), late: false }, // 06:30 IST -> first
      { at: new Date("2026-11-06T05:00:00Z"), late: true },  // 10:30 IST -> last
    ])
    expect(bins[0].onTime).toBe(1)
    expect(bins[7].late).toBe(1)
  })
  test("istDayStart", () => expect(istDayStart(new Date("2026-11-06T04:00:00Z")).toISOString()).toBe("2026-11-05T18:30:00.000Z"))
  test("istMinutes and parseHHMM", () => {
    expect(istMinutes(new Date("2026-11-06T03:00:00Z"))).toBe(510)
    expect(parseHHMM("08:30")).toBe(510)
  })
  test("isLate respects grace", () => {
    expect(isLate(new Date("2026-11-06T03:15:00Z"), "08:30", "00:15")).toBe(false) // 08:45 exactly
    expect(isLate(new Date("2026-11-06T03:16:00Z"), "08:30", "00:15")).toBe(true)
  })
  test("isLate returns false when shiftStart is null", () => expect(isLate(new Date(), null, "00:15")).toBe(false))
  test("lateMinutes from shift start", () => {
    expect(lateMinutes(new Date("2026-11-06T04:08:00Z"), "08:30")).toBe(68)
    expect(lateMinutes(new Date("2026-11-06T04:08:00Z"), null)).toBe(0)
  })
  test("turnoutPercent", () => { expect(turnoutPercent(73, 82)).toBe(89); expect(turnoutPercent(0, 0)).toBeNull() })
  test("isDeviceOnline", () => {
    const now = new Date("2026-11-06T04:15:00Z")
    expect(isDeviceOnline(new Date("2026-11-06T04:11:00Z"), now)).toBe(true)
    expect(isDeviceOnline(new Date("2026-11-06T04:09:59Z"), now)).toBe(false)
  })
  test("absenceStreak counts consecutive missing working days", () =>
    expect(absenceStreak(new Set(["2026-10-31"]), ["2026-11-06","2026-11-05","2026-11-04","2026-11-03","2026-11-02","2026-10-31"])).toBe(5))
  test("weekdayDelta", () => {
    expect(weekdayDelta(73, 67)).toEqual({ text: "+6", direction: "up" })
    expect(weekdayDelta(4, 4).direction).toBe("flat")
    expect(weekdayDelta(4, 4).text).toBe("same")
    expect(weekdayDelta(60, 67)).toEqual({ text: "−7", direction: "down" })
  })
  test("inferPunchTypes", () => {
    expect(inferPunchTypes([{type:"PUNCH",timestamp:new Date(1)},{type:"PUNCH",timestamp:new Date(2)}])).toEqual(["IN","OUT"])
    expect(inferPunchTypes([{type:"PUNCH",timestamp:new Date(1)}])).toEqual(["IN"])
    expect(inferPunchTypes([{type:"IN",timestamp:new Date(1)},{type:"OUT",timestamp:new Date(2)},{type:"PUNCH",timestamp:new Date(3)}])).toEqual(["IN","OUT","IN"])
  })
  test("dutyMinutes subtracts time stepped out", () => {
    const p = (t: string, type: "IN"|"OUT") => ({ at: new Date(`2026-11-06T${t}:00+05:30`), type })
    expect(dutyMinutes([p("07:46","IN"), p("08:51","OUT"), p("09:20","IN")], new Date("2026-11-06T09:45:00+05:30"))).toBe(90)
  })
})
