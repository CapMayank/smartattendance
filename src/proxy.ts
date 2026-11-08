import { withAuth, type NextRequestWithAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"
import { isSetupCompleted } from "@/lib/setup"

const EMPLOYEE_BLOCKED_PAGE_PREFIXES = [
  "/staff",
  "/users",
  "/payroll",
  "/settings",
  "/departments",
  "/designations",
  "/devices",
  "/attendance/manual",
  "/punches/unmatched",
  "/shifts",
  "/reports",
  "/calendar",
  "/audit-logs",
]

const APPROVER_BLOCKED_PAGE_PREFIXES = [
  "/staff",
  "/users",
  "/payroll",
  "/settings",
  "/departments",
  "/designations",
  "/devices",
  "/attendance/manual",
  "/punches/unmatched",
  "/reports/member-payroll",
  "/reports/payroll-analytics",
  "/audit-logs",
]

export async function proxyHandler(req: NextRequestWithAuth) {
  const pathname = req.nextUrl?.pathname || ""

  // Exempt endpoints that never require setup or auth gating
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/attendance") ||
    pathname.startsWith("/iclock") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return undefined
  }

  // 1. Determine setup status
  const setupCookie = req.cookies?.get?.("setup-completed")?.value
  let setupDone: boolean

  if (setupCookie === "true") {
    setupDone = true
  } else if (setupCookie === "false") {
    setupDone = false
  } else {
    try {
      setupDone = await isSetupCompleted()
    } catch {
      setupDone = false
    }
  }

  // 2. Setup Route Interceptions
  if (pathname.startsWith("/setup")) {
    if (setupDone) {
      // Setup is already completed; redirect away from setup wizard
      const res = NextResponse.redirect(new URL("/", req.url))
      res.cookies.set("setup-completed", "true", { path: "/" })
      return res
    }
    // Setup is pending; allow access to /setup wizard
    return undefined
  }

  // If setup is pending and user attempts to access any other page, redirect to /setup
  if (!setupDone) {
    const res = NextResponse.redirect(new URL("/setup", req.url))
    res.cookies.set("setup-completed", "false", { path: "/" })
    return res
  }

  // 3. Password Change Interception (only active once setup is completed)
  const token = req.nextauth?.token
  if (token?.mustChangePassword) {
    const isAllowed =
      pathname.startsWith("/change-password") ||
      pathname.startsWith("/api/auth") ||
      pathname.startsWith("/_next") ||
      pathname === "/login"

    if (!isAllowed) {
      return NextResponse.redirect(new URL("/change-password", req.url))
    }
  }

  // 4. Role-based Page Guard: Employees use the personal portal at `/` and `/change-password`
  if (token?.role === "EMPLOYEE" && !pathname.startsWith("/api/")) {
    const isBlockedAdminPage = EMPLOYEE_BLOCKED_PAGE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    )
    if (isBlockedAdminPage) {
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  // 5. Role-based Page Guard: Approvers cannot access Admin-only configuration, mutation, or payroll pages
  if (token?.role === "APPROVER" && !pathname.startsWith("/api/")) {
    const isBlockedForApprover = APPROVER_BLOCKED_PAGE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
    )
    if (isBlockedForApprover) {
      return NextResponse.redirect(new URL("/", req.url))
    }
  }

  return undefined
}

export default withAuth(
  proxyHandler,
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req?.nextUrl?.pathname || ""
        // Allow public access to setup wizard and login page
        if (pathname.startsWith("/setup") || pathname === "/login") {
          return true
        }
        // If setup is marked incomplete via cookie, allow proxyHandler to handle the redirect
        if (req?.cookies?.get?.("setup-completed")?.value === "false") {
          return true
        }
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - api/attendance (attendance sync)
     * - api/setup (bootstrap API)
     * - iclock (Hardware sync endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api/auth|api/attendance|api/setup|iclock|_next/static|_next/image|favicon.ico).*)",
  ],
}
