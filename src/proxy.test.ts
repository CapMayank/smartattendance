import { describe, expect, it } from "vitest"
import { proxyHandler } from "./proxy"
import type { NextRequestWithAuth } from "next-auth/middleware"

describe("proxyHandler", () => {
  it("allows access when token.mustChangePassword is false or undefined", () => {
    const req = {
      nextauth: { token: { id: "u-1", mustChangePassword: false } },
      nextUrl: { pathname: "/dashboard" },
      url: "http://localhost:3000/dashboard",
    } as unknown as NextRequestWithAuth

    const response = proxyHandler(req)
    expect(response).toBeUndefined()
  })

  it("redirects to /change-password when token.mustChangePassword is true on regular pages", () => {
    const req = {
      nextauth: { token: { id: "u-1", mustChangePassword: true } },
      nextUrl: { pathname: "/dashboard" },
      url: "http://localhost:3000/dashboard",
    } as unknown as NextRequestWithAuth

    const response = proxyHandler(req)
    expect(response?.status).toBe(307)
    expect(response?.headers.get("location")).toBe("http://localhost:3000/change-password")
  })

  it("allows /change-password when token.mustChangePassword is true", () => {
    const req = {
      nextauth: { token: { id: "u-1", mustChangePassword: true } },
      nextUrl: { pathname: "/change-password" },
      url: "http://localhost:3000/change-password",
    } as unknown as NextRequestWithAuth

    const response = proxyHandler(req)
    expect(response).toBeUndefined()
  })

  it("allows /api/auth/* and /_next/* when token.mustChangePassword is true", () => {
    const reqAuth = {
      nextauth: { token: { id: "u-1", mustChangePassword: true } },
      nextUrl: { pathname: "/api/auth/session" },
      url: "http://localhost:3000/api/auth/session",
    } as unknown as NextRequestWithAuth
    expect(proxyHandler(reqAuth)).toBeUndefined()

    const reqNext = {
      nextauth: { token: { id: "u-1", mustChangePassword: true } },
      nextUrl: { pathname: "/_next/data/test.json" },
      url: "http://localhost:3000/_next/data/test.json",
    } as unknown as NextRequestWithAuth
    expect(proxyHandler(reqNext)).toBeUndefined()
  })
})
