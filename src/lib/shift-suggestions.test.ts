import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { ensureSchoolTimezone } from "@/lib/timezone"
import { createFakePrisma, type Fixtures, type SuggestionRow } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))

import {
  approveSuggestion,
  dismissSuggestion,
  isSuppressed,
  listPendingSuggestions,
  runDetection,
  shouldRunDetection,
} from "@/lib/shift-suggestions"

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
const POLICY = {
  id: "p1",
  lateArrivalAllow: "00:15",
  halfDayIfWorkHrsLessThan: "06:00",
  absentIfWorkHrsLessThan: "00:00",
  allInOut: "First IN Last OUT",
  weekOffDays: "0",
  shiftDetectionRanAt: null,
}
const at = (day: string, hm: string) => new Date(`${day}T${hm}:00+05:30`)
const dayStart = (day: string) => new Date(`${day}T00:00:00+05:30`)

function dayKeys(from: string, to: string): string[] {
  const out: string[] = []
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86400000) {
    const d = new Date(t)
    if (d.getUTCDay() !== 0) out.push(d.toISOString().slice(0, 10)) // skip Sundays (week-off)
  }
  return out
}

function punches(staffId: string, day: string, times: string[]) {
  return times.map((t, i) => ({
    id: `${staffId}-${day}-${i}`,
    staffId,
    timestamp: at(day, t),
    type: i % 2 === 0 ? "IN" : "OUT",
  }))
}

// 24 working days in the 28 days before 6 Nov: teacher A arrives 08:30 and leaves 14:30
const WINDOW_DAYS = dayKeys("2026-10-09", "2026-11-05")
const PATTERN_LOGS = WINDOW_DAYS.flatMap((d) => punches("A", d, ["08:30", "14:30"]))

function fake(fx: Partial<Fixtures> = {}) {
  const f = createFakePrisma({
    staff: [{ id: "A", name: "Asha", shiftId: "s1", shift: DAY }],
    shifts: [DAY],
    policy: POLICY,
    holidays: [],
    lockedPayrolls: [],
    logs: PATTERN_LOGS,
    ...fx,
  })
  holder.client = f.client
  return f
}

