import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    role: "ADMIN" | "APPROVER" | "EMPLOYEE"
    staffId?: string | null
    employeeCode?: string | null
    mustChangePassword: boolean
  }

  interface Session {
    user: {
      id: string
      role: "ADMIN" | "APPROVER" | "EMPLOYEE"
      staffId?: string | null
      employeeCode?: string | null
      mustChangePassword: boolean
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: "ADMIN" | "APPROVER" | "EMPLOYEE"
    staffId?: string | null
    employeeCode?: string | null
    mustChangePassword?: boolean
    /** True once the account is disabled, deleted, or no longer employed. */
    revoked?: boolean
  }
}
