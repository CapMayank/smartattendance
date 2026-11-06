import { beforeAll, describe, expect, it, vi } from "vitest"
import { ensureSchoolTimezone } from "@/lib/timezone"
import { createFakePrisma } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "u1" } })) }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))

import { POST } from "./[id]/approve/route"

beforeAll(() => {
  ensureSchoolTimezone()
})

describe("POST /api/shifts/suggestions/[id]/approve", () => {
  it("a real approve returns staffId and shiftId of the applied shift", async () => {
    const DAY = { id: "s1", name: "Day", startTime: "09:00", endTime: "15:00" }
    const f = createFakePrisma({
      staff: [{ id: "A", name: "Asha", shiftId: "s1", shift: DAY }],
      shifts: [DAY],
      policy: { id: "p1", lateArrivalAllow: "00:15", halfDayIfWorkHrsLessThan: "06:00", absentIfWorkHrsLessThan: "00:00", allInOut: "First IN Last OUT", weekOffDays: "0" },
      holidays: [],
      lockedPayrolls: [],
      logs: [],
      suggestions: [
        { id: "g1", staffId: "A", status: "PENDING", fromShiftId: "s1", suggestedShiftId: null, suggestedStart: "08:30", suggestedEnd: "14:30" },
      ],
    })
    holder.client = f.client
    const res = await POST(
      new Request("http://localhost/x", { method: "POST", body: JSON.stringify({ startDate: "2099-01-01" }) }),
      { params: Promise.resolve({ id: "g1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ assignmentSaved: true, staffId: "A", shiftId: f.shiftRows[1].id })
  })
})