const TODAY = "2026-11-06"
const ALL_WINDOW_DAYS = (() => {
  const out: string[] = []
  for (let t = Date.parse("2026-10-09T00:00:00Z"); t <= Date.parse("2026-11-05T00:00:00Z"); t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
})()
const weekday = (key: string) => new Date(`${key}T00:00:00Z`).getUTCDay()
/** The n most recent non-Sunday day keys before today. */
function recentWorkingDays(n: number): string[] {
  return ALL_WINDOW_DAYS.filter((d) => weekday(d) !== 0).slice(-n)
}

const pending = (rows: SuggestionRow[]) => rows.filter((r) => r.status === "PENDING")

describe("shouldRunDetection", () => {
  const now = new Date("2026-11-06T12:00:00+05:30")
  it("runs when it never ran", () => {
    expect(shouldRunDetection(null, now, false)).toBe(true)
  })
  it("does not run 5h59m after the last run", () => {
    expect(shouldRunDetection(new Date(now.getTime() - (5 * 60 + 59) * 60000), now, false)).toBe(false)
  })
  it("runs exactly 6 hours after the last run", () => {
    expect(shouldRunDetection(new Date(now.getTime() - 6 * 3600000), now, false)).toBe(true)
  })
  it("runs when forced", () => {
    expect(shouldRunDetection(new Date(now.getTime() - 60000), now, true)).toBe(true)
  })
})

describe("isSuppressed", () => {
  const dismissed = { dismissedUntil: "2026-12-01", medianIn: "09:30" }
  it("is not suppressed without a dismissal", () => {
    expect(isSuppressed(null, "09:30", "2026-11-06")).toBe(false)
  })
  it("is suppressed inside the window with the same median (including the last day)", () => {
    expect(isSuppressed(dismissed, "09:30", "2026-11-06")).toBe(true)
    expect(isSuppressed(dismissed, "09:30", "2026-12-01")).toBe(true)
  })
  it("is lifted after the window", () => {
    expect(isSuppressed(dismissed, "09:30", "2026-12-02")).toBe(false)
  })
  it("is lifted by a 20-minute median move, not by 19 minutes", () => {
    expect(isSuppressed(dismissed, "09:50", "2026-11-06")).toBe(false)
    expect(isSuppressed(dismissed, "09:10", "2026-11-06")).toBe(false)
    expect(isSuppressed(dismissed, "09:49", "2026-11-06")).toBe(true)
  })
  it("a dismissal with no dismissedUntil does not suppress", () => {
    expect(isSuppressed({ dismissedUntil: null, medianIn: "09:30" }, "09:30", "2026-11-06")).toBe(false)
  })
})

describe("runDetection", () => {
  it("creates one pending suggestion with the proposed new shift and stamps the policy", async () => {
    const f = fake()
    const res = await runDetection({ now: NOW })
    expect(res).toEqual({ ran: true, pending: 1 })
    expect(f.suggestions).toHaveLength(1)
    expect(f.suggestions[0]).toMatchObject({
      staffId: "A",
      status: "PENDING",
      fromShiftId: "s1",
      suggestedShiftId: null,
      suggestedStart: "08:30",
      suggestedEnd: "14:30",
      medianIn: "08:30",
      direction: "EARLIER",
      daysObserved: 24,
    })
    expect(f.policyWrites).toEqual([{ op: "update", data: { shiftDetectionRanAt: NOW } }])
  })

  it("creates the policy row, already stamped, when none exists", async () => {
    const f = fake({ policy: null })
    await runDetection({ now: NOW })
    expect(f.policyWrites).toEqual([{ op: "create", data: { shiftDetectionRanAt: NOW } }])
  })

  it("two overlapping runs create one pending row per teacher and only one runs", async () => {
    const f = fake()
    const results = await Promise.all([runDetection({ now: NOW }), runDetection({ now: NOW })])
    expect(results.filter((r) => r.ran)).toHaveLength(1)
    expect(pending(f.suggestions)).toHaveLength(1)
  })

  it("a forced run stamps the policy before the heavy work", async () => {
    const f = fake({ policy: { ...POLICY, shiftDetectionRanAt: new Date(NOW.getTime() - 60000) } })
    const client = f.client as { attendanceLog: { findMany: () => Promise<unknown> } }
    client.attendanceLog.findMany = async () => {
      expect(f.policyWrites).toHaveLength(1)
      throw new Error("db down")
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    await expect(runDetection({ now: NOW, force: true })).rejects.toThrow("db down")
    expect(spy.mock.calls[0][0]).toContain("[shift-suggestions]")
    spy.mockRestore()
  })

  it("does not run twice within the throttle window", async () => {
    const f = fake()
    await runDetection({ now: NOW })
    const writes = f.policyWrites.length
    const res = await runDetection({ now: new Date(NOW.getTime() + 3600000) })
    expect(res).toEqual({ ran: false, pending: 1 })
    expect(f.policyWrites).toHaveLength(writes)
  })

  it("forced reruns with the same data leave exactly one pending row", async () => {
    const f = fake()
    await runDetection({ now: NOW })
    await runDetection({ now: NOW, force: true })
    expect(pending(f.suggestions)).toHaveLength(1)
    expect(f.suggestions).toHaveLength(1)
  })

  it("deletes the pending row when the pattern disappears", async () => {
    const f = fake({
      suggestions: [{ id: "old", staffId: "A", status: "PENDING", medianIn: "08:30" }],
      logs: WINDOW_DAYS.flatMap((d) => punches("A", d, ["09:00", "15:00"])),
    })
    const res = await runDetection({ now: NOW, force: true })
    expect(res.pending).toBe(0)
    expect(f.suggestions).toEqual([])
  })

  it("skips a teacher with no current shift", async () => {
    const f = fake({ staff: [{ id: "A", name: "Asha", shiftId: null, shift: null }] })
    await runDetection({ now: NOW })
    expect(f.suggestions).toEqual([])
  })

  it("does not use today punches (9 qualifying days plus an early punch today: no pattern; 10 past days: pattern)", async () => {
    const nine = recentWorkingDays(9)
    const withToday = fake({
      logs: [...nine.flatMap((d) => punches("A", d, ["08:30", "14:30"])), ...punches("A", TODAY, ["08:30", "14:30"])],
    })
    await runDetection({ now: NOW })
    expect(withToday.suggestions).toEqual([])

    const ten = recentWorkingDays(10)
    const control = fake({ logs: ten.flatMap((d) => punches("A", d, ["08:30", "14:30"])) })
    await runDetection({ now: NOW })
    expect(pending(control.suggestions)).toHaveLength(1)
  })

  it("window start: a punch exactly 28 days back counts, 29 days back does not", async () => {
    const recent = recentWorkingDays(9)
    const early = (d: string) => punches("A", d, ["08:30", "14:30"])
    const inside = fake({ logs: [...recent, "2026-10-09"].flatMap(early) }) // 28 days before 6 Nov
    await runDetection({ now: NOW })
    expect(pending(inside.suggestions)).toHaveLength(1)

    const outside = fake({ logs: [...recent, "2026-10-08"].flatMap(early) }) // 29 days before
    await runDetection({ now: NOW })
    expect(outside.suggestions).toEqual([])
  })

  it("skips week-off days: the early pattern exists only when Mon-Wed are off", async () => {
    // Mon-Wed arrive on time, every other day early
    const logs = ALL_WINDOW_DAYS.flatMap((d) =>
      punches("A", d, [weekday(d) >= 1 && weekday(d) <= 3 ? "09:00" : "08:30", "14:30"]),
    )
    const off = fake({ logs, policy: { ...POLICY, weekOffDays: "1,2,3" } })
    await runDetection({ now: NOW })
    expect(pending(off.suggestions)).toHaveLength(1)
    expect(off.suggestions[0].daysObserved).toBe(16)

    const control = fake({ logs, policy: { ...POLICY, weekOffDays: "0" } })
    await runDetection({ now: NOW })
    expect(control.suggestions).toEqual([]) // Mon-Wed now count: only half the days are early
  })

  it("skips holidays: the pattern exists only when the on-time days are marked as holidays", async () => {
    const early = WINDOW_DAYS.slice(0, 12)
    const holidayDays = WINDOW_DAYS.slice(12)
    const logs = [
      ...early.flatMap((d) => punches("A", d, ["08:30", "14:30"])),
      ...holidayDays.flatMap((d) => punches("A", d, ["09:00", "15:00"])),
    ]
    const marked = fake({ logs, holidays: holidayDays.map((d) => ({ date: dayStart(d), name: "H" })) })
    await runDetection({ now: NOW })
    expect(pending(marked.suggestions)).toHaveLength(1)
    expect(marked.suggestions[0].daysObserved).toBe(12)

    const control = fake({ logs, holidays: [] })
    await runDetection({ now: NOW })
    expect(control.suggestions).toEqual([])
  })

  it("removes a stale pending row when the pattern is suppressed by a dismissal", async () => {
    const f = fake({
      suggestions: [
        { id: "old", staffId: "A", status: "PENDING", medianIn: "08:30" },
        { id: "d1", staffId: "A", status: "DISMISSED", medianIn: "08:30", dismissedUntil: "2026-12-01", decidedAt: NOW },
      ],
    })
    const res = await runDetection({ now: NOW })
    expect(res.pending).toBe(0)
    expect(f.suggestions.map((r) => r.id)).toEqual(["d1"])
  })

  it("stays quiet for a recently dismissed suggestion with the same median", async () => {
    const f = fake({
      suggestions: [{ id: "d1", staffId: "A", status: "DISMISSED", medianIn: "08:30", dismissedUntil: "2026-12-01" }],
    })
    const res = await runDetection({ now: NOW })
    expect(res).toEqual({ ran: true, pending: 0 })
    expect(pending(f.suggestions)).toEqual([])
  })

  it("continues past one teacher's failure", async () => {
    const f = fake({
      staff: [
        { id: "A", name: "Asha", shiftId: "s1", shift: DAY },
        { id: "B", name: "Bela", shiftId: "s1", shift: DAY },
      ],
      logs: [...PATTERN_LOGS, ...WINDOW_DAYS.flatMap((d) => punches("B", d, ["08:30", "14:30"]))],
    })
    const client = f.client as { shiftSuggestion: { create: (a: { data: { staffId: string } }) => Promise<unknown> } }
    const original = client.shiftSuggestion.create
    client.shiftSuggestion.create = async (a) => {
      if (a.data.staffId === "A") throw new Error("boom")
      return original(a)
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await runDetection({ now: NOW })
    expect(res.ran).toBe(true)
    expect(f.suggestions.map((r) => r.staffId)).toEqual(["B"])
    expect(spy.mock.calls[0][0]).toContain("[shift-suggestions]")
    spy.mockRestore()
  })
})

const SUG: SuggestionRow = {
  id: "g1",
  staffId: "A",
  status: "PENDING",
  fromShiftId: "s1",
  suggestedShiftId: null,
  suggestedStart: "08:30",
  suggestedEnd: "14:30",
  medianIn: "08:30",
  medianOut: "14:30",
  daysObserved: 24,
  daysWithinTolerance: 24,
  lateDays: 0,
  patternSince: "2026-10-09",
  direction: "EARLIER",
}

describe("listPendingSuggestions", () => {
  it("shapes pending rows with staff and shift names, newest pattern first", async () => {
    fake({
      staff: [
        { id: "A", name: "Asha", shiftId: "s1", shift: DAY },
        { id: "B", name: "Bela", shiftId: "s1", shift: DAY },
      ],
      suggestions: [
        SUG,
        { ...SUG, id: "g2", staffId: "B", patternSince: "2026-10-20" },
        { ...SUG, id: "g3", status: "DISMISSED" },
      ],
    })
    const list = await listPendingSuggestions()
    expect(list.map((r) => r.id)).toEqual(["g2", "g1"])
    expect(list[0]).toEqual({
      id: "g2",
      staffId: "B",
      staffName: "Bela",
      fromShiftName: "Day",
      medianIn: "08:30",
      medianOut: "14:30",
      daysObserved: 24,
      daysWithinTolerance: 24,
      lateDays: 0,
      patternSince: "2026-10-20",
      direction: "EARLIER",
      suggestedShiftId: null,
      suggestedStart: "08:30",
      suggestedEnd: "14:30",
    })
  })
})

describe("listPendingSuggestions duplicates", () => {
  it("returns only the newest pending row per teacher and removes the older", async () => {
    const f = fake({
      suggestions: [
        { ...SUG, id: "old", createdAt: new Date("2026-11-01T10:00:00+05:30") },
        { ...SUG, id: "new", createdAt: new Date("2026-11-05T10:00:00+05:30") },
      ],
    })
    const list = await listPendingSuggestions()
    expect(list.map((r) => r.id)).toEqual(["new"])
    expect(f.suggestions.map((r) => r.id)).toEqual(["new"])
  })
})

const WEEK = dayKeys("2026-11-02", "2026-11-05")
function approveFake(over: Partial<Fixtures> = {}) {
  return fake({
    suggestions: [{ ...SUG }],
    logs: WEEK.flatMap((d) => punches("A", d, ["08:30", "14:30"])),
    dailyRecords: WEEK.map((d) => ({ staffId: "A", date: dayStart(d), status: "PRESENT", lateMinutes: 0 })),
    ...over,
  })
}

describe("approveSuggestion", () => {
  it("dry run writes nothing, even when the suggestion proposes a new shift", async () => {
    const f = approveFake()
    const res = await approveSuggestion("g1", "2026-11-02", { dryRun: true })
    expect(res).toMatchObject({ recalculatedDays: 5 })
    expect(f.shiftRows).toHaveLength(1)
    expect(f.assignments).toEqual([])
    expect(f.staffUpdates).toEqual([])
    expect(f.created).toEqual([])
    expect(f.suggestions[0].status).toBe("PENDING")
  })

  it("a real approve creates the shift first, then the assignment, and marks APPROVED", async () => {
    const f = approveFake()
    const res = await approveSuggestion("g1", "2026-11-02", { userId: "u1" })
    expect(res).toMatchObject({ assignmentSaved: true, recalculated: true })
    expect(f.shiftRows).toHaveLength(2)
    const created = f.shiftRows[1]
    expect(created).toMatchObject({ name: "08:30-14:30", startTime: "08:30", endTime: "14:30" })
    expect(f.assignments).toContainEqual(
      expect.objectContaining({
        staffId: "A",
        effectiveFrom: "2026-11-02",
        shiftId: created.id,
        source: "SUGGESTION",
        createdByUserId: "u1",
      }),
    )
    expect(f.suggestions[0]).toMatchObject({
      status: "APPROVED",
      decidedByUserId: "u1",
      suggestedShiftId: created.id,
    })
    expect(f.suggestions[0].decidedAt).toBeInstanceOf(Date)
  })

  it("reuses an existing shift with the same times instead of creating a duplicate", async () => {
    const SAME = { id: "s7", name: "Early", startTime: "08:30", endTime: "14:30" }
    const f = approveFake({ shifts: [DAY, SAME] })
    await approveSuggestion("g1", "2026-11-02", {})
    expect(f.shiftRows).toHaveLength(2)
    expect(f.assignments.some((a) => a.shiftId === "s7" && a.source === "SUGGESTION")).toBe(true)
  })

  it("uses suggestedShiftId when set", async () => {
    const S2 = { id: "s2", name: "Early", startTime: "08:30", endTime: "14:30" }
    const f = approveFake({ shifts: [DAY, S2], suggestions: [{ ...SUG, suggestedShiftId: "s2" }] })
    await approveSuggestion("g1", "2026-11-02", {})
    expect(f.shiftRows).toHaveLength(2)
    expect(f.suggestions[0].status).toBe("APPROVED")
  })

  it("a failing apply leaves the suggestion PENDING, and a retry reuses the shift it created", async () => {
    const f = approveFake()
    const client = f.client as { $transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> }
    const original = client.$transaction
    client.$transaction = async () => {
      throw new Error("db down")
    }
    await expect(approveSuggestion("g1", "2026-11-02", {})).rejects.toThrow("db down")
    expect(f.suggestions[0].status).toBe("PENDING")
    client.$transaction = original
    await approveSuggestion("g1", "2026-11-02", {})
    expect(f.shiftRows).toHaveLength(2)
    expect(f.suggestions[0].status).toBe("APPROVED")
  })

  it("two simultaneous real approves create one shift and one assignment, and one call wins", async () => {
    const f = approveFake()
    const results = await Promise.allSettled([
      approveSuggestion("g1", "2026-11-02", { userId: "u1" }),
      approveSuggestion("g1", "2026-11-02", { userId: "u1" }),
    ])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult
    expect(failed.reason).toMatchObject({ status: 409 })
    expect(f.shiftRows).toHaveLength(2)
    expect(f.assignments.filter((a) => a.source === "SUGGESTION")).toHaveLength(1)
    expect(f.suggestions[0].status).toBe("APPROVED")
  })

  it("a failing apply returns the row to PENDING", async () => {
    const f = approveFake()
    const client = f.client as { $transaction: () => Promise<unknown> }
    client.$transaction = async () => {
      throw new Error("db down")
    }
    await expect(approveSuggestion("g1", "2026-11-02", {})).rejects.toThrow("db down")
    expect(f.suggestions[0].status).toBe("PENDING")
  })

  it("a fresh APPROVING row cannot be claimed, a stale one can", async () => {
    const fresh = approveFake({ suggestions: [{ ...SUG, status: "APPROVING", updatedAt: new Date(NOW.getTime() - 60000) }] })
    await expect(approveSuggestion("g1", "2026-11-02", {})).rejects.toMatchObject({ status: 409 })
    expect(fresh.shiftRows).toHaveLength(1)

    const stale = approveFake({
      suggestions: [{ ...SUG, status: "APPROVING", updatedAt: new Date(NOW.getTime() - 10 * 60000) }],
    })
    await approveSuggestion("g1", "2026-11-02", {})
    expect(stale.suggestions[0].status).toBe("APPROVED")
  })

  it("a dry run previews a proposed new shift in memory (a 09:00 shift is still late for a 10:00 arrival)", async () => {
    const EARLY8 = { id: "s8", name: "Early8", startTime: "08:00", endTime: "14:00" }
    const days = dayKeys("2026-11-02", "2026-11-06")
    const f = fake({
      staff: [{ id: "A", name: "Asha", shiftId: "s8", shift: EARLY8 }],
      shifts: [EARLY8],
      suggestions: [{ ...SUG, fromShiftId: "s8", suggestedStart: "09:00", suggestedEnd: "15:00" }],
      logs: days.flatMap((d) => punches("A", d, ["10:00", "16:30"])),
      dailyRecords: days.map((d) => ({ staffId: "A", date: dayStart(d), status: "PRESENT", lateMinutes: 120 })),
    })
    const res = (await approveSuggestion("g1", "2026-11-02", { dryRun: true })) as {
      recalculatedDays: number
      changedDays: number
      transitions: Record<string, number>
    }
    expect(res.recalculatedDays).toBe(5)
    expect(res.changedDays).toBe(5) // 120 -> 60 minutes late
    expect(res.transitions).toEqual({})
    expect(f.shiftRows).toHaveLength(1)
    expect(f.suggestions[0].status).toBe("PENDING")
  })

  it("rejects an unknown or already decided suggestion", async () => {
    fake({ suggestions: [{ ...SUG, status: "DISMISSED" }] })
    await expect(approveSuggestion("nope", "2026-11-02", {})).rejects.toMatchObject({ status: 404 })
    await expect(approveSuggestion("g1", "2026-11-02", {})).rejects.toMatchObject({ status: 404 })
  })

  it("rejects a malformed or too-early start date", async () => {
    approveFake()
    await expect(approveSuggestion("g1", "2026-13-40", {})).rejects.toMatchObject({ status: 400 })
    await expect(approveSuggestion("g1", "1999-12-31", {})).rejects.toMatchObject({ status: 400 })
  })
})

describe("dismissSuggestion", () => {
  it("sets DISMISSED with dismissedUntil thirty days ahead", async () => {
    const f = fake({ suggestions: [{ ...SUG }] })
    await dismissSuggestion("g1", "u1")
    expect(f.suggestions[0]).toMatchObject({
      status: "DISMISSED",
      dismissedUntil: "2026-12-06",
      decidedByUserId: "u1",
    })
    expect(f.suggestions[0].decidedAt).toBeInstanceOf(Date)
  })

  it("cannot dismiss a suggestion that is being approved", async () => {
    const f = fake({ suggestions: [{ ...SUG, status: "APPROVING" }] })
    await expect(dismissSuggestion("g1")).rejects.toMatchObject({ status: 409 })
    expect(f.suggestions[0].status).toBe("APPROVING")
  })

  it("errors for an unknown or already decided suggestion", async () => {
    fake({ suggestions: [{ ...SUG, status: "APPROVED" }] })
    await expect(dismissSuggestion("g1")).rejects.toMatchObject({ status: 404 })
    await expect(dismissSuggestion("zzz")).rejects.toMatchObject({ status: 404 })
  })
})
