import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDeviceOnline, istDayStart } from "@/lib/dashboard-calc";

export type ShellData = {
  userName: string;
  userRole: string;
  staffCount: number;
  devices: { id: string; name: string; online: boolean; lastPing: string }[];
  recentPunches: { name: string; time: string; device: string | null }[];
};

export async function getShellData(): Promise<ShellData | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const now = new Date();
  const [staffCount, devices, logs] = await Promise.all([
    prisma.staff.count(),
    prisma.device.findMany({ orderBy: { name: "asc" } }),
    prisma.attendanceLog.findMany({
      where: { timestamp: { gte: istDayStart(now) } },
      orderBy: { timestamp: "desc" },
      take: 4,
      include: { staff: { select: { name: true } } },
    }),
  ]);

  return {
    userName: session.user?.name ?? session.user?.email ?? "Admin",
    userRole: "Administrator", // User model has no role field
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
}
