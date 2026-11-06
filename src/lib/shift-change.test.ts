import { describe, it, expect } from "vitest"
import { ALWAYS } from "./shift-lookup"
import { planShiftChange, summarizeChange, type ChangeRequest } from "./shift-change"

const TODAY = "2026-11-06"
const req = (over: Partial<ChangeRequest> = {}): ChangeRequest => ({
  staffId: "t1",
  shiftId: "s2",
  effectiveFrom: TODAY,
  source: "MANUAL",
  ...over,
})

describe("planShiftChange", () => {
  it("creates the initial row from the current shift when none exist", () => {
    const ops = planShiftChange([], "s1", req(), TODAY)
    expect(ops.createInitial).toEqual({ effectiveFrom: ALWAYS, shiftId: "s1" })
  })

  it("creates the initial row even when the current shift is null", () => {
    const ops = planShiftChange([], null, req(), TODAY)
    expect(ops.createInitial).toEqual({ effectiveFrom: ALWAYS, shiftId: null })
  })

  it("skips the initial row when rows exist", () => {
    const ops = planShiftChange([{ effectiveFrom: ALWAYS, shiftId: "s1" }], "s1", req(), TODAY)
    expect(ops.createInitial).toBeNull()
  })

  it("upserts on an existing effectiveFrom", () => {
    const existing = [{ effectiveFrom: TODAY, shiftId: "s1" }]
    const ops = planShiftChange(existing, "s1", req({ source: "SUGGESTION" }), TODAY)
    expect(ops.upsert).toEqual({ effectiveFrom: TODAY, shiftId: "s2", source: "SUGGESTION" })
    expect(existing).toEqual([{ effectiveFrom: TODAY, shiftId: "s1" }])
  })

  it("future-dated change leaves Staff.shiftId and skips recalculation", () => {
    const ops = planShiftChange([], "s1", req({ effectiveFrom: "2026-11-10" }), TODAY)
    expect(ops.staffShiftId).toBeUndefined()
    expect(ops.recalcFrom).toBeNull()
  })

  it("change dated today applies now and recalculates from today", () => {
    const ops = planShiftChange([], "s1", req(), TODAY)
    expect(ops.staffShiftId).toBe("s2")
    expect(ops.recalcFrom).toBe(TODAY)
  })

  it("past-dated change recalculates from its date", () => {
    const ops = planShiftChange([], "s1", req({ effectiveFrom: "2026-11-01" }), TODAY)
    expect(ops.staffShiftId).toBe("s2")
    expect(ops.recalcFrom).toBe("2026-11-01")
  })

  it("allows no shift", () => {
    const ops = planShiftChange([], "s1", req({ shiftId: null }), TODAY)
    expect(ops.upsert.shiftId).toBeNull()
    expect(ops.staffShiftId).toBeNull()
  })
})

describe("summarizeChange", () => {
  it("returns zeros for empty inputs", () => {
    expect(summarizeChange([], [], 0)).toEqual({
      recalculatedDays: 0,
      changedDays: 0,
      transitions: {},
      lockedSkippedDays: 0,
    })
  })

  it("counts label transitions", () => {
    const s = summarizeChange(
      [{ dayKey: "2026-11-02", status: "PRESENT", lateMinutes: 25 }],
      [{ dayKey: "2026-11-02", status: "PRESENT", lateMinutes: 0 }],
      2
    )
    expect(s.recalculatedDays).toBe(1)
    expect(s.changedDays).toBe(1)
    expect(s.transitions).toEqual({ "LATE->ON_TIME": 1 })
    expect(s.lockedSkippedDays).toBe(2)
  })

  it("counts lateMinutes-only changes without a transition", () => {
    const s = summarizeChange(
      [{ dayKey: "d", status: "PRESENT", lateMinutes: 10 }],
      [{ dayKey: "d", status: "PRESENT", lateMinutes: 20 }],
      0
    )
    expect(s.changedDays).toBe(1)
    expect(s.transitions).toEqual({})
  })

  it("uses the status as label and ignores unchanged days", () => {
    const s = summarizeChange(
      [
        { dayKey: "a", status: "ABSENT", lateMinutes: 0 },
        { dayKey: "b", status: "PRESENT", lateMinutes: 0 },
      ],
      [
        { dayKey: "a", status: "PRESENT", lateMinutes: 5 },
        { dayKey: "b", status: "PRESENT", lateMinutes: 0 },
      ],
      0
    )
    expect(s.changedDays).toBe(1)
    expect(s.transitions).toEqual({ "ABSENT->LATE": 1 })
  })

  it("treats a computed day with no stored counterpart as from NONE", () => {
    const s = summarizeChange([], [{ dayKey: "a", status: "ABSENT", lateMinutes: 0 }], 0)
    expect(s.changedDays).toBe(1)
    expect(s.transitions).toEqual({ "NONE->ABSENT": 1 })
  })
})
