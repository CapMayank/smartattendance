import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

import { getServerSession } from "next-auth/next"
import { POST } from "./route"

const sessionMock = vi.mocked(getServerSession)

describe("POST /api/auth/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not signed in", async () => {
    sessionMock.mockResolvedValue(null)
    const res = await POST(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: "oldPassword123", newPassword: "newPassword456" }),
      })
    )
    expect(res.status).toBe(401)
  })

  it("returns 400 when newPassword is shorter than 8 characters or matches currentPassword", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u-1" } } as never)

    const shortRes = await POST(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: "oldPassword123", newPassword: "short" }),
      })
    )
    expect(shortRes.status).toBe(400)

    const sameRes = await POST(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: "samePassword123", newPassword: "samePassword123" }),
      })
    )
    expect(sameRes.status).toBe(400)
  })

  it("returns 400 when currentPassword is incorrect", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u-1" } } as never)
    const oldHash = await bcrypt.hash("correctOldPass", 10)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      password: oldHash,
      disabledAt: null,
    })

    const res = await POST(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: "wrongOldPass", newPassword: "newStrongPassword123" }),
      })
    )
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/Current password is incorrect/i)
  })

  it("updates password hash, clears mustChangePassword, and writes an audit log", async () => {
    sessionMock.mockResolvedValue({ user: { id: "u-1" } } as never)
    const oldHash = await bcrypt.hash("TempPass99", 10)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-1",
      password: oldHash,
      disabledAt: null,
      mustChangePassword: true,
    })
    mockPrisma.user.update.mockResolvedValue({ id: "u-1", mustChangePassword: false })
    mockPrisma.auditLog.create.mockResolvedValue({ id: "al-1" })

    const res = await POST(
      new Request("http://localhost/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: "TempPass99", newPassword: "MyNewSecurePass2026" }),
      })
    )
    expect(res.status).toBe(200)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "u-1" },
      data: expect.objectContaining({
        mustChangePassword: false,
        password: expect.stringMatching(/^\$2[aby]\$/),
      }),
    })
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "u-1",
        action: "PASSWORD_CHANGE",
        targetType: "User",
        targetId: "u-1",
      }),
    })
  })
})
