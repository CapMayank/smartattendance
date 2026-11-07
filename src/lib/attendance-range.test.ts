import { beforeAll, describe, expect, it, vi } from "vitest"
import { startOfDay } from "date-fns"
import { ensureSchoolTimezone } from "@/lib/timezone"
import { createFakePrisma, type Fixtures } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))

import { ALWAYS } from "@/lib/shift-lookup"
import { computeRangeRecords, recalculateRange, type RangeInputs } from "@/lib/attendance-range"

beforeAll(() => {
  ensureSchoolTimezone()
})

const SHIFT = { id: "s1", name: "Day", startTime: "09:00", endTime: "15:00" }
const staffA = { id: "A", name: "A", shiftId: "s1", shift: SHIFT }
const staffB = { id: "B", name: "B", shiftId: null, shift: null }
const POLICY = {
  lateArrivalAllow: "00:15",
  halfDayIfWorkHrsLessThan: "06:00",
  absentIfWorkHrsLessThan: "00:00",
  allInOut: "First IN Last OUT",
  weekOffDays: "0",
}
const MON = "2026-11-02"
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

function fake(fx: Partial<Fixtures>) {
  const f = createFakePrisma({
    staff: [staffA, staffB],
    policy: POLICY,
    holidays: [],
    lockedPayrolls: [],
    logs: [...punches("A", MON, ["08:55", "15:10"]), ...punches("B", MON, ["10:00", "16:00"])],
    ...fx,
  })
  holder.client = f.client
  return f
}

describe("recalculateRange", () => {
  it("one day, two staff: returns days and records and creates the Task 1 values", async () => {
    const f = fake({})
    const res = await recalculateRange({ startDate: dayStart(MON), endDate: dayStart(MON) })
    expect(res).toEqual({ days: 1, records: 2 })
    expect(f.created).toHaveLength(2)
    expect(f.created[0]).toMatchObject({
      staffId: "A",
      date: dayStart(MON),
      status: "PRESENT",
      checkIn: at(MON, "08:55"),
      checkOut: at(MON, "15:10"),
      lateMinutes: 0,
      workMinutes: 375,
      overtimeMinutes: 0,
    })
    expect(f.created[1]).toMatchObject({
      staffId: "B",
      date: dayStart(MON),
      status: "PRESENT",
      lateMinutes: 0,
      workMinutes: 360,
    })
    expect(f.deleteCalls).toEqual([{ where: { date: { gte: dayStart(MON), lte: dayStart(MON) } } }])
  })

  it("groups a multi-day range by staff and local day", async () => {
    const TUE = "2026-11-03"
    const f = fake({
      logs: [...punches("A", MON, ["09:20", "15:30"]), ...punches("A", TUE, ["09:00", "12:00"])],
      staff: [staffA],
    })
    const res = await recalculateRange({ startDate: dayStart(MON), endDate: dayStart(TUE) })
    expect(res).toEqual({ days: 2, records: 2 })
    expect(f.created[0]).toMatchObject({ date: dayStart(MON), status: "PRESENT", lateMinutes: 20, workMinutes: 370 })
    expect(f.created[1]).toMatchObject({ date: dayStart(TUE), status: "HALF_DAY", lateMinutes: 0, workMinutes: 180 })
  })

  it("loads the whole range's punches with one bounded, ascending attendanceLog query", async () => {
    const f = fake({})
    const client = f.client as { attendanceLog: { findMany: (a: unknown) => Promise<unknown> } }
    const spy = vi.spyOn(client.attendanceLog, "findMany")
    await recalculateRange({ startDate: dayStart(MON), endDate: dayStart("2026-11-04") })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({
      where: { timestamp: { gte: dayStart(MON), lte: new Date("2026-11-04T23:59:59.999+05:30") } },
      orderBy: { timestamp: "asc" },
    })
  })

  it("staffId scope: only that staff is created and the delete is limited to that staff", async () => {
    const f = fake({})
    const res = await recalculateRange({ startDate: dayStart(MON), endDate: dayStart(MON), staffId: "A" })
    expect(res).toEqual({ days: 1, records: 1 })
    expect(f.created.map((r) => r.staffId)).toEqual(["A"])
    expect(f.deleteCalls).toHaveLength(1)
    const arg = f.deleteCalls[0] as { where: { staffId?: string } }
    expect(arg.where.staffId).toBe("A")
    expect(arg).toEqual({ where: { staffId: "A", date: { gte: dayStart(MON), lte: dayStart(MON) } } })
  })

  it("staffId scope keeps the locked exclusion for that staff", async () => {
    const f = fake({ lockedPayrolls: [{ staffId: "A", month: 11, year: 2026 }] })
    const res = await recalculateRange({ startDate: dayStart(MON), endDate: dayStart(MON), staffId: "A" })
    expect(res).toEqual({ days: 1, records: 0 })
    expect(f.created).toEqual([])
    expect(f.deleteCalls[0]).toEqual({
      where: {
        staffId: "A",
        date: { gte: dayStart(MON), lte: dayStart(MON) },
        NOT: {
          OR: [{ staffId: "A", date: { gte: dayStart("2026-11-01"), lte: new Date("2026-11-30T23:59:59.999+05:30") } }],
        },
      },
    })
  })

  it("locked staff-month: no record for that staff and the delete has a NOT clause", async () => {
    const f = fake({ lockedPayrolls: [{ staffId: "A", month: 11, year: 2026 }] })
    const res = await recalculateRange({ startDate: dayStart(MON), endDate: dayStart(MON) })
    expect(res).toEqual({ days: 1, records: 1 })
    expect(f.created.map((r) => r.staffId)).toEqual(["B"])
    expect(f.deleteCalls[0]).toEqual({
      where: {
        date: { gte: dayStart(MON), lte: dayStart(MON) },
        NOT: {
          OR: [{ staffId: "A", date: { gte: dayStart("2026-11-01"), lte: new Date("2026-11-30T23:59:59.999+05:30") } }],
        },
      },
    })
  })
})

