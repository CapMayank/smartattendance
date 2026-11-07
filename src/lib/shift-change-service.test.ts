import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { ensureSchoolTimezone } from "@/lib/timezone"
import { createFakePrisma, type Fixtures } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))

import { ALWAYS } from "@/lib/shift-lookup"
import { applyShiftChange, previewShiftChange, syncCurrentShifts } from "@/lib/shift-change-service"
import type { ChangeRequest } from "@/lib/shift-change"

beforeAll(() => {
  ensureSchoolTimezone()
})

const NOW = new Date("2026-11-06T12:00:00+05:30") // Friday
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

const DAY = { id: "s1", name: "Day", startTime: "09:00", endTime: "15:00" }
const LATE = { id: "s2", name: "Late", startTime: "10:00", endTime: "16:00" }
const POLICY = {
  lateArrivalAllow: "00:15",
  halfDayIfWorkHrsLessThan: "06:00",
  absentIfWorkHrsLessThan: "00:00",
  allInOut: "First IN Last OUT",
  weekOffDays: "0",
}
const at = (day: string, hm: string) => new Date(`${day}T${hm}:00+05:30`)
const dayStart = (day: string) => new Date(`${day}T00:00:00+05:30`)

function punches(staffId: string, day: string, times: string[]) {
  return times.map((t, i) => ({
    id: `${staffId}-${day}-${i}`,
    staffId,
    timestamp: at(day, t),
    type: i % 2 === 0 ? "IN" : "OUT",
  }))
}

// Mon 2 .. Fri 6 Nov 2026: teacher A arrives at 09:55 every day (late on Day, on time on Late)
const WEEK = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]

function fake(fx: Partial<Fixtures> = {}) {
  const f = createFakePrisma({
    staff: [{ id: "A", name: "A", shiftId: "s1", shift: DAY }],
    shifts: [DAY, LATE],
    policy: POLICY,
    holidays: [],
    lockedPayrolls: [],
    logs: WEEK.flatMap((d) => punches("A", d, ["09:55", "16:05"])),
    dailyRecords: WEEK.map((d) => ({ staffId: "A", date: dayStart(d), status: "PRESENT", lateMinutes: 55 })),
    ...fx,
  })
  holder.client = f.client
  return f
}

const req = (over: Partial<ChangeRequest> = {}): ChangeRequest => ({
  staffId: "A",
  shiftId: "s2",
  effectiveFrom: "2026-11-02",
  source: "MANUAL",
  ...over,
})

describe("previewShiftChange", () => {
  it("writes nothing and reports the late days that become on time", async () => {
    const f = fake()
    const summary = await previewShiftChange(req(), NOW)
    expect(summary).toEqual({
      recalculatedDays: 5,
      changedDays: 5,
      transitions: { "LATE->ON_TIME": 5 },
      lockedSkippedDays: 0,
    })
    expect(f.created).toEqual([])
    expect(f.deleteCalls).toEqual([])
    expect(f.staffUpdates).toEqual([])
    expect(f.assignments).toEqual([])
  })

  it("a future start date needs no recalculation", async () => {
    fake()
    const summary = await previewShiftChange(req({ effectiveFrom: "2026-11-10" }), NOW)
    expect(summary).toEqual({ recalculatedDays: 0, changedDays: 0, transitions: {}, lockedSkippedDays: 0 })
  })

  it("rejects an empty staffId", async () => {
    fake()
    await expect(previewShiftChange(req({ staffId: "" }), NOW)).rejects.toThrow(/staffId is required/)
  })
})

