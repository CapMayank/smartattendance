import { beforeEach, describe, expect, it, vi } from "vitest"
import { createFakePrisma } from "@/test-utils/fake-prisma"

const holder = vi.hoisted(() => ({ client: null as unknown }))
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client
  },
}))

import { runPhotoCleanup } from "@/lib/photo-retention"

const NOW = new Date("2026-11-07T12:00:00Z")
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000)
const staff = (id: string, profilePhotoId: string | null = null) => ({
  id,
  name: id,
  shiftId: null,
  shift: null,
  profilePhotoId,
})

function setup(opts: { policy?: Record<string, unknown> | null; staff?: ReturnType<typeof staff>[] } = {}) {
  const f = createFakePrisma({
    staff: opts.staff ?? [],
    policy: opts.policy === undefined ? { id: "p1", photoCleanupRanAt: null } : opts.policy,
    holidays: [],
    lockedPayrolls: [],
    logs: [],
  })
  holder.client = f.client
  const add = (id: string, o: { takenAt: Date; isProfile?: boolean; createdAt?: Date; staffId?: string }) =>
    f.punchPhotos.push({
      id,
      staffId: o.staffId ?? "s1",
      logId: null,
      takenAt: o.takenAt,
      data: Buffer.from([0xff, 0xd8]),
      isProfile: o.isProfile ?? false,
      createdAt: o.createdAt ?? o.takenAt,
    })
  return { f, add, ids: () => f.punchPhotos.map((p) => p.id).sort() }
}

beforeEach(() => {
  holder.client = null
})

describe("runPhotoCleanup", () => {
  it("deletes old non-profile rows and keeps young ones", async () => {
    const t = setup()
    t.add("old", { takenAt: daysAgo(91) })
    t.add("young", { takenAt: daysAgo(89) })
    expect(await runPhotoCleanup(NOW)).toEqual({ ran: true, deleted: 1 })
    expect(t.ids()).toEqual(["young"])
  })

  it("keeps a referenced profile copy, even when very old", async () => {
    const t = setup({ staff: [staff("s1", "prof")] })
    t.add("prof", { takenAt: daysAgo(400), isProfile: true, createdAt: daysAgo(400) })
    expect(await runPhotoCleanup(NOW)).toEqual({ ran: true, deleted: 0 })
    expect(t.ids()).toEqual(["prof"])
  })

  it("deletes an orphan profile copy older than 1 day, keeps a fresh orphan", async () => {
    const t = setup({ staff: [staff("s1", null)] })
    t.add("orphan-old", { takenAt: daysAgo(5), isProfile: true, createdAt: daysAgo(2) })
    t.add("orphan-new", { takenAt: daysAgo(5), isProfile: true, createdAt: new Date(NOW.getTime() - 3600000) })
    expect(await runPhotoCleanup(NOW)).toEqual({ ran: true, deleted: 1 })
    expect(t.ids()).toEqual(["orphan-new"])
  })

  it("a second call inside 6 hours returns ran:false and deletes nothing", async () => {
    const t = setup()
    t.add("old1", { takenAt: daysAgo(100) })
    await runPhotoCleanup(NOW)
    t.add("old2", { takenAt: daysAgo(100) })
    const later = new Date(NOW.getTime() + 5 * 3600000)
    expect(await runPhotoCleanup(later)).toEqual({ ran: false, deleted: 0 })
    expect(t.ids()).toEqual(["old2"])
    const after = new Date(NOW.getTime() + 6 * 3600000 + 1)
    expect(await runPhotoCleanup(after)).toEqual({ ran: true, deleted: 1 })
  })

  it("claims the policy marker, creating the policy row when none exists", async () => {
    const a = setup({ policy: null })
    await runPhotoCleanup(NOW)
    expect(a.f.policyWrites).toEqual([{ op: "create", data: { photoCleanupRanAt: NOW } }])
    const b = setup()
    await runPhotoCleanup(NOW)
    expect(b.f.policyWrites).toEqual([{ op: "update", data: { photoCleanupRanAt: NOW } }])
  })

  it("two overlapping calls: only one runs", async () => {
    setup()
    const r = await Promise.all([runPhotoCleanup(NOW), runPhotoCleanup(NOW)])
    expect(r.filter((x) => x.ran)).toHaveLength(1)
  })
})
