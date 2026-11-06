import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { ensureSchoolTimezone } from "@/lib/timezone"
import { createFakePrisma, type Fixtures } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn(async () => ({ user: { name: "admin" } })) }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))

import { POST } from "./route"

beforeAll(() => {
  ensureSchoolTimezone()
})
afterEach(() => {
  vi.useRealTimers()
})

const SHIFT = { id: "s1", name: "Day", startTime: "09:00", endTime: "15:00" }
const staffA = { id: "A", name: "A", shiftId: "s1", shift: SHIFT }
const POLICY = {
  lateArrivalAllow: "00:15",
  halfDayIfWorkHrsLessThan: "06:00",
  absentIfWorkHrsLessThan: "00:00",
  allInOut: "First IN Last OUT",
  weekOffDays: "0",
}
const MON = "2026-11-02"
const at = (hm: string) => new Date(`${MON}T${hm}:00+05:30`)
const dayStart = new Date(`${MON}T00:00:00+05:30`)

function punches(times: string[]) {
  return times.map((t, i) => ({ id: `A-${i}`, staffId: "A", timestamp: at(t), type: i % 2 === 0 ? "IN" : "OUT" }))
}

async function post(fx: Partial<Fixtures>, body: Record<string, unknown>) {
  const fake = createFakePrisma({
    staff: [staffA],
    policy: POLICY,
    holidays: [],
    lockedPayrolls: [],
    logs: [],
    ...fx,
  })
  holder.client = fake.client
  const res = await POST(new Request("http://x/api/recalculate", { method: "POST", body: JSON.stringify(body) }))
  return { res, json: await res.json(), ...fake }
}

const range = { startDate: dayStart.toISOString(), endDate: dayStart.toISOString() }

describe("POST /api/recalculate characterization", () => {
  it.each([
    ["on time", ["08:55", "15:10"], "PRESENT", 0, 375],
    ["late beyond grace", ["09:20", "15:30"], "PRESENT", 20, 370],
    ["half day", ["09:00", "12:00"], "HALF_DAY", 0, 180],
  ])("%s", async (_n, times, status, late, work) => {
    const { json, created } = await post({ logs: punches(times as string[]) }, range)
    expect(json).toEqual({ success: true, recalculatedDays: 1, processedRecords: 1 })
    expect(created[0]).toMatchObject({ staffId: "A", status, lateMinutes: late, workMinutes: work })
  })

  it("absent", async () => {
    const { json, created } = await post({}, range)
    expect(json).toEqual({ success: true, recalculatedDays: 1, processedRecords: 1 })
    expect(created[0]).toMatchObject({ status: "ABSENT", lateMinutes: 0, workMinutes: 0 })
  })

  it("locked month produces no record", async () => {
    const { json, created, deleteCalls } = await post(
      { lockedPayrolls: [{ staffId: "A", month: 11, year: 2026 }], logs: punches(["09:00", "15:00"]) },
      range,
    )
    expect(json).toEqual({ success: true, recalculatedDays: 1, processedRecords: 0 })
    expect(created).toEqual([])
    expect(JSON.stringify(deleteCalls[0])).toContain("NOT")
  })

  it("no startDate: defaults to earliest log through today", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-06T12:00:00+05:30"))
    const { json } = await post({ logs: punches(["09:00", "15:00"]) }, {})
    // 2 Nov through 6 Nov inclusive
    expect(json.success).toBe(true)
    expect(json.recalculatedDays).toBe(5)
  })
})
