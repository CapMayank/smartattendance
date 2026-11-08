import { prisma } from "@/lib/prisma";
import { isEmployedOnDate } from "@/lib/employment";
import { istDateKey } from "@/lib/dashboard-calc";
import { SCHOOL_TZ } from "@/lib/format";

export type HoursBracket = "7-9 Hrs" | "5-7 Hrs" | "3-5 Hrs" | "0-3 Hrs" | "—";

export type DayStatus =
  | "PRESENT"
  | "HALF_DAY"
  | "ABSENT"
  | "HOLIDAY"
  | "SUNDAY"
  | "NOT_EMPLOYED";

export type ToSchoolDay = {
  dateKey: string;
  dayNumber: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isSunday: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isEmployed: boolean;
  isToday: boolean;
  status: DayStatus;
  checkIn: string | null; // HH:MM
  checkOut: string | null; // HH:MM
  workMinutes: number;
  hoursBracket: HoursBracket;
  isNoShow: boolean;
  hasPendingRequest: boolean;
  punchRequestId: string | null;
  lateMinutes: number;
};

export type MonthlyAchievement = {
  month: number;
  year: number;
  monthName: string; // e.g. "Jul", "Aug", "Sep"
  percentage: number;
  presentDays: number;
  halfDays: number;
  elapsedWorkingDays: number;
  totalWorkingDays: number;
};

export type ComplianceIndex = {
  financialYear: string; // "FY 26-27"
  quarter: string; // "Q1" | "Q2" | "Q3" | "Q4"
  quarterLabel: string; // "Q2, FY 26-27"
  quarterMonths: string; // "Jul - Sep"
  attendanceScore: number; // 0..100
  elapsedWorkingDays: number;
  presentDays: number;
  halfDays: number;
  lateArrivalsCount: number;
  avgDailyMinutes: number;
  totalWorkMinutes: number;
  monthlyAchievements: MonthlyAchievement[];
};

