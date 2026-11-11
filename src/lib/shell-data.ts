import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isDeviceOnline, istDateKey, istDayStart } from "@/lib/dashboard-calc";
import { isEmployedOnDate } from "@/lib/employment";
import { getApproverDepartmentIds } from "@/lib/rbac";

export type ShellData = {
  userName: string;
  userRole: string;
  roleCode: "ADMIN" | "APPROVER" | "EMPLOYEE";
  employeeCode: string | null;
  staffCount: number;
  devices: { id: string; name: string; online: boolean; lastPing: string }[];
  recentPunches: { name: string; time: string; device: string | null }[];
  pendingPunchRequestsCount?: number;
};

function formatRoleLabel(role?: string): string {
  if (role === "EMPLOYEE") return "Employee";
  if (role === "APPROVER") return "Approver";
  return "Administrator";
}

export async function getShellData(): Promise<ShellData | null> {
  // Not wrapped: JWT sessions need no DB, and Next's dynamic-rendering signals must propagate.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userName = session.user?.name ?? session.user?.email ?? "Member";
  const roleCode = (session.user?.role as "ADMIN" | "APPROVER" | "EMPLOYEE" | undefined) ?? "EMPLOYEE";
  const userRole = formatRoleLabel(roleCode);
  const staffId = session.user?.staffId ?? null;

  const now = new Date();
  const todayKey = istDateKey(now);
  try {
    let pendingPromise: Promise<number>;
    if (roleCode === "ADMIN") {
      pendingPromise = Promise.all([
        prisma.punchRequest.count({ where: { status: "PENDING" } }),
        prisma.profileChangeRequest.count({ where: { status: "PENDING" } }),
      ]).then(([punches, profiles]) => punches + profiles);
    } else if (roleCode === "APPROVER" && session.user?.id) {
      pendingPromise = prisma.user
        .findUnique({
          where: { id: session.user.id },
          include: { approverDepartments: { select: { departmentId: true } } },
        })
        .then((dbUser) => {
          const allowedDeptIds = dbUser ? getApproverDepartmentIds(dbUser) : null;
          const punchWhere: Prisma.PunchRequestWhereInput = { status: "PENDING" };
          const profileWhere: Prisma.ProfileChangeRequestWhereInput = { status: "PENDING" };
          if (allowedDeptIds !== null) {
            punchWhere.staff = { departmentId: { in: allowedDeptIds } };
            profileWhere.staff = { departmentId: { in: allowedDeptIds } };
          }
          return Promise.all([
            prisma.punchRequest.count({ where: punchWhere }),
            prisma.profileChangeRequest.count({ where: profileWhere }),
          ]).then(([punches, profiles]) => punches + profiles);
        });
    } else if (roleCode === "EMPLOYEE" && staffId) {
      pendingPromise = Promise.all([
        prisma.punchRequest.count({ where: { staffId, status: "PENDING" } }),
        prisma.profileChangeRequest.count({ where: { staffId, status: "PENDING" } }),
      ]).then(([punches, profiles]) => punches + profiles);
    } else {
      pendingPromise = Promise.resolve(0);
    }

    const [allStaff, devices, logs, staffProfile, pendingPunchRequestsCount] = await Promise.all([
      prisma.staff.findMany({
        select: {
          id: true,
          employmentPeriods: { select: { startDate: true, endDate: true } },
        },
      }),
      prisma.device.findMany({ orderBy: { name: "asc" } }),
      prisma.attendanceLog.findMany({
        where: { timestamp: { gte: istDayStart(now) } },
        orderBy: { timestamp: "desc" },
        take: 4,
        include: { staff: { select: { name: true } } },
      }),
      staffId
        ? prisma.staff.findUnique({
            where: { id: staffId },
            select: { employeeCode: true },
          })
        : Promise.resolve(null),
      pendingPromise,
    ]);

    const staffCount = allStaff.filter((s) => isEmployedOnDate(s, todayKey)).length;

    return {
      userName,
      userRole,
      roleCode,
      employeeCode: staffProfile?.employeeCode ?? null,
      staffCount,
      pendingPunchRequestsCount,
      devices: devices.map((d) => ({
        id: d.id,
        name: d.name,
        online: isDeviceOnline(d.lastPing, now),
        lastPing: d.lastPing.toISOString(),
      })),
      // AttendanceLog has no device relation in the schema
      recentPunches: logs.map((l) => ({ name: l.staff.name, time: l.timestamp.toISOString(), device: null })),
    };
  } catch (err) {
    console.error("[shell] failed to load shell data:", err);
    return {
      userName,
      userRole,
      roleCode,
      employeeCode: null,
      staffCount: 0,
      devices: [],
      recentPunches: [],
      pendingPunchRequestsCount: 0,
    };
  }
}
