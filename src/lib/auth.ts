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
        
        // If DB is empty, use default and auto-create the admin user
        const defaultEmail = process.env.DEFAULT_ADMIN_EMAIL || "admin@example.com"
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin"

        if (
          userCount === 0 &&
          (rawIdentifier === defaultEmail || rawIdentifier.toLowerCase() === defaultEmail.toLowerCase()) &&
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
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as "ADMIN" | "APPROVER" | "EMPLOYEE"
        session.user.staffId = token.staffId ?? null
        session.user.employeeCode = token.employeeCode ?? null
        session.user.mustChangePassword = Boolean(token.mustChangePassword)
      }
      return session
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.staffId = user.staffId ?? null
        token.employeeCode = user.employeeCode ?? null
        token.mustChangePassword = Boolean(user.mustChangePassword)
      }
      if (trigger === "update" && session?.mustChangePassword !== undefined) {
        token.mustChangePassword = Boolean(session.mustChangePassword)
      }
      return token
    },
  },
  pages: {
    signIn: "/login",
  },
}