describe("applyShiftChange", () => {
  it("matches the preview: same days recalculated and created, INITIAL + new assignment, Staff.shiftId refreshed", async () => {
    fake()
    const preview = await previewShiftChange(req(), NOW)
    const f = fake()
    const res = await applyShiftChange(req({ createdByUserId: "u1" }), NOW)
    expect(res).toEqual({ assignmentSaved: true, recalculated: true, summary: preview })
    expect(f.created).toHaveLength(preview.recalculatedDays)
    expect(f.created.every((r) => r.staffId === "A" && r.lateMinutes === 0)).toBe(true)
    expect(f.assignments).toEqual([
      expect.objectContaining({ staffId: "A", effectiveFrom: ALWAYS, shiftId: "s1", source: "INITIAL" }),
      expect.objectContaining({ staffId: "A", effectiveFrom: "2026-11-02", shiftId: "s2", source: "MANUAL", createdByUserId: "u1" }),
    ])
    expect(f.staffUpdates).toEqual([{ where: { id: "A" }, data: { shiftId: "s2" } }])
  })

  it("replaces an assignment with the same start date and adds no INITIAL when history exists", async () => {
    const f = fake({
      assignments: [
        { staffId: "A", effectiveFrom: ALWAYS, shiftId: "s1" },
        { staffId: "A", effectiveFrom: "2026-11-02", shiftId: "s1" },
      ],
    })
    await applyShiftChange(req(), NOW)
    expect(f.assignments).toHaveLength(2)
    expect(f.assignments[1]).toMatchObject({ effectiveFrom: "2026-11-02", shiftId: "s2" })
  })

  it("a locked staff-month: reports lockedSkippedDays and creates no record for those days", async () => {
    const f = fake({
      staff: [{ id: "A", name: "A", shiftId: "s1", shift: DAY, createdAt: new Date("2026-10-01T10:00:00+05:30") }],
      lockedPayrolls: [{ staffId: "A", month: 11, year: 2026 }],
    })
    const res = await applyShiftChange(req({ effectiveFrom: "2026-10-29" }), NOW)
    expect(res.summary.lockedSkippedDays).toBe(6) // 1..6 Nov
    expect(res.summary.recalculatedDays).toBe(3) // 29..31 Oct
    expect(f.created).toHaveLength(3)
    expect(f.created.some((r) => (r.date as Date).getMonth() === 10)).toBe(false)
  })

  it("a failing recalculation keeps the assignment and returns recalculated: false", async () => {
    const f = fake()
    const client = f.client as { $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> }
    const original = client.$transaction
    let calls = 0
    client.$transaction = async (fn) => {
      calls++
      if (calls === 2) throw new Error("db down")
      return original(fn)
    }
    const res = await applyShiftChange(req(), NOW)
    expect(res.assignmentSaved).toBe(true)
    expect(res.recalculated).toBe(false)
    expect(res.error).toContain("db down")
    expect(f.assignments.map((a) => a.shiftId)).toEqual(["s1", "s2"])
    expect(f.created).toEqual([])
  })

  it("a future start saves the assignment without touching Staff.shiftId or daily records", async () => {
    const f = fake()
    const res = await applyShiftChange(req({ effectiveFrom: "2026-11-10" }), NOW)
    expect(res.summary.recalculatedDays).toBe(0)
    expect(f.staffUpdates).toEqual([])
    expect(f.created).toEqual([])
    expect(f.assignments.map((a) => a.effectiveFrom)).toEqual([ALWAYS, "2026-11-10"])
  })

  it("rejects an empty staffId before writing or recalculating", async () => {
    const f = fake()
    await expect(applyShiftChange(req({ staffId: "" }), NOW)).rejects.toThrow(/staffId is required/)
    expect(f.assignments).toEqual([])
    expect(f.deleteCalls).toEqual([])
  })
})

describe("start dates at the ALWAYS boundary", () => {
  it("first change dated ALWAYS: the preview's changes equal what apply writes", async () => {
    fake()
    const preview = await previewShiftChange(req({ effectiveFrom: ALWAYS }), NOW)
    expect(preview.transitions["LATE->ON_TIME"]).toBe(5)
    const f = fake()
    const res = await applyShiftChange(req({ effectiveFrom: ALWAYS }), NOW)
    expect(res.summary).toEqual(preview)
    expect(f.created).toHaveLength(preview.recalculatedDays)
    const week = f.created.filter((r) => WEEK.some((d) => (r.date as Date).getTime() === dayStart(d).getTime()))
    expect(week.map((r) => r.lateMinutes)).toEqual([0, 0, 0, 0, 0])
    expect(f.assignments).toEqual([expect.objectContaining({ effectiveFrom: ALWAYS, shiftId: "s2", source: "MANUAL" })])
  })

  it("rejects a start date before ALWAYS", async () => {
    const f = fake()
    await expect(previewShiftChange(req({ effectiveFrom: "1999-12-31" }), NOW)).rejects.toThrow(
      "Start date must be on or after 2000-01-01",
    )
    await expect(applyShiftChange(req({ effectiveFrom: "1999-12-31" }), NOW)).rejects.toThrow(
      "Start date must be on or after 2000-01-01",
    )
    expect(f.assignments).toEqual([])
    expect(f.staffUpdates).toEqual([])
  })
})

