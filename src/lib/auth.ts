import { AuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { normalizeLoginIdentifier } from "./employee-code"
import { isEmployedOnDate } from "./employment"
import { istDateKey } from "./dashboard-calc"

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Employee Code", type: "text", placeholder: "admin@example.com / SAR-2024-001" },
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawIdentifier = credentials?.identifier || credentials?.email
        if (!rawIdentifier || !credentials?.password) return null

        // Check if there are any users in the database
        const userCount = await prisma.user.count()
        
        // Legacy bootstrap: with an empty database, the account named by DEFAULT_ADMIN_EMAIL /
        // DEFAULT_ADMIN_PASSWORD is created on first sign-in. There is deliberately no built-in
        // password: without DEFAULT_ADMIN_PASSWORD this path is off and the first administrator
        // is created by the setup wizard instead.
        const defaultEmail = (process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com").trim().toLowerCase()
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD

        if (
          userCount === 0 &&
          defaultPassword &&
          rawIdentifier.trim().toLowerCase() === defaultEmail &&
          credentials.password === defaultPassword
        ) {
          const hash = await bcrypt.hash(defaultPassword, 10)
          const admin = await prisma.user.create({
            data: {
              name: "Super Admin",
              email: defaultEmail,
              password: hash,
              role: "ADMIN",
              mustChangePassword: false,
            },
          })
          return {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            role: "ADMIN",
            staffId: null,
            employeeCode: null,
            mustChangePassword: false,
          }
        }

        const normalized = normalizeLoginIdentifier(rawIdentifier)
        const istToday = istDateKey(new Date())

        let user: any = null
        let staffId: string | null = null
        let employeeCode: string | null = null

        if (normalized.type === "email") {
          user = await prisma.user.findUnique({
            where: { email: normalized.value },
            include: {
              staff: {
                include: {
                  employmentPeriods: true,
                },
              },
            },
          })

          if (!user) return null
          if (user.disabledAt !== null) return null

          const staff = user.staff ?? (user.staffId ? await prisma.staff.findUnique({
            where: { id: user.staffId },
            include: { employmentPeriods: true },
          }) : null)

          if (user.role !== "ADMIN" && staff) {
            const periods = staff.employmentPeriods ?? []
            if (periods.length > 0 && !isEmployedOnDate(staff, istToday)) {
              return null
            }
          }

          staffId = staff?.id ?? user.staffId ?? null
          employeeCode = staff?.employeeCode ?? null
        } else {
          // normalized.type === "code"
          const staff = await prisma.staff.findUnique({
            where: { employeeCode: normalized.value },
            include: {
              user: true,
              employmentPeriods: true,
            },
          })

          if (!staff || !staff.user) return null
          user = staff.user
          if (user.disabledAt !== null) return null

          if (user.role !== "ADMIN") {
            const periods = staff.employmentPeriods ?? []
            if (periods.length > 0 && !isEmployedOnDate(staff, istToday)) {
              return null
            }
          }

          staffId = staff.id
          employeeCode = staff.employeeCode ?? null
        }

        if (user && user.password) {
          // Check if the password is a legacy SHA-256 hash (64 hex characters)
          const isLegacyHash = /^[a-f0-9]{64}$/.test(user.password)
          
          if (isLegacyHash) {
            const legacyHash = crypto.createHash("sha256").update(credentials.password).digest("hex")
            if (user.password === legacyHash) {
              // Valid login! Silently upgrade the hash in the DB to bcrypt
              const newHash = await bcrypt.hash(credentials.password, 10)
              await prisma.user.update({
                where: { id: user.id },
                data: { password: newHash },
              })
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: (user.role as "ADMIN" | "APPROVER" | "EMPLOYEE") || "EMPLOYEE",
                staffId,
                employeeCode,
                mustChangePassword: Boolean(user.mustChangePassword),
              }
            }
          } else {
            // Standard bcrypt verification
            const isValid = await bcrypt.compare(credentials.password, user.password)
            if (isValid) {
              return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: (user.role as "ADMIN" | "APPROVER" | "EMPLOYEE") || "EMPLOYEE",
                staffId,
                employeeCode,
                mustChangePassword: Boolean(user.mustChangePassword),
              }
            }
          }
        }

        return null
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token?.revoked) {
        // The account was disabled, deleted, or its employment ended after sign-in:
        // hand back a session with no user so every caller treats it as signed out.
        return { expires: session.expires } as typeof session
      }
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as "ADMIN" | "APPROVER" | "EMPLOYEE"
        session.user.staffId = token.staffId ?? null
        session.user.employeeCode = token.employeeCode ?? null
        session.user.mustChangePassword = Boolean(token.mustChangePassword)
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.staffId = user.staffId ?? null
        token.employeeCode = user.employeeCode ?? null
        token.mustChangePassword = Boolean(user.mustChangePassword)
        token.revoked = false
        return token
      }

      // A JWT outlives changes made after sign-in. Re-read the account on every use so a
      // role change, a forced password change, or a disabled/exited account takes effect
      // immediately instead of at the next login. The database is the only source of truth:
      // values supplied by the browser through session.update() are never trusted.
      if (token.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              role: true,
              disabledAt: true,
              mustChangePassword: true,
              staffId: true,
              staff: {
                select: {
                  id: true,
                  employeeCode: true,
                  employmentPeriods: { select: { startDate: true, endDate: true } },
                },
              },
            },
          })
          const employmentEnded =
            !!dbUser &&
            dbUser.role !== "ADMIN" &&
            !!dbUser.staff &&
            dbUser.staff.employmentPeriods.length > 0 &&
            !isEmployedOnDate(dbUser.staff, istDateKey(new Date()))

          if (!dbUser || dbUser.disabledAt !== null || employmentEnded) {
            token.revoked = true
          } else {
            token.revoked = false
            token.role = dbUser.role as "ADMIN" | "APPROVER" | "EMPLOYEE"
            token.staffId = dbUser.staffId ?? null
            token.employeeCode = dbUser.staff?.employeeCode ?? null
            token.mustChangePassword = Boolean(dbUser.mustChangePassword)
          }
        } catch (error) {
          // A database hiccup must not sign everyone out: keep the last known claims.
          console.error("[auth] could not refresh session claims:", error)
        }
      }
      return token
    },
    async redirect({ url, baseUrl }) {
      // Allows relative URLs without prepending baseUrl (prevents IP address redirection)
      if (url.startsWith("/")) return url
      try {
        const parsed = new URL(url)
        if (parsed.origin === baseUrl) return `${parsed.pathname}${parsed.search}` || "/"
        return url
      } catch {
        return "/login"
      }
    },
  },
  pages: {
    signIn: "/login",
  },
}
