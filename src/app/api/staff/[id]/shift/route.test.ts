import { beforeAll, describe, expect, it, vi } from "vitest"
import { ensureSchoolTimezone } from "@/lib/timezone"
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

beforeAll(() => {
  ensureSchoolTimezone()
})

function setup() {
  const f = createFakePrisma({
    staff: [{ id: "A", name: "A", shiftId: null, shift: null }],
    policy: null,
    holidays: [],
    lockedPayrolls: [],
    logs: [],
  })
  holder.client = f.client
  return f
}

async function post(body: Record<string, unknown>) {
  const request = new Request("http://localhost/api/staff/A/shift", { method: "POST", body: JSON.stringify(body) })
  return POST(request, { params: Promise.resolve({ id: "A" }) })
}

describe("POST /api/staff/[id]/shift", () => {
  it("returns 400 for a start date before 2000-01-01 and writes nothing", async () => {
    const f = setup()
    const res = await post({ shiftId: null, effectiveFrom: "1999-12-31" })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "Start date must be on or after 2000-01-01" })
    expect(f.assignments).toEqual([])
  })

  it("returns 400 for a dryRun that is not a boolean and writes nothing", async () => {
    const f = setup()
    const res = await post({ shiftId: null, effectiveFrom: "2026-11-02", dryRun: "yes" })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "dryRun must be a boolean" })
    expect(f.assignments).toEqual([])
  })
})
