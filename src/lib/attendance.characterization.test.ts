import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { startOfDay } from "date-fns"
import { ensureSchoolTimezone } from "@/lib/timezone"
import { createFakePrisma, type Fixtures } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))

import { recalculateAttendance } from "@/lib/attendance"

beforeAll(() => {
  ensureSchoolTimezone()
})
afterEach(() => {
  vi.useRealTimers()
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
const SUN = "2026-11-01"
const at = (day: string, hm: string) => new Date(`${day}T${hm}:00+05:30`)
const dayStart = (day: string) => new Date(`${day}T00:00:00+05:30`)

function punches(staffId: string, day: string, times: string[], types?: string[]) {
  return times.map((t, i) => ({
    id: `${staffId}-${day}-${i}`,
    staffId,
    timestamp: at(day, t),
    type: types?.[i] ?? (i % 2 === 0 ? "IN" : "OUT"),
  }))
}

async function run(fx: Partial<Fixtures>, day: string) {
  const fixtures: Fixtures = {
    staff: [staffA],
    policy: POLICY,
    holidays: [],
    lockedPayrolls: [],
    logs: [],
    ...fx,
  }
  const fake = createFakePrisma(fixtures)
  holder.client = fake.client
  const n = await recalculateAttendance(dayStart(day), dayStart(day))
  return { n, ...fake }
}

describe("recalculateAttendance characterization", () => {
  const cases: [string, string[], string, number, number][] = [
    ["on time", ["08:55", "15:10"], "PRESENT", 0, 375],
    ["inside grace", ["09:10", "15:30"], "PRESENT", 0, 380],
    ["late beyond grace", ["09:20", "15:30"], "PRESENT", 20, 370],
    ["half day", ["09:00", "12:00"], "HALF_DAY", 0, 180],
    ["single punch", ["09:00"], "HALF_DAY", 0, 0],
  ]
  it.each(cases)("%s", async (_n, times, status, late, work) => {
    const { created } = await run({ logs: punches("A", MON, times) }, MON)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ staffId: "A", status, lateMinutes: late, workMinutes: work })
    expect(created[0].date).toEqual(dayStart(MON))
    expect(created[0].overtimeMinutes).toBe(0)
  })

  it("absent", async () => {
    const { created } = await run({}, MON)
    expect(created[0]).toMatchObject({ status: "ABSENT", lateMinutes: 0, workMinutes: 0, checkIn: null, checkOut: null })
  })

  it("holiday, no punches", async () => {
    const { created } = await run({ holidays: [{ date: dayStart(MON), name: "H" }] }, MON)
    expect(created[0]).toMatchObject({ status: "HOLIDAY", lateMinutes: 0, workMinutes: 0 })
  })

  it("holiday with punches", async () => {
    const { created } = await run(
      { holidays: [{ date: dayStart(MON), name: "H" }], logs: punches("A", MON, ["09:00", "11:00"]) },
      MON,
    )
    expect(created[0]).toMatchObject({ status: "PRESENT", lateMinutes: 0, workMinutes: 120 })
  })

  it("week off, no punches", async () => {
    const { created } = await run({}, SUN)
    expect(created[0]).toMatchObject({ status: "WEEKOFF", lateMinutes: 0, workMinutes: 0 })
  })

  it("no shift", async () => {
    const { created } = await run({ staff: [staffB], logs: punches("B", MON, ["10:00", "16:00"]) }, MON)
    expect(created[0]).toMatchObject({ staffId: "B", status: "PRESENT", lateMinutes: 0, workMinutes: 360 })
  })

  it("every-IN-OUT policy", async () => {
    const { created } = await run(
      {
        policy: { ...POLICY, allInOut: "Every IN OUT" },
        logs: punches("A", MON, ["09:00", "12:00", "13:00", "15:00"], ["IN", "OUT", "IN", "OUT"]),
      },
      MON,
    )
    expect(created[0]).toMatchObject({ status: "HALF_DAY", lateMinutes: 0, workMinutes: 300 })
  })

  it("locked payroll month produces no record for that staff", async () => {
    const { created, n } = await run(
      {
        staff: [staffA, staffB],
        lockedPayrolls: [{ staffId: "A", month: 11, year: 2026 }],
        logs: punches("A", MON, ["09:00", "15:00"]),
      },
      MON,
    )
    expect(n).toBe(1)
    expect(created.map((r) => r.staffId)).toEqual(["B"])
  })

  it("future date with no punches produces no record", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-06T12:00:00+05:30"))
    const { created, n } = await run({}, "2026-11-09")
    expect(n).toBe(0)
    expect(created).toEqual([])
  })

  it("delete range spans startOfDay(start) to startOfDay(end), no NOT clause without locks", async () => {
    const { deleteCalls } = await run({}, MON)
    expect(deleteCalls).toEqual([{ where: { date: { gte: startOfDay(dayStart(MON)), lte: startOfDay(dayStart(MON)) } } }])
  })

  it("delete range includes NOT/OR clause with a locked payroll", async () => {
    const { deleteCalls } = await run({ lockedPayrolls: [{ staffId: "A", month: 11, year: 2026 }] }, MON)
    expect(deleteCalls).toHaveLength(1)
    expect(deleteCalls[0]).toEqual({
      where: {
        date: { gte: dayStart(MON), lte: dayStart(MON) },
        NOT: {
          OR: [{ staffId: "A", date: { gte: dayStart("2026-11-01"), lte: new Date("2026-11-30T23:59:59.999+05:30") } }],
        },
      },
    })
  })
})
