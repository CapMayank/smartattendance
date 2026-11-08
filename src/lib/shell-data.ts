import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDeviceOnline, istDateKey, istDayStart } from "@/lib/dashboard-calc";
import { isEmployedOnDate } from "@/lib/employment";

export type ShellData = {
  userName: string;
  userRole: string;
  roleCode: "ADMIN" | "APPROVER" | "EMPLOYEE";
  employeeCode: string | null;
  staffCount: number;
  devices: { id: string; name: string; online: boolean; lastPing: string }[];
  recentPunches: { name: string; time: string; device: string | null }[];
};

function formatRoleLabel(role?: string): string {
  if (role === "EMPLOYEE") return "Employee";
  if (role === "APPROVER") return "Approver";
  return "Administrator";
}

export async function getShellData(): Promise<ShellData | null> {
  // Not wrapped: JWT sessions need no DB, and Next's dynamic-rendering signals must propagate.
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userName = session.user?.name ?? session.user?.email ?? "Member";
  const roleCode = (session.user?.role as "ADMIN" | "APPROVER" | "EMPLOYEE" | undefined) ?? "ADMIN";
  const userRole = formatRoleLabel(roleCode);
  const staffId = session.user?.staffId ?? null;

  const now = new Date();
  const todayKey = istDateKey(now);
  try {
    const [allStaff, devices, logs, staffProfile] = await Promise.all([
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
    ]);

    const staffCount = allStaff.filter((s) => isEmployedOnDate(s, todayKey)).length;

    return {
      userName,
      userRole,
      roleCode,
      employeeCode: staffProfile?.employeeCode ?? null,
      staffCount,
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
    };
  }
}
