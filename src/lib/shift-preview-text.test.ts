import { describe, it, expect } from "vitest"
import { previewHeadline, transitionLabel, transitionRows } from "./shift-preview-text"

describe("shift preview text", () => {
  it("renders transition keys as words", () => {
    expect(transitionLabel("LATE->ON_TIME")).toBe("late → on time")
    expect(transitionLabel("HALF_DAY->PRESENT")).toBe("half day → present")
    expect(transitionLabel("NONE->WEEKOFF")).toBe("no record → week off")
  })
  it("drops unchanged and empty transitions and sorts by count", () => {
    expect(
      transitionRows({ "LATE->ON_TIME": 9, "HALF_DAY->PRESENT": 1, "ON_TIME->ON_TIME": 4, "LATE->LATE": 0 }),
    ).toEqual([
      { label: "late → on time", count: 9 },
      { label: "half day → present", count: 1 },
    ])
  })
  it("builds the headline", () => {
    expect(previewHeadline({ recalculatedDays: 14, changedDays: 10, transitions: {}, lockedSkippedDays: 0 })).toBe(
      "14 days recalculated · 10 change",
    )
    expect(previewHeadline({ recalculatedDays: 1, changedDays: 0, transitions: {}, lockedSkippedDays: 0 })).toBe(
      "1 day recalculated · 0 change",
    )
  })
})