export type ToSchoolData = {
  staff: {
    id: string;
    name: string;
    employeeCode: string | null;
    machineId: string;
    departmentName: string | null;
    designationName: string | null;
  };
  year: number;
  month: number;
  monthLabel: string;
  days: ToSchoolDay[];
  compliance: ComplianceIndex;
  summary: {
    elapsedWorkingDays: number;
    presentDays: number;
    halfDays: number;
    lateArrivalsCount: number;
    avgDailyMinutes: number;
    totalWorkMinutes: number;
  };
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

const MONTH_SHORT_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function getHoursBracket(workMinutes: number): HoursBracket {
  if (workMinutes <= 0) return "—";
  if (workMinutes < 180) return "0-3 Hrs";
  if (workMinutes < 300) return "3-5 Hrs";
  if (workMinutes < 420) return "5-7 Hrs";
  return "7-9 Hrs";
}

export function formatTimeHHmm(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  let h = parts.find((p) => p.type === "hour")?.value ?? "00";
  if (h === "24") h = "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
}

export function getDayOfWeek(year: number, month: number, day: number): number {
  const dt = new Date(Date.UTC(year, month - 1, day, 6, 30, 0));
  return dt.getUTCDay();
}

export function getIndianFinancialYear(
  year: number,
  month: number
): {
  financialYear: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  quarterLabel: string;
  quarterMonths: string;
  startYear: number;
  endYear: number;
  quarterMonthNumbers: number[];
} {
  let startYear: number;
  let endYear: number;

  if (month >= 4) {
    startYear = year;
    endYear = year + 1;
  } else {
    startYear = year - 1;
    endYear = year;
  }

  const fyLabel = `FY ${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;

  let quarter: "Q1" | "Q2" | "Q3" | "Q4";
  let quarterMonths: string;
  let quarterMonthNumbers: number[];

  if (month >= 4 && month <= 6) {
    quarter = "Q1";
    quarterMonths = "Apr – Jun";
    quarterMonthNumbers = [4, 5, 6];
  } else if (month >= 7 && month <= 9) {
    quarter = "Q2";
    quarterMonths = "Jul – Sep";
    quarterMonthNumbers = [7, 8, 9];
  } else if (month >= 10 && month <= 12) {
    quarter = "Q3";
    quarterMonths = "Oct – Dec";
    quarterMonthNumbers = [10, 11, 12];
  } else {
    quarter = "Q4";
    quarterMonths = "Jan – Mar";
    quarterMonthNumbers = [1, 2, 3];
  }

  return {
    financialYear: fyLabel,
    quarter,
    quarterLabel: `${quarter}, ${fyLabel}`,
    quarterMonths,
    startYear,
    endYear,
    quarterMonthNumbers,
  };
}

export async function getToSchoolData(
  staffId: string,
  year: number,
  month: number,
  now: Date = new Date()
): Promise<ToSchoolData | null> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    include: {
      department: true,
      designation: true,
      employmentPeriods: true,
    },
  });

  if (!staff) return null;

  const todayKey = istDateKey(now);
  const fyInfo = getIndianFinancialYear(year, month);

  // Past 3 months: month - 2, month - 1, month
  const past3Months: { year: number; month: number }[] = [];
  for (let offset = -2; offset <= 0; offset++) {
    let m = month + offset;
    let y = year;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    past3Months.push({ year: y, month: m });
  }

  // Determine earliest start date and latest end date for fetching DailyRecords, Holidays, PunchRequests
  // Earliest date needed: min(quarter start, past3Months[0] start, current month start)
  const quarterStartYear = fyInfo.quarter === "Q4" ? fyInfo.endYear : fyInfo.startYear;
  const quarterStartMonth = fyInfo.quarterMonthNumbers[0];
  const quarterEndMonth = fyInfo.quarterMonthNumbers[2];

  const earliestDateObj = new Date(
    Math.min(
      Date.UTC(quarterStartYear, quarterStartMonth - 1, 1),
      Date.UTC(past3Months[0].year, past3Months[0].month - 1, 1),
      Date.UTC(year, month - 1, 1)
    )
  );

  const latestDateObj = new Date(
    Math.max(
      Date.UTC(quarterStartYear, quarterEndMonth, 1), // start of next month after quarter
      Date.UTC(year, month, 1) // start of next month after current
    )
  );

  // Range for DB queries with a 2-day buffer to ensure midnight IST on the 1st
  // (which corresponds to 18:30 UTC of the previous calendar day) is never clipped
  const rangeStart = new Date(Date.UTC(earliestDateObj.getUTCFullYear(), earliestDateObj.getUTCMonth(), 1, 0, 0, 0));
  const rangeEnd = new Date(Date.UTC(latestDateObj.getUTCFullYear(), latestDateObj.getUTCMonth(), 1, 0, 0, 0));
  const bufferedRangeStart = new Date(rangeStart.getTime() - 2 * 24 * 3600 * 1000);
  const bufferedRangeEnd = new Date(rangeEnd.getTime() + 2 * 24 * 3600 * 1000);

  const [dailyRecords, holidays, punchRequests] = await Promise.all([
    prisma.dailyRecord.findMany({
      where: {
        staffId,
        date: { gte: bufferedRangeStart, lt: bufferedRangeEnd },
      },
    }),
    prisma.holiday.findMany({
      where: {
        date: { gte: bufferedRangeStart, lt: bufferedRangeEnd },
      },
    }),
    prisma.punchRequest.findMany({
      where: {
        staffId,
      },
    }),
  ]);

  const dailyRecordByKey = new Map<string, (typeof dailyRecords)[number]>();
  for (const dr of dailyRecords) {
    dailyRecordByKey.set(istDateKey(dr.date), dr);
  }

  const holidayByKey = new Map<string, string>();
  for (const h of holidays) {
    holidayByKey.set(istDateKey(h.date), h.name);
  }

  const punchRequestByKey = new Map<string, (typeof punchRequests)[number]>();
  for (const pr of punchRequests) {
    if (pr.status === "PENDING") {
      punchRequestByKey.set(pr.date, pr);
    }
  }

  // 1. Generate Days for Current Selected Month
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: ToSchoolDay[] = [];

  let monthElapsedWorkingDays = 0;
  let monthPresentDays = 0;
  let monthHalfDays = 0;
  let monthLateArrivals = 0;
  let monthTotalWorkMinutes = 0;

  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    const dayOfWeek = getDayOfWeek(year, month, dayNum);
    const isSunday = dayOfWeek === 0;
    const holidayName = holidayByKey.get(dateKey) ?? null;
    const isHoliday = holidayName !== null;
    const isEmployed = isEmployedOnDate(staff, dateKey);
    const pendingRequest = punchRequestByKey.get(dateKey);
    const dr = dailyRecordByKey.get(dateKey);

    let status: DayStatus;
    let checkIn: string | null = null;
    let checkOut: string | null = null;
    let workMinutes = 0;
    let lateMinutes = 0;

    if (!isEmployed) {
      status = "NOT_EMPLOYED";
    } else if (dr && (dr.status === "PRESENT" || dr.status === "HALF_DAY")) {
      status = dr.status as "PRESENT" | "HALF_DAY";
      checkIn = dr.checkIn ? formatTimeHHmm(dr.checkIn) : null;
      checkOut = dr.checkOut ? formatTimeHHmm(dr.checkOut) : null;
      workMinutes = dr.workMinutes ?? 0;
      lateMinutes = dr.lateMinutes ?? 0;
    } else if (isHoliday) {
      status = "HOLIDAY";
    } else if (isSunday) {
      status = "SUNDAY";
    } else if (dr && dr.status === "ABSENT") {
      status = "ABSENT";
      checkIn = dr.checkIn ? formatTimeHHmm(dr.checkIn) : null;
      checkOut = dr.checkOut ? formatTimeHHmm(dr.checkOut) : null;
      workMinutes = dr.workMinutes ?? 0;
      lateMinutes = dr.lateMinutes ?? 0;
    } else {
      status = "ABSENT";
    }

    const hoursBracket = getHoursBracket(workMinutes);

    // isNoShow: working day, employed, not holiday/sunday, but status is ABSENT or 0 workMinutes.
    // Exclude today (dateKey === todayKey) so active school hours do not show an alarming "No Show" badge.
    const isToday = dateKey === todayKey;
    const isPast = dateKey < todayKey;
    const isWorkingDay = isEmployed && !isSunday && !isHoliday;
    const isElapsed = dateKey <= todayKey;
    const isNoShow =
      isWorkingDay && isPast && (status === "ABSENT" || workMinutes === 0);

    if (isWorkingDay && isElapsed) {
      monthElapsedWorkingDays++;
      if (status === "PRESENT") {
        monthPresentDays++;
      } else if (status === "HALF_DAY") {
        monthHalfDays++;
      }
    }

    if (isElapsed && lateMinutes > 0) {
      monthLateArrivals++;
    }
    monthTotalWorkMinutes += workMinutes;

    days.push({
      dateKey,
      dayNumber: dayNum,
      dayOfWeek,
      isSunday,
      isHoliday,
      holidayName,
      isEmployed,
      isToday,
      status,
      checkIn,
      checkOut,
      workMinutes,
      hoursBracket,
      isNoShow,
      hasPendingRequest: Boolean(pendingRequest),
      punchRequestId: pendingRequest?.id ?? null,
      lateMinutes,
    });
  }

  // 2. Quarterly Compliance Calculation
  // Quarter covers fyInfo.quarterMonthNumbers (e.g. 7, 8, 9) in quarterStartYear
  let quarterElapsedWorkingDays = 0;
  let quarterPresentDays = 0;
  let quarterHalfDays = 0;
  let quarterLateArrivals = 0;
  let quarterTotalWorkMinutes = 0;

  for (const qMonth of fyInfo.quarterMonthNumbers) {
    const qDaysInMonth = new Date(Date.UTC(quarterStartYear, qMonth, 0)).getUTCDate();
    for (let d = 1; d <= qDaysInMonth; d++) {
      const qDateKey = `${quarterStartYear}-${String(qMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const qDayOfWeek = getDayOfWeek(quarterStartYear, qMonth, d);
      const qIsSunday = qDayOfWeek === 0;
      const qIsHoliday = holidayByKey.has(qDateKey);
      const qIsEmployed = isEmployedOnDate(staff, qDateKey);

      if (qIsEmployed && !qIsSunday && !qIsHoliday) {
        if (qDateKey <= todayKey) {
          quarterElapsedWorkingDays++;
          const qDr = dailyRecordByKey.get(qDateKey);
          if (qDr?.status === "PRESENT") {
            quarterPresentDays++;
          } else if (qDr?.status === "HALF_DAY") {
            quarterHalfDays++;
          }
          if (qDr && qDr.lateMinutes > 0) {
            quarterLateArrivals++;
          }
          if (qDr) {
            quarterTotalWorkMinutes += qDr.workMinutes ?? 0;
          }
        }
      }
    }
  }

  const quarterlyAttendanceScore =
    quarterElapsedWorkingDays > 0
      ? Math.round(
          ((quarterPresentDays + 0.5 * quarterHalfDays) /
            quarterElapsedWorkingDays) *
            100
        )
      : 0;

  // 3. Monthly Achievement Rings for Past 3 Months
  const monthlyAchievements: MonthlyAchievement[] = [];
  for (const item of past3Months) {
    const mDays = new Date(Date.UTC(item.year, item.month, 0)).getUTCDate();
    let mElapsed = 0;
    let mTotal = 0;
    let mPresent = 0;
    let mHalf = 0;

    for (let d = 1; d <= mDays; d++) {
      const mDateKey = `${item.year}-${String(item.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const mDayOfWeek = getDayOfWeek(item.year, item.month, d);
      const mIsSunday = mDayOfWeek === 0;
      const mIsHoliday = holidayByKey.has(mDateKey);
      const mIsEmployed = isEmployedOnDate(staff, mDateKey);

      if (mIsEmployed && !mIsSunday && !mIsHoliday) {
        mTotal++;
        if (mDateKey <= todayKey) {
          mElapsed++;
          const mDr = dailyRecordByKey.get(mDateKey);
          if (mDr?.status === "PRESENT") {
            mPresent++;
          } else if (mDr?.status === "HALF_DAY") {
            mHalf++;
          }
        }
      }
    }

    const mPercentage =
      mElapsed > 0
        ? Math.round(((mPresent + 0.5 * mHalf) / mElapsed) * 100)
        : 0;

    monthlyAchievements.push({
      month: item.month,
      year: item.year,
      monthName: MONTH_SHORT_NAMES[item.month - 1],
      percentage: Math.min(100, Math.max(0, mPercentage)),
      presentDays: mPresent,
      halfDays: mHalf,
      elapsedWorkingDays: mElapsed,
      totalWorkingDays: mTotal,
    });
  }

  const attendedDays = monthPresentDays + monthHalfDays;
  const monthAvgDailyMinutes =
    attendedDays > 0 ? Math.round(monthTotalWorkMinutes / attendedDays) : 0;

  const compliance: ComplianceIndex = {
    financialYear: fyInfo.financialYear,
    quarter: fyInfo.quarter,
    quarterLabel: fyInfo.quarterLabel,
    quarterMonths: fyInfo.quarterMonths,
    attendanceScore: Math.min(100, Math.max(0, quarterlyAttendanceScore)),
    elapsedWorkingDays: quarterElapsedWorkingDays,
    presentDays: quarterPresentDays,
    halfDays: quarterHalfDays,
    lateArrivalsCount: quarterLateArrivals,
    avgDailyMinutes:
      quarterPresentDays + quarterHalfDays > 0
        ? Math.round(
            quarterTotalWorkMinutes / (quarterPresentDays + quarterHalfDays)
          )
        : 0,
    totalWorkMinutes: quarterTotalWorkMinutes,
    monthlyAchievements,
  };

  const summary = {
    elapsedWorkingDays: monthElapsedWorkingDays,
    presentDays: monthPresentDays,
    halfDays: monthHalfDays,
    lateArrivalsCount: monthLateArrivals,
    avgDailyMinutes: monthAvgDailyMinutes,
    totalWorkMinutes: monthTotalWorkMinutes,
  };

  return {
    staff: {
      id: staff.id,
      name: staff.name,
      employeeCode: staff.employeeCode,
      machineId: staff.machineId,
      departmentName: staff.department?.name ?? null,
      designationName: staff.designation?.name ?? null,
    },
    year,
    month,
    monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
    days,
    compliance,
    summary,
  };
}