describe("recalculateRange with a failing shift sync", () => {
  it("logs the sync failure and still recalculates", async () => {
    const f = fake({})
    const client = f.client as { shiftAssignment: { findMany: (a?: unknown) => Promise<unknown> } }
    const original = client.shiftAssignment.findMany
    let calls = 0
    client.shiftAssignment.findMany = async (a?: unknown) => {
      calls++
      if (calls === 1) throw new Error("sync down") // the sync's query runs first
      return original(a as never)
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await recalculateRange({ startDate: dayStart(MON), endDate: dayStart(MON) })
    expect(res).toEqual({ days: 1, records: 2 })
    expect(f.created).toHaveLength(2)
    expect(spy.mock.calls[0][0]).toContain("[attendance] syncCurrentShifts failed:")
    spy.mockRestore()
  })
})

describe("shift history", () => {
  const TUE = "2026-11-03"
  const WED = "2026-11-04"
  const LATE_SHIFT = { id: "s2", name: "Late", startTime: "10:00", endTime: "16:00" }

  it("judges each day by the shift that applied that day", async () => {
    const f = fake({
      staff: [staffA],
      shifts: [SHIFT, LATE_SHIFT],
      assignments: [
        { staffId: "A", effectiveFrom: ALWAYS, shiftId: "s1" },
        { staffId: "A", effectiveFrom: WED, shiftId: "s2" },
      ],
      logs: [...punches("A", TUE, ["09:40", "15:30"]), ...punches("A", WED, ["09:40", "15:30"])],
    })
    await recalculateRange({ startDate: dayStart(TUE), endDate: dayStart(WED) })
    expect(f.created[0]).toMatchObject({ date: dayStart(TUE), lateMinutes: 40 })
    expect(f.created[1]).toMatchObject({ date: dayStart(WED), lateMinutes: 0 })
  })

  it("a staff with no assignments falls back to Staff.shiftId", async () => {
    const f = fake({ staff: [staffA], logs: punches("A", MON, ["09:20", "15:30"]) })
    await recalculateRange({ startDate: dayStart(MON), endDate: dayStart(MON) })
    expect(f.created[0]).toMatchObject({ staffId: "A", lateMinutes: 20 })
  })
})

describe("computeRangeRecords", () => {
  const FUTURE = "2026-11-09"
  function inputs(logs: Map<string, { timestamp: Date; type: string }[]>): RangeInputs {
    return {
      startDate: dayStart(FUTURE),
      endDate: dayStart(FUTURE),
      staffList: [
        { id: "A", shiftId: "s1", shift: { startTime: "09:00" } },
        { id: "B", shiftId: null, shift: null },
      ],
      policy: POLICY,
      holidayKeys: new Set(),
      weekOffDays: [0],
      lockedKeys: new Set(),
      lockedPayrolls: [],
      logsByStaffDay: logs,
      shiftsById: new Map([["s1", SHIFT]]),
      assignmentsByStaff: new Map(),
    }
  }

  it("skips a future day with no punches", () => {
    const now = new Date("2026-11-06T12:00:00+05:30")
    expect(computeRangeRecords(inputs(new Map()), now)).toEqual([])
  })

  it("keeps a future day that has punches", () => {
    const now = new Date("2026-11-06T12:00:00+05:30")
    const key = `A|${startOfDay(dayStart(FUTURE)).getTime()}`
    const rows = computeRangeRecords(
      inputs(new Map([[key, [{ timestamp: at(FUTURE, "09:00"), type: "IN" }, { timestamp: at(FUTURE, "15:00"), type: "OUT" }]]])),
      now,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ staffId: "A", date: dayStart(FUTURE), status: "PRESENT", workMinutes: 360 })
  })
})
