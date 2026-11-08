import { Session } from "next-auth"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { isEmployedOnDate } from "@/lib/employment"
import { istDateKey } from "@/lib/dashboard-calc"
import type { User, Staff, EmploymentPeriod, ApproverDepartment } from "@prisma/client"

export type AppRole = "ADMIN" | "APPROVER" | "EMPLOYEE"

export const ROLE_HIERARCHY: Record<AppRole, AppRole[]> = {
  ADMIN: ["ADMIN", "APPROVER", "EMPLOYEE"],
  APPROVER: ["APPROVER", "EMPLOYEE"],
  EMPLOYEE: ["EMPLOYEE"],
}

export type DbUserWithRelations = User & {
  staff: (Staff & { employmentPeriods: EmploymentPeriod[] }) | null
  approverDepartments: ApproverDepartment[]
}

export type RequireRoleOptions = {
  allowMustChangePassword?: boolean
}

export type RequireRoleResult =
  | { user: DbUserWithRelations; errorResponse?: never }
  | { user?: never; errorResponse: NextResponse }

export async function requireRole(
  session: Session | null | undefined,
  allowedRoles: AppRole[],
  options?: RequireRoleOptions
): Promise<RequireRoleResult> {
  const userId = session?.user?.id
  if (!userId) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      staff: {
        include: {
          employmentPeriods: true,
        },
      },
      approverDepartments: true,
    },
  })

  if (!user || user.disabledAt !== null) {
    return {
      errorResponse: NextResponse.json(
        { error: "Account disabled or not found" },
        { status: 401 }
      ),
    }
  }

  const istToday = istDateKey(new Date())
  if (user.role !== "ADMIN" && user.staff) {
    const periods = user.staff.employmentPeriods ?? []
    if (periods.length > 0 && !isEmployedOnDate(user.staff, istToday)) {
      return {
        errorResponse: NextResponse.json(
          { error: "Employment period ended" },
          { status: 401 }
        ),
      }
    }
  }

  const effectiveRoles = ROLE_HIERARCHY[user.role as AppRole] || []
  const isAuthorized = effectiveRoles.some((role) => allowedRoles.includes(role))

  if (!isAuthorized) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  if (user.mustChangePassword && !options?.allowMustChangePassword) {
    return {
      errorResponse: NextResponse.json(
        { error: "Password change required", mustChangePassword: true },
        { status: 403 }
      ),
    }
  }

  return { user: user as DbUserWithRelations }
}
