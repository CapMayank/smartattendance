import { beforeAll, describe, expect, it } from "vitest"
import { istDateKey } from "./dashboard-calc"
import { ensureSchoolTimezone } from "./timezone"
import {
  ALWAYS,
  currentShiftId,
  shiftOn,
  shiftStartForDay,
  type AssignmentLite,
  type ShiftLite,
} from "./shift-lookup"

beforeAll(() => {
  ensureSchoolTimezone()
})

const A: ShiftLite = { id: "A", name: "Morning", startTime: "08:00", endTime: "14:00" }
const B: ShiftLite = { id: "B", name: "Mid", startTime: "09:30", endTime: "15:30" }
const C: ShiftLite = { id: "C", name: "Late", startTime: "10:00", endTime: "16:00" }
const shifts = new Map<string, ShiftLite>([
  [A.id, A],
  [B.id, B],
  [C.id, C],
])

describe("shiftOn", () => {
  const assignments: AssignmentLite[] = [
    { effectiveFrom: ALWAYS, shiftId: "A" },
    { effectiveFrom: "2026-11-10", shiftId: "B" },
  ]

  it("resolves the earlier shift before, the new one on and after the change", () => {
    expect(shiftOn(assignments, "B", shifts, "2026-11-09")).toEqual(A)
    expect(shiftOn(assignments, "B", shifts, "2026-11-10")).toEqual(B)
    expect(shiftOn(assignments, "B", shifts, "2026-11-11")).toEqual(B)
  })

  it("resolves two changes in a row to the latest on or before the day", () => {
    const list: AssignmentLite[] = [
      { effectiveFrom: "2026-11-20", shiftId: "C" },
      ...assignments,
    ]
    expect(shiftOn(list, "C", shifts, "2026-11-15")).toEqual(B)
    expect(shiftOn(list, "C", shifts, "2026-11-20")).toEqual(C)
    expect(shiftOn(list, "C", shifts, "2026-12-01")).toEqual(C)
  })

  it("falls back to the staff shift when there are no assignments", () => {
    expect(shiftOn([], "A", shifts, "2026-11-10")).toEqual(A)
    expect(shiftOn([], null, shifts, "2026-11-10")).toBeNull()
  })

  it("falls back when every assignment starts after the day", () => {
    expect(shiftOn([{ effectiveFrom: "2026-12-01", shiftId: "B" }], "A", shifts, "2026-11-10")).toEqual(A)
  })

  it("returns null for an effective assignment with no shift", () => {
    expect(shiftOn([{ effectiveFrom: "2026-11-01", shiftId: null }], "A", shifts, "2026-11-10")).toBeNull()
  })

  it("returns null when the assigned shift is missing from the map", () => {
    expect(shiftOn([{ effectiveFrom: "2026-11-01", shiftId: "ZZ" }], "A", shifts, "2026-11-10")).toBeNull()
  })

  it("switches at India midnight", () => {
    const list: AssignmentLite[] = [
      { effectiveFrom: ALWAYS, shiftId: "A" },
      { effectiveFrom: "2026-11-04", shiftId: "B" },
    ]
    const before = istDateKey(new Date("2026-11-03T18:25:00Z"))
    const after = istDateKey(new Date("2026-11-03T18:35:00Z"))
    expect(before).toBe("2026-11-03")
    expect(after).toBe("2026-11-04")
    expect(shiftOn(list, "B", shifts, before)).toEqual(A)
    expect(shiftOn(list, "B", shifts, after)).toEqual(B)
  })
})

describe("shiftStartForDay", () => {
  const list: AssignmentLite[] = [
    { effectiveFrom: ALWAYS, shiftId: "A" },
    { effectiveFrom: "2026-11-10", shiftId: "B" },
    { effectiveFrom: "2026-11-20", shiftId: null },
  ]
  it("returns the resolved start time or null", () => {
    expect(shiftStartForDay(list, null, shifts, "2026-11-09")).toBe("08:00")
    expect(shiftStartForDay(list, null, shifts, "2026-11-10")).toBe("09:30")
    expect(shiftStartForDay(list, null, shifts, "2026-11-20")).toBeNull()
  })
})

describe("currentShiftId", () => {
  const list: AssignmentLite[] = [
    { effectiveFrom: ALWAYS, shiftId: "A" },
    { effectiveFrom: "2026-11-10", shiftId: "B" },
  ]
  it("returns the id applying on today", () => {
    expect(currentShiftId(list, "B", "2026-11-09")).toBe("A")
    expect(currentShiftId(list, "A", "2026-11-10")).toBe("B")
  })
  it("uses the fallback when none is effective, and null for a no-shift assignment", () => {
    expect(currentShiftId([], "C", "2026-11-10")).toBe("C")
    expect(currentShiftId([{ effectiveFrom: "2026-12-01", shiftId: "B" }], "C", "2026-11-10")).toBe("C")
    expect(currentShiftId([{ effectiveFrom: "2026-11-01", shiftId: null }], "C", "2026-11-10")).toBeNull()
  })
})
