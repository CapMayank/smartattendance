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

import { POST } from "./route"

function setup() {
  const f = createFakePrisma({ staff: [], policy: null, holidays: [], lockedPayrolls: [], logs: [], shifts: [] })
  holder.client = f.client
  return f
}

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/shifts", { method: "POST", body: JSON.stringify(body) }))

describe("POST /api/shifts", () => {
  it("creates a shift from name, startTime and endTime only, ignoring other properties", async () => {
    const f = setup()
    const res = await post({ name: " Early ", startTime: "08:00", endTime: "14:00", id: "forced", createdAt: "2000-01-01", staff: { create: [] } })
    expect(res.status).toBe(201)
    expect(f.shiftRows).toHaveLength(1)
    const { id, ...data } = f.shiftRows[0]
    expect(id).not.toBe("forced")
    expect(data).toEqual({ name: "Early", startTime: "08:00", endTime: "14:00" })
  })

  it.each([
    [{ startTime: "08:00", endTime: "14:00" }],
    [{ name: "  ", startTime: "08:00", endTime: "14:00" }],
    [{ name: "Early", startTime: 800, endTime: "14:00" }],
    [{ name: "Early", startTime: "08:00" }],
    [null],
  ])("answers 400 for %j", async (body) => {
    const f = setup()
    const res = await post(body)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("name, startTime and endTime are required")
    expect(f.shiftRows).toEqual([])
  })
})
