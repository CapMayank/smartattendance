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
const call = (id: string) => GET(new Request(`http://localhost/api/photos/${id}`), { params: Promise.resolve({ id }) })

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "u1" } } as never)
  const f = createFakePrisma({ staff: [], policy: null, holidays: [], lockedPayrolls: [], logs: [] })
  f.punchPhotos.push({ id: "p1", staffId: "s1", logId: null, takenAt: new Date(), data: Buffer.from([0xff, 0xd8, 1, 2]), isProfile: false })
  holder.client = f.client
})

describe("GET /api/photos/[id]", () => {
  it("answers 401 without a session", async () => {
    session.mockResolvedValue(null)
    expect((await call("p1")).status).toBe(401)
  })

  it("returns the JPEG bytes with image headers", async () => {
    const res = await call("p1")
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/jpeg")
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=86400")
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([0xff, 0xd8, 1, 2])
  })

  it("answers 404 for a missing photo", async () => {
    expect((await call("nope")).status).toBe(404)
  })
})
