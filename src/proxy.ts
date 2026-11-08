import { withAuth, type NextRequestWithAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export function proxyHandler(req: NextRequestWithAuth) {
  const token = req.nextauth?.token
  const pathname = req.nextUrl?.pathname || ""

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
}

export default withAuth(
  proxyHandler,
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - api/attendance (attendance sync)
     * - iclock (Hardware sync endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (public login page)
     */
    "/((?!api/auth|api/attendance|iclock|_next/static|_next/image|favicon.ico|login).*)",
  ],
}
