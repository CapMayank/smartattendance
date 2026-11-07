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
import { GET } from "./route"

const session = vi.mocked(getServerSession)
const call = (qs = "", id = "s1") =>
  GET(new Request(`http://localhost/api/staff/${id}/photos${qs}`), { params: Promise.resolve({ id }) })

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "u1" } } as never)
  const f = createFakePrisma({
    staff: [{ id: "s1", name: "A", shiftId: null, shift: null }],
    policy: null, holidays: [], lockedPayrolls: [], logs: [],
  })
  for (let i = 1; i <= 60; i++) {
    f.punchPhotos.push({ id: `p${i}`, staffId: "s1", logId: null, takenAt: new Date(2026, 0, i), data: Buffer.from([1]), isProfile: false })
  }
  f.punchPhotos.push({ id: "prof", staffId: "s1", logId: null, takenAt: new Date(2026, 5, 1), data: Buffer.from([1]), isProfile: true })
  f.punchPhotos.push({ id: "other", staffId: "s2", logId: null, takenAt: new Date(2026, 5, 2), data: Buffer.from([1]), isProfile: false })
  holder.client = f.client
})

describe("GET /api/staff/[id]/photos", () => {
  it("answers 401 without a session", async () => {
    session.mockResolvedValue(null)
    expect((await call()).status).toBe(401)
  })

  it("lists newest first, default 20, without bytes, profile rows or other staff", async () => {
    const body = await (await call()).json()
    expect(body).toHaveLength(20)
    expect(body[0].id).toBe("p60")
    expect(body[1].id).toBe("p59")
    expect(Object.keys(body[0]).sort()).toEqual(["id", "takenAt"])
  })

  it.each([
    ["?limit=5", 5],
    ["?limit=999", 50],
    ["?limit=0", 1],
    ["?limit=-4", 1],
    ["?limit=abc", 20],
    ["?limit=", 20],
  ])("clamps %s to %i", async (qs, n) => {
    expect(await (await call(qs)).json()).toHaveLength(n)
  })

  it("answers 404 for an unknown teacher", async () => {
    expect((await call("", "ghost")).status).toBe(404)
  })
})
