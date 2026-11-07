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
import { DELETE, GET, POST } from "./route"

const session = vi.mocked(getServerSession)
const ctx = (id = "s1") => ({ params: Promise.resolve({ id }) })
const url = (id = "s1") => `http://localhost/api/staff/${id}/photo`
const post = (body: unknown, id = "s1") =>
  POST(new Request(url(id), { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }), ctx(id))

type StaffState = { profilePhotoId: string | null; profilePhotoPinned: boolean }
let f: ReturnType<typeof createFakePrisma>
const staffOf = (id: string) =>
  (f.client as { staff: { findUnique: (a: unknown) => Promise<StaffState> } }).staff.findUnique({ where: { id } })
const row = (id: string, staffId: string, isProfile = false, byte = 1) => ({
  id, staffId, logId: null, takenAt: new Date(2026, 0, 5), data: Buffer.from([0xff, 0xd8, byte]), isProfile,
})

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "u1" } } as never)
  f = createFakePrisma({
    staff: [
      { id: "s1", name: "A", shiftId: null, shift: null, profilePhotoId: "oldprof", profilePhotoPinned: false },
      { id: "s2", name: "B", shiftId: null, shift: null },
    ],
    policy: null, holidays: [], lockedPayrolls: [], logs: [],
  })
  f.punchPhotos.push(row("p1", "s1", false, 7), row("oldprof", "s1", true, 9), row("p2", "s2"), row("prof2", "s2", true))
  holder.client = f.client
})

describe("GET /api/staff/[id]/photo", () => {
  it("answers 401 without a session", async () => {
    session.mockResolvedValue(null)
    expect((await GET(new Request(url()), ctx())).status).toBe(401)
  })

  it("streams the profile row with image headers", async () => {
    const res = await GET(new Request(url()), ctx())
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("image/jpeg")
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([0xff, 0xd8, 9])
  })

  it("answers 404 when there is no profile picture or no teacher", async () => {
    expect((await GET(new Request(url("s2")), ctx("s2"))).status).toBe(404)
    expect((await GET(new Request(url("ghost")), ctx("ghost"))).status).toBe(404)
  })
})

describe("POST /api/staff/[id]/photo", () => {
  it("answers 401 without a session", async () => {
    session.mockResolvedValue(null)
    expect((await post({ photoId: "p1" })).status).toBe(401)
  })

  it("copies the photo into a new profile row, pins it and removes the old profile row", async () => {
    const res = await post({ photoId: "p1" })
    expect(res.status).toBe(200)
    expect(JSON.stringify(await res.json())).not.toContain("data")
    const staff = await staffOf("s1")
    expect(staff.profilePhotoPinned).toBe(true)
    expect(staff.profilePhotoId).not.toBe("p1")
    expect(staff.profilePhotoId).not.toBe("oldprof")
    const copy = f.punchPhotos.find((p) => p.id === staff.profilePhotoId)!
    expect(copy.isProfile).toBe(true)
    expect(copy.staffId).toBe("s1")
    expect(copy.logId).toBeNull()
    expect([...copy.data]).toEqual([0xff, 0xd8, 7])
    expect(f.punchPhotos.find((p) => p.id === "p1")?.isProfile).toBe(false)
    expect(f.punchPhotos.some((p) => p.id === "oldprof")).toBe(false)
  })

  it("keeps a previous row that is not a profile copy, and other teachers' profile rows", async () => {
    await (f.client as { staff: { update: (a: unknown) => Promise<unknown> } }).staff.update({
      where: { id: "s1" },
      data: { profilePhotoId: "p1" },
    })
    expect((await post({ photoId: "p1" })).status).toBe(200)
    expect(f.punchPhotos.some((p) => p.id === "p1")).toBe(true)
    expect(f.punchPhotos.some((p) => p.id === "prof2")).toBe(true)
  })

  it.each([[{}], [{ photoId: "" }], [{ photoId: 5 }], [null], ["not json"]])("answers 400 for %j", async (body) => {
    expect((await post(body)).status).toBe(400)
  })

  it("answers 404 for another teacher's photo, a profile row or a missing photo", async () => {
    expect((await post({ photoId: "p2" })).status).toBe(404)
    expect((await post({ photoId: "oldprof" })).status).toBe(404)
    expect((await post({ photoId: "nope" })).status).toBe(404)
    expect(f.punchPhotos.some((p) => p.id === "oldprof")).toBe(true)
  })

  it("answers 404 for an unknown teacher", async () => {
    expect((await post({ photoId: "p1" }, "ghost")).status).toBe(404)
  })

  it("rolls everything back when a step fails", async () => {
    const before = f.punchPhotos.length
    const pp = (f.client as { punchPhoto: { deleteMany: unknown } }).punchPhoto
    pp.deleteMany = async () => {
      throw new Error("boom")
    }
    const res = await post({ photoId: "p1" })
    expect(res.status).toBe(500)
    expect(f.punchPhotos).toHaveLength(before)
    expect(f.punchPhotos.some((p) => p.id === "oldprof")).toBe(true)
    expect((await staffOf("s1")).profilePhotoId).toBe("oldprof")
  })
})

describe("DELETE /api/staff/[id]/photo", () => {
  const del = (id = "s1") => DELETE(new Request(url(id), { method: "DELETE" }), ctx(id))

  it("answers 401 without a session", async () => {
    session.mockResolvedValue(null)
    expect((await del()).status).toBe(401)
  })

  it("deletes the profile row, clears the pointer and unpins", async () => {
    await post({ photoId: "p1" })
    const res = await del()
    expect(res.status).toBe(200)
    const staff = await staffOf("s1")
    expect(staff.profilePhotoId).toBeNull()
    expect(staff.profilePhotoPinned).toBe(false)
    expect(f.punchPhotos.filter((p) => p.staffId === "s1" && p.isProfile)).toHaveLength(0)
    expect(f.punchPhotos.some((p) => p.id === "p1")).toBe(true)
  })

  it("answers 404 for an unknown teacher", async () => {
    expect((await del("ghost")).status).toBe(404)
  })
})