describe("Staff.shiftId after a back-dated change", () => {
  it("a change dated before another effective assignment keeps Staff.shiftId on today's shift", async () => {
    const LATER = { id: "s3", name: "Later", startTime: "11:00", endTime: "17:00" }
    const f = fake({
      staff: [{ id: "A", name: "A", shiftId: "s3", shift: LATER }],
      shifts: [DAY, LATE, LATER],
      assignments: [
        { staffId: "A", effectiveFrom: ALWAYS, shiftId: "s1" },
        { staffId: "A", effectiveFrom: "2026-11-04", shiftId: "s3" },
      ],
    })
    const res = await applyShiftChange(req({ effectiveFrom: "2026-11-01", shiftId: "s2" }), NOW)
    expect(res.recalculated).toBe(true)
    // The transaction writes today's shift (s3); the later sync then has nothing to fix
    expect(f.staffUpdates).toEqual([{ where: { id: "A" }, data: { shiftId: "s3" } }])
  })
})

describe("syncCurrentShifts", () => {
  it("flips Staff.shiftId when a future-dated assignment has arrived", async () => {
    const f = fake({
      assignments: [
        { staffId: "A", effectiveFrom: ALWAYS, shiftId: "s1" },
        { staffId: "A", effectiveFrom: "2026-11-06", shiftId: "s2" },
      ],
    })
    await syncCurrentShifts(NOW)
    expect(f.staffUpdates).toEqual([{ where: { id: "A" }, data: { shiftId: "s2" } }])
  })

  it("does nothing when Staff.shiftId already matches or no assignments exist", async () => {
    const f = fake({ assignments: [{ staffId: "A", effectiveFrom: "2026-11-10", shiftId: "s2" }] })
    await syncCurrentShifts(NOW)
    expect(f.staffUpdates).toEqual([])
    const g = fake()
    await syncCurrentShifts(NOW)
    expect(g.staffUpdates).toEqual([])
  })
})

describe("pending suggestions after a manual change", () => {
  const rows = () => [
    { id: "p1", staffId: "A", status: "PENDING" },
    { id: "d1", staffId: "A", status: "DISMISSED" },
    { id: "p2", staffId: "B", status: "PENDING" },
  ]

  it("a manual change deletes that teacher's PENDING suggestion only", async () => {
    const f = fake({ suggestions: rows() })
    await applyShiftChange(req(), NOW)
    expect(f.suggestions.map((r) => r.id)).toEqual(["d1", "p2"])
  })

  it("a SUGGESTION-sourced change leaves pending rows alone", async () => {
    const f = fake({ suggestions: rows() })
    await applyShiftChange(req({ source: "SUGGESTION" }), NOW)
    expect(f.suggestions.map((r) => r.id)).toEqual(["p1", "d1", "p2"])
  })

  it("a failure to clear suggestions is logged and does not fail the change", async () => {
    const f = fake({ suggestions: rows() })
    const client = f.client as { shiftSuggestion: { deleteMany: () => Promise<unknown> } }
    client.shiftSuggestion.deleteMany = async () => {
      throw new Error("boom")
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await applyShiftChange(req(), NOW)
    expect(res.recalculated).toBe(true)
    expect(spy.mock.calls[0][0]).toContain("[shift-change] could not clear pending suggestions:")
    spy.mockRestore()
  })
})

describe("recalculation starts no earlier than the teacher's start", () => {
  const createdAt = new Date("2026-10-30T10:00:00+05:30")

  it("a 2000-01-01 start recalculates from the teacher's start, not ~9,800 days", async () => {
    fake({ staff: [{ id: "A", name: "A", shiftId: "s1", shift: DAY, createdAt }] })
    const preview = await previewShiftChange(req({ effectiveFrom: ALWAYS }), NOW)
    expect(preview.recalculatedDays).toBe(8) // 30 Oct .. 6 Nov
    const f = fake({ staff: [{ id: "A", name: "A", shiftId: "s1", shift: DAY, createdAt }] })
    const res = await applyShiftChange(req({ effectiveFrom: ALWAYS }), NOW)
    expect(res.summary).toEqual(preview)
    expect(f.created).toHaveLength(8)
    expect(f.assignments).toEqual([expect.objectContaining({ effectiveFrom: ALWAYS, shiftId: "s2" })])
  })

  it("uses the first punch when it is earlier than createdAt", async () => {
    fake({
      staff: [{ id: "A", name: "A", shiftId: "s1", shift: DAY, createdAt: new Date("2026-11-05T10:00:00+05:30") }],
    })
    const preview = await previewShiftChange(req({ effectiveFrom: ALWAYS }), NOW)
    expect(preview.recalculatedDays).toBe(5) // first punch 2 Nov
  })

  it("a start date after the teacher's start is unchanged", async () => {
    fake({ staff: [{ id: "A", name: "A", shiftId: "s1", shift: DAY, createdAt }] })
    const preview = await previewShiftChange(req({ effectiveFrom: "2026-11-04" }), NOW)
    expect(preview.recalculatedDays).toBe(3)
  })
})
