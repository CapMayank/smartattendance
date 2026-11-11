import { describe, expect, it, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import type { User as NextAuthUser } from "next-auth"

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    staff: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}))

import { authOptions } from "./auth"

describe("authOptions credentials authorize & callbacks", () => {
  const provider = authOptions.providers[0] as any
  const authorize = provider.options?.authorize ?? provider.authorize

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("empty database bootstrap", () => {
    it("does not create a default admin unless DEFAULT_ADMIN_PASSWORD is configured", async () => {
      delete process.env.DEFAULT_ADMIN_PASSWORD
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const user = await authorize({ identifier: "admin@example.com", password: "admin" })

      expect(user).toBeNull()
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it("creates default admin and returns user object when DB has 0 users", async () => {
      process.env.DEFAULT_ADMIN_PASSWORD = "admin"
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.user.create.mockResolvedValue({
        id: "admin-1",
        name: "Super Admin",
        email: "admin@example.com",
        role: "ADMIN",
        staffId: null,
        mustChangePassword: false,
      })

      const user = await authorize({
        identifier: "admin@example.com",
        password: "admin",
      })

      expect(user).toEqual({
        id: "admin-1",
        name: "Super Admin",
        email: "admin@example.com",
        role: "ADMIN",
        staffId: null,
        employeeCode: null,
        mustChangePassword: false,
      })
      expect(mockPrisma.user.create).toHaveBeenCalled()
      delete process.env.DEFAULT_ADMIN_PASSWORD
    })
  })

  describe("email authentication", () => {
    it("authorizes user with matching email and bcrypt password", async () => {
      mockPrisma.user.count.mockResolvedValue(5)
      const hashedPassword = await bcrypt.hash("secret123", 10)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u-1",
        name: "Test Admin",
        email: "admin@test.com",
        password: hashedPassword,
        role: "ADMIN",
        staffId: null,
        staff: null,
        disabledAt: null,
        mustChangePassword: false,
      })

      const user = await authorize({
        identifier: "Admin@Test.COM", // tests normalization
        password: "secret123",
      })

      expect(user).toEqual({
        id: "u-1",
        name: "Test Admin",
        email: "admin@test.com",
        role: "ADMIN",
        staffId: null,
        employeeCode: null,
        mustChangePassword: false,
      })
    })

    it("supports legacy SHA-256 password upgrade", async () => {
      mockPrisma.user.count.mockResolvedValue(5)
      const legacySha256 = crypto.createHash("sha256").update("oldPass456").digest("hex")
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u-legacy",
        name: "Legacy User",
        email: "legacy@test.com",
        password: legacySha256,
        role: "APPROVER",
        staffId: "s-legacy",
        staff: { id: "s-legacy", employeeCode: "SAR-2024-099", employmentPeriods: [] },
        disabledAt: null,
        mustChangePassword: true,
      })
      mockPrisma.user.update.mockResolvedValue({})

      const user = await authorize({
        identifier: "legacy@test.com",
        password: "oldPass456",
      })

      expect(user).toMatchObject({
        id: "u-legacy",
        email: "legacy@test.com",
        role: "APPROVER",
        staffId: "s-legacy",
        employeeCode: "SAR-2024-099",
        mustChangePassword: true,
      })
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u-legacy" },
        })
      )
    })

    it("rejects invalid password", async () => {
      mockPrisma.user.count.mockResolvedValue(5)
      const hashedPassword = await bcrypt.hash("secret123", 10)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u-1",
        email: "admin@test.com",
        password: hashedPassword,
        role: "ADMIN",
        disabledAt: null,
      })

      const user = await authorize({
        identifier: "admin@test.com",
        password: "wrongpassword",
      })

      expect(user).toBeNull()
    })

    it("rejects disabled user", async () => {
      mockPrisma.user.count.mockResolvedValue(5)
      const hashedPassword = await bcrypt.hash("secret123", 10)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u-disabled",
        email: "disabled@test.com",
        password: hashedPassword,
        role: "EMPLOYEE",
        disabledAt: new Date("2026-11-01T00:00:00Z"),
      })

      const user = await authorize({
        identifier: "disabled@test.com",
        password: "secret123",
      })

      expect(user).toBeNull()
    })

    it("rejects employee whose employment period has ended", async () => {
      mockPrisma.user.count.mockResolvedValue(5)
      const hashedPassword = await bcrypt.hash("secret123", 10)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "u-exited",
        email: "exited@test.com",
        password: hashedPassword,
        role: "EMPLOYEE",
        staffId: "s-exited",
        staff: {
          id: "s-exited",
          employeeCode: "SAR-2024-001",
          employmentPeriods: [
            { id: "ep-1", staffId: "s-exited", startDate: "2024-01-01", endDate: "2024-06-30" },
          ],
        },
        disabledAt: null,
      })

      const user = await authorize({
        identifier: "exited@test.com",
        password: "secret123",
      })

      expect(user).toBeNull()
    })
  })

  describe("employee code authentication", () => {
    it("authorizes user with employee code (normalized from sar2024010)", async () => {
      mockPrisma.user.count.mockResolvedValue(5)
      const hashedPassword = await bcrypt.hash("mypassword", 10)
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s-10",
        employeeCode: "SAR-2024-010",
        user: {
          id: "u-10",
          name: "John Staff",
          email: "john@test.com",
          password: hashedPassword,
          role: "EMPLOYEE",
          staffId: "s-10",
          disabledAt: null,
          mustChangePassword: false,
        },
        employmentPeriods: [
          { id: "ep-1", staffId: "s-10", startDate: "2024-01-01", endDate: null },
        ],
      })

      const user = await authorize({
        identifier: "sar2024010", // input without hyphens, lowercase
        password: "mypassword",
      })

      expect(mockPrisma.staff.findUnique).toHaveBeenCalledWith({
        where: { employeeCode: "SAR-2024-010" },
        include: { user: true, employmentPeriods: true },
      })
      expect(user).toEqual({
        id: "u-10",
        name: "John Staff",
        email: "john@test.com",
        role: "EMPLOYEE",
        staffId: "s-10",
        employeeCode: "SAR-2024-010",
        mustChangePassword: false,
      })
    })

    it("rejects employee code when staff has no linked user", async () => {
      mockPrisma.user.count.mockResolvedValue(5)
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s-no-user",
        employeeCode: "SAR-2024-011",
        user: null,
        employmentPeriods: [],
      })

      const user = await authorize({
        identifier: "SAR-2024-011",
        password: "any",
      })

      expect(user).toBeNull()
    })

    it("rejects employee code when linked user is disabled", async () => {
      mockPrisma.user.count.mockResolvedValue(5)
      const hashedPassword = await bcrypt.hash("pass", 10)
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s-12",
        employeeCode: "SAR-2024-012",
        user: {
          id: "u-12",
          password: hashedPassword,
          role: "EMPLOYEE",
          disabledAt: new Date("2026-11-01"),
        },
        employmentPeriods: [],
      })

      const user = await authorize({
        identifier: "SAR-2024-012",
        password: "pass",
      })

      expect(user).toBeNull()
    })

    it("rejects employee code when employment period has ended", async () => {
      mockPrisma.user.count.mockResolvedValue(5)
      const hashedPassword = await bcrypt.hash("pass", 10)
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s-13",
        employeeCode: "SAR-2024-013",
        user: {
          id: "u-13",
          password: hashedPassword,
          role: "EMPLOYEE",
          disabledAt: null,
        },
        employmentPeriods: [
          { id: "ep-past", staffId: "s-13", startDate: "2024-01-01", endDate: "2024-05-31" },
        ],
      })

      const user = await authorize({
        identifier: "SAR-2024-013",
        password: "pass",
      })

      expect(user).toBeNull()
    })
  })

  describe("NextAuth callbacks", () => {
    it("jwt callback copies user properties into token", async () => {
      const jwtCallback = authOptions.callbacks!.jwt!
      const user: NextAuthUser = {
        id: "u-test",
        name: "Test User",
        email: "test@example.com",
        role: "APPROVER",
        staffId: "s-test",
        employeeCode: "SAR-2024-050",
        mustChangePassword: true,
      }
      const token = await jwtCallback({ token: {}, user, account: null })

      expect(token).toEqual({
        id: "u-test",
        role: "APPROVER",
        staffId: "s-test",
        employeeCode: "SAR-2024-050",
        mustChangePassword: true,
        revoked: false,
      })
    })

    it("jwt callback refreshes role and password flag from the database on later calls", async () => {
      const jwtCallback = authOptions.callbacks!.jwt!
      mockPrisma.user.findUnique.mockResolvedValue({
        role: "EMPLOYEE",
        disabledAt: null,
        mustChangePassword: false,
        staffId: "s-test",
        staff: { id: "s-test", employeeCode: "SAR-2024-050", employmentPeriods: [] },
      })

      const token = await jwtCallback({
        token: { id: "u-test", role: "ADMIN", mustChangePassword: true },
        // A browser-supplied update must never be trusted over the database
        trigger: "update",
        session: { mustChangePassword: false, role: "ADMIN" },
      } as never)

      expect(token.role).toBe("EMPLOYEE")
      expect(token.mustChangePassword).toBe(false)
      expect(token.revoked).toBe(false)
    })

    it("jwt callback revokes the token of a disabled or deleted account", async () => {
      const jwtCallback = authOptions.callbacks!.jwt!

      mockPrisma.user.findUnique.mockResolvedValue({
        role: "ADMIN",
        disabledAt: new Date(),
        mustChangePassword: false,
        staffId: null,
        staff: null,
      })
      expect((await jwtCallback({ token: { id: "u-test", role: "ADMIN" } } as never)).revoked).toBe(true)

      mockPrisma.user.findUnique.mockResolvedValue(null)
      expect((await jwtCallback({ token: { id: "u-test", role: "ADMIN" } } as never)).revoked).toBe(true)
    })

    it("jwt callback revokes a non-admin whose employment has ended", async () => {
      const jwtCallback = authOptions.callbacks!.jwt!
      mockPrisma.user.findUnique.mockResolvedValue({
        role: "EMPLOYEE",
        disabledAt: null,
        mustChangePassword: false,
        staffId: "s-test",
        staff: {
          id: "s-test",
          employeeCode: "SAR-2024-050",
          employmentPeriods: [{ startDate: "2020-01-01", endDate: "2020-12-31" }],
        },
      })
      expect((await jwtCallback({ token: { id: "u-test", role: "EMPLOYEE" } } as never)).revoked).toBe(true)
    })

    it("session callback returns no user for a revoked token", async () => {
      const sessionCallback = authOptions.callbacks!.session!
      const result = await sessionCallback({
        session: { user: { name: "X" }, expires: "2099-01-01" },
        token: { id: "u-test", revoked: true },
      } as never)
      expect((result as { user?: unknown }).user).toBeUndefined()
    })

    it("session callback attaches token claims to session.user", async () => {
      const sessionCallback = authOptions.callbacks!.session!
      const session = {
        user: {
          name: "Test User",
          email: "test@example.com",
        },
        expires: "2026-12-01",
      } as any
      const token = {
        id: "u-test",
        role: "EMPLOYEE",
        staffId: "s-test",
        employeeCode: "SAR-2024-050",
        mustChangePassword: true,
      } as any

      const result = await (sessionCallback as any)({ session, token })

      expect(result.user).toEqual({
        name: "Test User",
        email: "test@example.com",
        id: "u-test",
        role: "EMPLOYEE",
        staffId: "s-test",
        employeeCode: "SAR-2024-050",
        mustChangePassword: true,
      })
    })

    it("redirect callback returns relative URL directly without prefixing server IP baseUrl", async () => {
      const redirectCallback = authOptions.callbacks!.redirect!
      const result = await redirectCallback({ url: "/login", baseUrl: "http://132.145.12.34:3000" })
      expect(result).toBe("/login")
    })
  })
})
