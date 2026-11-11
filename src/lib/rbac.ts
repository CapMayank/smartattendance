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

/**
 * Returns null if the user has full department visibility (ADMIN, or APPROVER with
 * approvesAllDepartments or no specific department restriction rows), or an array
 * of allowed department IDs when an APPROVER is scoped to specific departments.
 */
export function getApproverDepartmentIds(
  user:
    | {
        role?: string | null
        approvesAllDepartments?: boolean | null
        approverDepartments?: { departmentId: string }[] | null
      }
    | null
    | undefined
): string[] | null {
  if (!user || user.role !== "APPROVER") return null
  if (user.approvesAllDepartments) return null
  const ids = (user.approverDepartments ?? [])
    .map((d) => d.departmentId)
    .filter((id): id is string => Boolean(id))
  return ids.length > 0 ? ids : null
}

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

/**
 * Whether `user` may read another staff member's records (punches, photos, shift history).
 * - ADMIN: everyone.
 * - APPROVER: their own record, plus staff inside their department scope.
 * - EMPLOYEE: only their own record.
 */
export async function canAccessStaff(
  user: Pick<DbUserWithRelations, "role" | "staffId" | "staff" | "approvesAllDepartments" | "approverDepartments">,
  targetStaffId: string
): Promise<boolean> {
  if (user.role === "ADMIN") return true
  const ownStaffId = user.staffId ?? user.staff?.id ?? null
  if (ownStaffId && ownStaffId === targetStaffId) return true
  if (user.role !== "APPROVER") return false

  const allowedDepartmentIds = getApproverDepartmentIds(user)
  if (allowedDepartmentIds === null) return true
  const target = await prisma.staff.findUnique({
    where: { id: targetStaffId },
    select: { departmentId: true },
  })
  return !!target?.departmentId && allowedDepartmentIds.includes(target.departmentId)
}
