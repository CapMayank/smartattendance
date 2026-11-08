import { prisma } from "@/lib/prisma";
import { istDateKey, istDayStart } from "@/lib/dashboard-calc";

export type EmployeePortalData = {
  profile: {
    id: string;
    name: string;
    employeeCode: string | null;
    machineId: string;
    joiningDate: string | null;
    profilePhotoId: string | null;
    departmentName: string | null;
    designationName: string | null;
    shift: { name: string; startTime: string; endTime: string } | null;
    payGroup: "BANK_EPF" | "CASH";
    email: string | null;
  };
  today: {
    dateKey: string;
    status: "PRESENT" | "HALF_DAY" | "ABSENT" | "NOT_MARKED";
    checkIn: string | null;
    checkOut: string | null;
    lateMinutes: number;
    workMinutes: number;
    punches: { id: string; timestamp: string; type: string }[];
  };
  monthSummary: {
    monthLabel: string;
    presentDays: number;
    halfDays: number;
    absentDays: number;
    lateDays: number;
    totalWorkMinutes: number;
  };
  monthRecords: {
    id: string;
    dateKey: string;
    status: string;
    checkIn: string | null;
    checkOut: string | null;
    lateMinutes: number;
    workMinutes: number;
  }[];
  payslips: {
    id: string;
    month: number;
    year: number;
    payGroup: string;
    totalDays: number;
    presentDays: number;
    ncpDays: number;
    grossWage: number;
    basicWage: number;
    bonusAmount: number;
    employeeEpf: number;
    netPayment: number;
    isLocked: boolean;
  }[];
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export async function getEmployeePortalData(
  staffId: string,
  now: Date = new Date()
): Promise<EmployeePortalData | null> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    include: {
      department: true,
      designation: true,
      shift: true,
      user: { select: { email: true } },
      payrollInfo: { select: { payGroup: true } },
    },
  });

  if (!staff) return null;

  const todayKey = istDateKey(now);
  const [yearStr, monthStr] = todayKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const nextMonthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const dayStart = istDayStart(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [todayPunches, monthDailyRecords, payslips] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: {
        staffId,
        timestamp: { gte: dayStart, lt: dayEnd },
      },
      orderBy: { timestamp: "asc" },
    }),
    prisma.dailyRecord.findMany({
      where: {
        staffId,
        date: { gte: monthStart, lt: nextMonthStart },
      },
      orderBy: { date: "desc" },
    }),
    prisma.monthlyPayroll.findMany({
      where: { staffId },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
    }),
  ]);

  const monthRecords = monthDailyRecords.map((r) => ({
    id: r.id,
    dateKey: r.date.toISOString().slice(0, 10),
    status: r.status,
    checkIn: r.checkIn ? r.checkIn.toISOString() : null,
    checkOut: r.checkOut ? r.checkOut.toISOString() : null,
    lateMinutes: r.lateMinutes,
    workMinutes: r.workMinutes,
  }));

  const todayRecord = monthRecords.find((r) => r.dateKey === todayKey);

  const firstPunch = todayPunches[0]?.timestamp?.toISOString() ?? null;
  const lastPunch =
    todayPunches.length > 1 ? todayPunches[todayPunches.length - 1].timestamp.toISOString() : null;

  const todayStatus: "PRESENT" | "HALF_DAY" | "ABSENT" | "NOT_MARKED" = todayRecord
    ? (todayRecord.status as "PRESENT" | "HALF_DAY" | "ABSENT")
    : todayPunches.length > 0
      ? "PRESENT"
      : "NOT_MARKED";

  let presentDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let lateDays = 0;
  let totalWorkMinutes = 0;

  for (const r of monthRecords) {
    if (r.status === "PRESENT") presentDays++;
    else if (r.status === "HALF_DAY") halfDays++;
    else if (r.status === "ABSENT") absentDays++;
    if (r.lateMinutes > 0) lateDays++;
    totalWorkMinutes += r.workMinutes;
  }

  return {
    profile: {
      id: staff.id,
      name: staff.name,
      employeeCode: staff.employeeCode ?? null,
      machineId: staff.machineId,
      joiningDate: staff.joiningDate ?? null,
      profilePhotoId: staff.profilePhotoId ?? null,
      departmentName: staff.department?.name ?? null,
      designationName: staff.designation?.name ?? null,
      shift: staff.shift
        ? {
            name: staff.shift.name,
            startTime: staff.shift.startTime,
            endTime: staff.shift.endTime,
          }
        : null,
      payGroup: (staff.payrollInfo?.payGroup as "BANK_EPF" | "CASH") ?? "BANK_EPF",
      email: staff.user?.email ?? null,
    },
    today: {
      dateKey: todayKey,
      status: todayStatus,
      checkIn: todayRecord?.checkIn ?? firstPunch,
      checkOut: todayRecord?.checkOut ?? lastPunch,
      lateMinutes: todayRecord?.lateMinutes ?? 0,
      workMinutes: todayRecord?.workMinutes ?? 0,
      punches: todayPunches.map((p) => ({
        id: p.id,
        timestamp: p.timestamp.toISOString(),
        type: p.type,
      })),
    },
    monthSummary: {
      monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
      presentDays,
      halfDays,
      absentDays,
      lateDays,
      totalWorkMinutes,
    },
    monthRecords,
    payslips: payslips.map((p) => ({
      id: p.id,
      month: p.month,
      year: p.year,
      payGroup: p.payGroup,
      totalDays: p.totalDays,
      presentDays: p.presentDays,
      ncpDays: p.ncpDays,
      grossWage: p.grossWage,
      basicWage: p.basicWage,
      bonusAmount: p.bonusAmount,
      employeeEpf: p.employeeEpf,
      netPayment: p.netPayment,
      isLocked: p.isLocked,
    })),
  };
}
