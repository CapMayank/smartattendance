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
vi.mock("@/lib/attendance", () => ({ recalculateAttendance: vi.fn() }))

import { getServerSession } from "next-auth/next"
import { GET } from "./route"

const session = vi.mocked(getServerSession)
const at = (hhmm: string) => new Date(`2026-11-06T${hhmm}:00`)
const get = (qs = "staffId=s1&date=2026-11-06") => GET(new Request(`http://localhost/api/punches?${qs}`))

type Log = { id: string; staffId: string; timestamp: Date; type: string }
let fake: ReturnType<typeof createFakePrisma>

function seed(logs: Log[]) {
  fake = createFakePrisma({ staff: [], policy: null, holidays: [], lockedPayrolls: [], logs })
  holder.client = fake.client
}

beforeEach(() => {
  session.mockResolvedValue({ user: { id: "u1" } } as never)
  seed([])
})

describe("GET /api/punches", () => {
  it("answers 401 without a session", async () => {
    session.mockResolvedValue(null)
    expect((await get()).status).toBe(401)
  })

  it("answers 400 without staffId or date", async () => {
    expect((await get("staffId=s1")).status).toBe(400)
  })

  it("adds photoId to each log, null when the punch has no photo", async () => {
    seed([
      { id: "l1", staffId: "s1", timestamp: at("09:00"), type: "IN" },
      { id: "l2", staffId: "s1", timestamp: at("17:00"), type: "OUT" },
    ])
    fake.punchPhotos.push({ id: "ph1", staffId: "s1", logId: "l1", takenAt: at("09:00"), data: Buffer.from([0xff, 0xd8, 9]), isProfile: false })

    const body = await (await get()).json()
    expect(body).toEqual([
      { id: "l1", staffId: "s1", timestamp: at("09:00").toISOString(), type: "IN", photoId: "ph1" },
      { id: "l2", staffId: "s1", timestamp: at("17:00").toISOString(), type: "OUT", photoId: null },
    ])
  })

  it("returns exactly the log fields plus photoId, never the nested photo object", async () => {
    seed([{ id: "l1", staffId: "s1", timestamp: at("09:00"), type: "IN" }])
    fake.punchPhotos.push({ id: "ph1", staffId: "s1", logId: "l1", takenAt: at("09:00"), data: Buffer.from([0xff, 0xd8, 9]), isProfile: false })

    const [row] = await (await get()).json()
    expect(Object.keys(row).sort()).toEqual(["id", "photoId", "staffId", "timestamp", "type"])
  })

  it("asks Prisma only for the photo id", async () => {
    seed([{ id: "l1", staffId: "s1", timestamp: at("09:00"), type: "IN" }])
    const client = fake.client as { attendanceLog: { findMany: (a: unknown) => Promise<unknown> } }
    const spy = vi.spyOn(client.attendanceLog, "findMany")
    await get()
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ include: { photo: { select: { id: true } } } }))
  })

  it("keeps the IN/OUT remapping for machine punches that are all IN", async () => {
    seed([
      { id: "l1", staffId: "s1", timestamp: at("09:00"), type: "IN" },
      { id: "l2", staffId: "s1", timestamp: at("13:00"), type: "IN" },
      { id: "l3", staffId: "s1", timestamp: at("17:00"), type: "IN" },
    ])
    fake.punchPhotos.push({ id: "ph3", staffId: "s1", logId: "l3", takenAt: at("17:00"), data: Buffer.from([1]), isProfile: false })

    const body = await (await get()).json()
    expect(body.map((l: { type: string; photoId: string | null }) => [l.type, l.photoId])).toEqual([
      ["IN", null],
      ["OUT", null],
      ["OUT", "ph3"],
    ])
  })

  it("maps a single OUT-less punch to IN and keeps its photoId", async () => {
    seed([{ id: "l1", staffId: "s1", timestamp: at("09:00"), type: "CHECK" }])
    fake.punchPhotos.push({ id: "ph1", staffId: "s1", logId: "l1", takenAt: at("09:00"), data: Buffer.from([1]), isProfile: false })
    const body = await (await get()).json()
    expect(body).toEqual([{ id: "l1", staffId: "s1", timestamp: at("09:00").toISOString(), type: "IN", photoId: "ph1" }])
  })
})
