import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequestWithAuth } from "next-auth/middleware"

vi.mock("@/lib/setup", () => ({
  isSetupCompleted: vi.fn(),
}))

import { isSetupCompleted } from "@/lib/setup"
import { proxyHandler } from "./proxy"

const mockIsSetupCompleted = vi.mocked(isSetupCompleted)

describe("proxyHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default setup to completed for normal auth testing
    mockIsSetupCompleted.mockResolvedValue(true)
  })

  describe("setup gating", () => {
    it("redirects to /setup when setup is incomplete (setup-completed cookie is false)", async () => {
      const req = {
        nextauth: { token: { id: "u-1" } },
        nextUrl: { pathname: "/dashboard" },
        url: "http://localhost:3000/dashboard",
        cookies: {
          get: (key: string) => (key === "setup-completed" ? { value: "false" } : undefined),
        },
      } as unknown as NextRequestWithAuth

      const response = await proxyHandler(req)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toBe("http://localhost:3000/setup")
    })

    it("redirects to /setup when cookie is absent and isSetupCompleted returns false", async () => {
      mockIsSetupCompleted.mockResolvedValue(false)

      const req = {
        nextauth: { token: { id: "u-1" } },
        nextUrl: { pathname: "/dashboard" },
        url: "http://localhost:3000/dashboard",
        cookies: {
          get: () => undefined,
        },
      } as unknown as NextRequestWithAuth

      const response = await proxyHandler(req)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toBe("http://localhost:3000/setup")
    })

    it("allows access to /setup when setup is incomplete", async () => {
      mockIsSetupCompleted.mockResolvedValue(false)

      const req = {
        nextauth: { token: null },
        nextUrl: { pathname: "/setup" },
        url: "http://localhost:3000/setup",
        cookies: {
          get: () => undefined,
        },
      } as unknown as NextRequestWithAuth

      const response = await proxyHandler(req)
      expect(response).toBeUndefined()
    })

    it("redirects to / when user accesses /setup and setup is already complete", async () => {
      mockIsSetupCompleted.mockResolvedValue(true)

      const req = {
        nextauth: { token: { id: "u-admin" } },
        nextUrl: { pathname: "/setup" },
        url: "http://localhost:3000/setup",
        cookies: {
          get: (key: string) => (key === "setup-completed" ? { value: "true" } : undefined),
        },
      } as unknown as NextRequestWithAuth

      const response = await proxyHandler(req)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toBe("http://localhost:3000/")
    })

    it("allows exempt endpoints without setup checks", async () => {
      mockIsSetupCompleted.mockResolvedValue(false)

      const exemptPaths = [
        "/api/auth/session",
        "/api/setup",
        "/iclock/cdata",
        "/_next/data/app.json",
        "/favicon.ico",
      ]

      for (const pathname of exemptPaths) {
        const req = {
          nextauth: { token: null },
          nextUrl: { pathname },
          url: `http://localhost:3000${pathname}`,
          cookies: { get: () => undefined },
        } as unknown as NextRequestWithAuth

        const response = await proxyHandler(req)
        expect(response).toBeUndefined()
      }
    })
  })

  describe("password change gating", () => {
    it("allows access when token.mustChangePassword is false or undefined", async () => {
      const req = {
        nextauth: { token: { id: "u-1", mustChangePassword: false } },
        nextUrl: { pathname: "/dashboard" },
        url: "http://localhost:3000/dashboard",
        cookies: {
          get: (key: string) => (key === "setup-completed" ? { value: "true" } : undefined),
        },
      } as unknown as NextRequestWithAuth

      const response = await proxyHandler(req)
      expect(response).toBeUndefined()
    })

    it("redirects to /change-password when token.mustChangePassword is true on regular pages", async () => {
      const req = {
        nextauth: { token: { id: "u-1", mustChangePassword: true } },
        nextUrl: { pathname: "/dashboard" },
        url: "http://localhost:3000/dashboard",
        cookies: {
          get: (key: string) => (key === "setup-completed" ? { value: "true" } : undefined),
        },
      } as unknown as NextRequestWithAuth

      const response = await proxyHandler(req)
      expect(response?.status).toBe(307)
      expect(response?.headers.get("location")).toBe("http://localhost:3000/change-password")
    })

    it("allows /change-password when token.mustChangePassword is true", async () => {
      const req = {
        nextauth: { token: { id: "u-1", mustChangePassword: true } },
        nextUrl: { pathname: "/change-password" },
        url: "http://localhost:3000/change-password",
        cookies: {
          get: (key: string) => (key === "setup-completed" ? { value: "true" } : undefined),
        },
      } as unknown as NextRequestWithAuth

      const response = await proxyHandler(req)
      expect(response).toBeUndefined()
    })

    it("allows /api/auth/* and /_next/* when token.mustChangePassword is true", async () => {
      const reqAuth = {
        nextauth: { token: { id: "u-1", mustChangePassword: true } },
        nextUrl: { pathname: "/api/auth/session" },
        url: "http://localhost:3000/api/auth/session",
      } as unknown as NextRequestWithAuth
      expect(await proxyHandler(reqAuth)).toBeUndefined()

      const reqNext = {
        nextauth: { token: { id: "u-1", mustChangePassword: true } },
        nextUrl: { pathname: "/_next/data/test.json" },
        url: "http://localhost:3000/_next/data/test.json",
      } as unknown as NextRequestWithAuth
      expect(await proxyHandler(reqNext)).toBeUndefined()
    })
  })

  describe("employee role page gating", () => {
    it("redirects EMPLOYEE users away from admin-only pages to /", async () => {
      const adminPaths = ["/staff", "/payroll/monthly", "/settings", "/devices", "/attendance/manual", "/audit-logs"]
      for (const pathname of adminPaths) {
        const req = {
          nextauth: { token: { id: "u-emp", role: "EMPLOYEE", mustChangePassword: false } },
          nextUrl: { pathname },
          url: `http://localhost:3000${pathname}`,
          cookies: {
            get: (key: string) => (key === "setup-completed" ? { value: "true" } : undefined),
          },
        } as unknown as NextRequestWithAuth

        const response = await proxyHandler(req)
        expect(response?.status).toBe(307)
        expect(response?.headers.get("location")).toBe("http://localhost:3000/")
      }
    })

    it("allows EMPLOYEE users to access / and /change-password", async () => {
      for (const pathname of ["/", "/change-password"]) {
        const req = {
          nextauth: { token: { id: "u-emp", role: "EMPLOYEE", mustChangePassword: false } },
          nextUrl: { pathname },
          url: `http://localhost:3000${pathname}`,
          cookies: {
            get: (key: string) => (key === "setup-completed" ? { value: "true" } : undefined),
          },
        } as unknown as NextRequestWithAuth

        const response = await proxyHandler(req)
        expect(response).toBeUndefined()
      }
    })
  })

  describe("approver role page gating", () => {
    it("redirects APPROVER users away from admin-only pages to /", async () => {
      const adminOnlyPaths = [
        "/staff",
        "/payroll/monthly",
        "/settings",
        "/devices",
        "/attendance/manual",
        "/punches/unmatched",
        "/reports/member-payroll",
        "/reports/payroll-analytics",
        "/audit-logs",
      ]
      for (const pathname of adminOnlyPaths) {
        const req = {
          nextauth: { token: { id: "u-app", role: "APPROVER", mustChangePassword: false } },
          nextUrl: { pathname },
          url: `http://localhost:3000${pathname}`,
          cookies: {
            get: (key: string) => (key === "setup-completed" ? { value: "true" } : undefined),
          },
        } as unknown as NextRequestWithAuth

        const response = await proxyHandler(req)
        expect(response?.status).toBe(307)
        expect(response?.headers.get("location")).toBe("http://localhost:3000/")
      }
    })

    it("allows APPROVER users to access attendance reports, calendar, and shifts", async () => {
      for (const pathname of ["/", "/reports", "/reports/member-attendance", "/calendar", "/shifts"]) {
        const req = {
          nextauth: { token: { id: "u-app", role: "APPROVER", mustChangePassword: false } },
          nextUrl: { pathname },
          url: `http://localhost:3000${pathname}`,
          cookies: {
            get: (key: string) => (key === "setup-completed" ? { value: "true" } : undefined),
          },
        } as unknown as NextRequestWithAuth

        const response = await proxyHandler(req)
        expect(response).toBeUndefined()
      }
    })
  })
})
