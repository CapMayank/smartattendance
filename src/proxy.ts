import { withAuth } from "next-auth/middleware"

export default withAuth(
  function middleware(req) {
    // We can add custom logic here if needed
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token
    },
  }
)

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - api/punches (Hardware sync webhook)
     * - iclock (Hardware sync endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (public login page)
     */
    "/((?!api/auth|api/attendance|iclock|_next/static|_next/image|favicon.ico|login).*)",
  ],
}
