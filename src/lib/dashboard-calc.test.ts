import { describe, expect, test } from "vitest"
import {
  absenceStreak, arrivalsWindow, binArrivals, dutyMinutes, hasMissingOut, inferPunchTypes, isDeviceOnline,
  normalizeAllow,
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
  test("normalizeAllow falls back to the 00:15 policy default", () => {
    expect(normalizeAllow("00:30")).toBe("00:30")
    expect(normalizeAllow("0:05")).toBe("0:05")
    expect(normalizeAllow("abc")).toBe("00:15")
    expect(normalizeAllow("")).toBe("00:15")
    expect(normalizeAllow(undefined)).toBe("00:15")
    expect(normalizeAllow(null)).toBe("00:15")
  })
  test("isLate survives a malformed or missing allowance", () => {
    const at = new Date("2026-11-06T03:10:00Z") // 08:40 IST, shift 08:30
    expect(isLate(at, "08:30", "abc")).toBe(false) // default 00:15 -> limit 08:45
    expect(isLate(new Date("2026-11-06T03:20:00Z"), "08:30", "abc")).toBe(true) // 08:50
    expect(isLate(at, "08:30", undefined as unknown as string)).toBe(false)
  })
  test("binArrivals falls back to a 15 minute slot when slot is not positive", () => {
    for (const slot of [0, -5, NaN]) {
      expect(binArrivals([], "07:45", "09:45", slot)).toHaveLength(8)
    }
  })
  test("binArrivals puts exactly 09:45 in the last bin and handles empty input", () => {
    const bins = binArrivals([{ at: new Date("2026-11-06T04:15:00Z"), late: true }]) // 09:45 IST
    expect(bins[7].late).toBe(1)
    expect(binArrivals([]).every(b => b.onTime === 0 && b.late === 0)).toBe(true)
  })
  test("absenceStreak with no working days is 0", () => expect(absenceStreak(new Set(), [])).toBe(0))
  test("dutyMinutes: latest IN wins (IN, IN, OUT)", () => {
    const p = (hm: string, type: "IN" | "OUT") => ({ at: new Date(`2026-11-06T${hm}:00+05:30`), type })
    expect(dutyMinutes([p("08:00","IN"), p("09:00","IN"), p("09:30","OUT")], new Date("2026-11-06T12:00:00+05:30"))).toBe(30)
  })
  test("dutyMinutes: leading OUT ignored, IN OUT IN OUT sums", () => {
    const p = (hm: string, type: "IN" | "OUT") => ({ at: new Date(`2026-11-06T${hm}:00+05:30`), type })
    const now = new Date("2026-11-06T12:00:00+05:30")
    expect(dutyMinutes([p("07:00","OUT"), p("08:00","IN"), p("09:00","OUT")], now)).toBe(60)
    expect(dutyMinutes([p("08:00","IN"), p("09:00","OUT"), p("10:00","IN"), p("10:30","OUT")], now)).toBe(90)
  })
  test("dutyMinutes floors each pair", () => {
    const t = (iso: string) => new Date(iso)
    const punches = [
      { at: t("2026-11-06T08:00:00+05:30"), type: "IN" as const }, { at: t("2026-11-06T08:30:30+05:30"), type: "OUT" as const },
      { at: t("2026-11-06T09:00:00+05:30"), type: "IN" as const }, { at: t("2026-11-06T09:30:30+05:30"), type: "OUT" as const },
    ]
    expect(dutyMinutes(punches, new Date("2026-11-06T12:00:00+05:30"))).toBe(60)
  })
  test("arrivalsWindow clamps to the day without wrapping", () => {
    expect(arrivalsWindow("08:30")).toEqual({ from: 465, to: 585 })
    expect(arrivalsWindow("00:10")).toEqual({ from: 0, to: 85 })
    expect(arrivalsWindow("23:50")).toEqual({ from: 1385, to: 1439 })
    expect(arrivalsWindow(null)).toEqual({ from: 465, to: 585 })
  })
  test("hasMissingOut", () => {
    const l = (type: string, m: number) => ({ type, timestamp: new Date(Date.UTC(2026, 10, 5, 3, m)) })
    expect(hasMissingOut([l("PUNCH", 0)])).toBe(true)
    expect(hasMissingOut([l("IN", 0), l("OUT", 5)])).toBe(false)
    expect(hasMissingOut([l("IN", 0), l("OUT", 5), l("IN", 9)])).toBe(true)
    expect(hasMissingOut([l("PUNCH", 0), l("PUNCH", 5)])).toBe(false)
    expect(hasMissingOut([])).toBe(false)
  })
})
