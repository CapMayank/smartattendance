import { describe, expect, it, vi } from "vitest"
import { createFakePrisma } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn(async () => ({ user: { id: "u1", name: "admin" } })) }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))

import { DELETE as deleteByQuery } from "./route"
import { DELETE as deleteById } from "./[id]/route"

const shifts = [
  { id: "S1", name: "Morning", startTime: "09:00", endTime: "17:00" },
  { id: "S2", name: "Unused", startTime: "10:00", endTime: "18:00" },
]

function setup(extra: { staffShiftId?: string | null; assignmentShiftId?: string; suggestedShiftId?: string; suggestionStatus?: string } = {}) {
  const f = createFakePrisma({
    staff: [{ id: "A", name: "A", shiftId: extra.staffShiftId ?? null, shift: null }],
    policy: null,
    holidays: [],
    lockedPayrolls: [],
    logs: [],
    shifts,
    assignments: extra.assignmentShiftId
      ? [{ staffId: "A", effectiveFrom: "2026-11-01", shiftId: extra.assignmentShiftId }]
      : [],
    suggestions: extra.suggestedShiftId
      ? [{ id: "g1", staffId: "A", status: extra.suggestionStatus ?? "PENDING", suggestedShiftId: extra.suggestedShiftId }]
      : [],
  })
  holder.client = f.client
  return f
}

const viaQuery = (id: string) =>
  deleteByQuery(new Request(`http://localhost/api/shifts?id=${id}`, { method: "DELETE" }))
const viaId = (id: string) =>
  deleteById(new Request(`http://localhost/api/shifts/${id}`, { method: "DELETE" }), { params: Promise.resolve({ id }) })

describe.each([
  ["DELETE /api/shifts?id=", viaQuery],
  ["DELETE /api/shifts/[id]", viaId],
])("%s", (_name, call) => {
  it("returns 409 and deletes nothing when a shift change references the shift", async () => {
    const f = setup({ assignmentShiftId: "S1" })
    const res = await call("S1")
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("in use")
    expect(f.shiftRows.map((s) => s.id)).toContain("S1")
  })

  it("returns 409 when a teacher is on the shift", async () => {
    const f = setup({ staffShiftId: "S1" })
    const res = await call("S1")
    expect(res.status).toBe(409)
    expect(f.shiftRows).toHaveLength(2)
  })

  it("returns 409 when a suggestion proposes the shift", async () => {
    const f = setup({ suggestedShiftId: "S1" })
    const res = await call("S1")
    expect(res.status).toBe(409)
    expect(f.shiftRows).toHaveLength(2)
  })

  it("counts every reference in the message", async () => {
    setup({ staffShiftId: "S1", assignmentShiftId: "S1", suggestedShiftId: "S1" })
    const res = await call("S1")
    expect((await res.json()).error).toBe(
      "This shift is in use by 3 teachers or shift changes. Move them to another shift first.",
    )
  })

  it("uses the singular for one reference", async () => {
    setup({ assignmentShiftId: "S1" })
    const res = await call("S1")
    expect((await res.json()).error).toBe(
      "This shift is in use by 1 teacher or shift change. Move them to another shift first.",
    )
  })

  it.each(["DISMISSED", "APPROVED"])("a %s suggestion does not block deletion", async (status) => {
    const f = setup({ suggestedShiftId: "S1", suggestionStatus: status })
    const res = await call("S1")
    expect(res.status).toBe(200)
    expect(f.shiftRows.map((s) => s.id)).toEqual(["S2"])
  })

  it("an APPROVING suggestion still blocks deletion", async () => {
    setup({ suggestedShiftId: "S1", suggestionStatus: "APPROVING" })
    expect((await call("S1")).status).toBe(409)
  })

  it("still deletes an unused shift", async () => {
    const f = setup({ staffShiftId: "S1", assignmentShiftId: "S1" })
    const res = await call("S2")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(f.shiftRows.map((s) => s.id)).toEqual(["S1"])
  })
})
