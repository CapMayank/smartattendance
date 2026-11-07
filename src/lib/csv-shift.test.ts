import { describe, expect, it } from "vitest"
import { resolveCsvShift } from "./csv-shift"

const shiftsByName = new Map([
  ["Morning", "S1"],
  ["Late", "S2"],
])
const base = { shiftsByName, defaultShiftId: "GEN" }

describe("resolveCsvShift", () => {
  it("new teacher, blank cell: default shift", () => {
    expect(resolveCsvShift({ ...base, isNew: true, existingShiftId: null, shiftCell: "" })).toEqual({ action: "set", shiftId: "GEN" })
    expect(resolveCsvShift({ ...base, isNew: true, existingShiftId: null, shiftCell: undefined })).toEqual({ action: "set", shiftId: "GEN" })
  })
  it("new teacher, known cell: that shift", () => {
    expect(resolveCsvShift({ ...base, isNew: true, existingShiftId: null, shiftCell: " Late " })).toEqual({ action: "set", shiftId: "S2" })
  })
  it("new teacher, unknown cell: default shift", () => {
    expect(resolveCsvShift({ ...base, isNew: true, existingShiftId: null, shiftCell: "Night" })).toEqual({ action: "set", shiftId: "GEN" })
  })
  it("existing teacher, blank or missing cell: keep", () => {
    expect(resolveCsvShift({ ...base, isNew: false, existingShiftId: "S1", shiftCell: "  " })).toEqual({ action: "keep" })
    expect(resolveCsvShift({ ...base, isNew: false, existingShiftId: "S1", shiftCell: undefined })).toEqual({ action: "keep" })
  })
  it("existing teacher, unknown cell: keep", () => {
    expect(resolveCsvShift({ ...base, isNew: false, existingShiftId: "S1", shiftCell: "Night" })).toEqual({ action: "keep" })
  })
  it("existing teacher, known cell naming the same shift: keep", () => {
    expect(resolveCsvShift({ ...base, isNew: false, existingShiftId: "S1", shiftCell: "Morning" })).toEqual({ action: "keep" })
  })
  it("existing teacher, known cell naming a different shift: set it", () => {
    expect(resolveCsvShift({ ...base, isNew: false, existingShiftId: "S1", shiftCell: "Late" })).toEqual({ action: "set", shiftId: "S2" })
  })
})
