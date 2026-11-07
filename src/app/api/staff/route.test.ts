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

import { GET } from "./route"

describe("GET /api/staff hasPhoto", () => {
  it("is false when profilePhotoId is undefined or null and true when set", async () => {
    const f = createFakePrisma({
      staff: [
        { id: "A", name: "A", machineId: "1", shiftId: null, shift: null },
        { id: "B", name: "B", machineId: "2", shiftId: null, shift: null, profilePhotoId: null },
        { id: "C", name: "C", machineId: "3", shiftId: null, shift: null, profilePhotoId: "p1" },
      ],
      policy: null,
      holidays: [],
      lockedPayrolls: [],
      logs: [],
    })
    holder.client = f.client
    const res = await GET()
    const body = (await res.json()) as { id: string; hasPhoto: boolean }[]
    expect(body.map((s) => [s.id, s.hasPhoto])).toEqual([
      ["A", false],
      ["B", false],
      ["C", true],
    ])
  })
})
