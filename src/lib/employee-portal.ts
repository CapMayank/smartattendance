import { prisma } from "@/lib/prisma";
import { istDateKey, istDayStart } from "@/lib/dashboard-calc";
import type { MonthlyPayrollWithDetails } from "@/lib/payslip-pdf";
import { evaluateEmployeeKycAndEpfoReadiness } from "@/lib/epfo/validation";

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
    kycDetails?: {
      mobileNumber: string | null;
      dob: string | null;
      gender: string | null;
      maritalStatus: string | null;
      fatherHusbandName: string | null;
      relationship: string | null;
      nationality: string | null;
      qualification: string | null;
      bankAccount: string | null;
      ifsc: string | null;
      nameAsPerBank: string | null;
      pan: string | null;
      nameOnPan: string | null;
      aadhaar: string | null;
      nameOnAadhaar: string | null;
      uan: string | null;
      nameOnUan: string | null;
      previousMemberId: string | null;
      isInternationalWorker: string | null;
      countryOfOrigin: string | null;
      passportNumber: string | null;
      passportValidFrom: string | null;
      passportValidTill: string | null;
      isPhysicalHandicap: string | null;
      locomotive: string | null;
      hearing: string | null;
      visual: string | null;
    };
    epfoReadiness?: {
      isBankEpf: boolean;
      ready: boolean;
      missingFields: string[];
      hasPendingRequest: boolean;
    };
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
  payslips: MonthlyPayrollWithDetails[];
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
      payrollInfo: {
        include: {
          payGroupChanges: true,
        },
      },
      employmentPeriods: {
        orderBy: {
          startDate: "desc",
        },
      },
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

  const [todayPunches, monthDailyRecords, payslips, pendingRequest] = await Promise.all([
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
      where: { staffId, isLocked: true },
      include: {
        staff: {
          include: {
            department: true,
            designation: true,
            payrollInfo: true,
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 12,
    }),
    prisma.profileChangeRequest?.findFirst
      ? prisma.profileChangeRequest.findFirst({
          where: {
            staffId,
            status: "PENDING",
          },
          select: { id: true },
        })
      : Promise.resolve(null),
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

  const info = staff.payrollInfo as Record<string, any> | null | undefined;
  const isBankEpf = (info?.payGroup ?? "BANK_EPF") === "BANK_EPF";
  let ready = true;
  let missingFields: string[] = [];

  if (isBankEpf) {
    const res = evaluateEmployeeKycAndEpfoReadiness(staff as any);
    ready = res.ready;
    missingFields = res.errors.map((e) => e.message);
  }

  const epfoReadiness = {
    isBankEpf,
    ready,
    missingFields,
    hasPendingRequest: Boolean(pendingRequest),
  };

  const toDateStr = (val: unknown): string | null => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val.toISOString().slice(0, 10);
    return String(val).slice(0, 10);
  };

  const kycDetails = {
    mobileNumber: info?.mobileNumber ?? null,
    dob: toDateStr(info?.dob),
    gender: info?.gender ?? null,
    maritalStatus: info?.maritalStatus ?? null,
    fatherHusbandName: info?.fatherHusbandName ?? null,
    relationship: info?.relationship ?? null,
    nationality: info?.nationality ?? "INDIAN",
    qualification: info?.qualification ?? null,
    bankAccount: info?.bankAccount ?? null,
    ifsc: info?.ifsc ?? null,
    nameAsPerBank: info?.nameAsPerBank ?? null,
    pan: info?.pan ?? null,
    nameOnPan: info?.nameOnPan ?? null,
    aadhaar: info?.aadhaar ?? null,
    nameOnAadhaar: info?.nameOnAadhaar ?? null,
    uan: info?.uan ?? null,
    nameOnUan: info?.nameOnUan ?? null,
    previousMemberId: info?.previousMemberId ?? null,
    isInternationalWorker: info?.isInternationalWorker ?? "N",
    countryOfOrigin: info?.countryOfOrigin ?? "INDIA",
    passportNumber: info?.passportNumber ?? null,
    passportValidFrom: toDateStr(info?.passportValidFrom),
    passportValidTill: toDateStr(info?.passportValidTill),
    isPhysicalHandicap: info?.isPhysicalHandicap ?? "N",
    locomotive: info?.locomotive ?? "N",
    hearing: info?.hearing ?? "N",
    visual: info?.visual ?? "N",
  };

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
      payGroup: (info?.payGroup as "BANK_EPF" | "CASH") ?? "BANK_EPF",
      email: staff.user?.email ?? null,
      kycDetails,
      epfoReadiness,
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
    payslips: payslips as unknown as MonthlyPayrollWithDetails[],
  };
}
