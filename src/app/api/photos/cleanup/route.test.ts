import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFakePrisma } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))

import { getServerSession } from "next-auth/next"
import { POST } from "./route"

const session = vi.mocked(getServerSession)
let f: ReturnType<typeof createFakePrisma>

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "u1" } } as never)
  f = createFakePrisma({ staff: [], policy: null, holidays: [], lockedPayrolls: [], logs: [] })
  holder.client = f.client
})

describe("POST /api/photos/cleanup", () => {
  it("answers 401 without a session and does nothing", async () => {
    session.mockResolvedValue(null)
    expect((await POST()).status).toBe(401)
    expect(f.policyWrites).toHaveLength(0)
  })

  it("returns the cleanup result", async () => {
    f.punchPhotos.push({ id: "old", staffId: "s1", logId: null, takenAt: new Date(0), data: Buffer.from([0xff, 0xd8]), isProfile: false })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ran: true, deleted: 1 })
  })

  it("answers 500 JSON when the database throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    ;(f.client as { policy: { findFirst: () => Promise<unknown> } }).policy.findFirst = async () => {
      throw new Error("db down")
    }
    const res = await POST()
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Failed to clean up photos" })
    spy.mockRestore()
  })
})
