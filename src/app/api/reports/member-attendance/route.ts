import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { startOfMonth, endOfMonth, format, startOfDay, endOfDay, isAfter, eachDayOfInterval } from 'date-fns'
import { recalculateAttendance } from '@/lib/attendance'
import { isEmployedOnDate } from '@/lib/employment'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN', 'APPROVER'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const monthParam = searchParams.get('month') // e.g., "2026-06"
    
    if (!staffId || !monthParam) {
      return NextResponse.json({ error: 'Staff ID and Month are required' }, { status: 400 })
    }

    const [year, month] = monthParam.split('-').map(Number);
    const targetMonth = new Date(year, month - 1, 1);
    
    const sOfMonth = startOfMonth(targetMonth);
    const eOfMonth = endOfMonth(targetMonth);

    // Auto-recalculate for the entire month to ensure up-to-date data
    await recalculateAttendance(sOfMonth, eOfMonth);

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        department: true,
        designation: true,
        payrollInfo: true,
        employmentPeriods: true,
      }
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const queryStartDate = new Date(year, month - 1, -6); // 7 days before target month
    const queryEndDate = new Date(year, month, 7, 23, 59, 59); // 7 days after target month

    const allDailyRecords = await prisma.dailyRecord.findMany({
      where: {
        staffId: staffId,
        date: {
          gte: queryStartDate,
          lte: queryEndDate
        }
      },
      orderBy: { date: 'asc' }
    });

    const attendanceLogs = await prisma.attendanceLog.findMany({
      where: {
        staffId: staffId,
        timestamp: {
          gte: startOfDay(sOfMonth),
          lte: endOfDay(eOfMonth)
        }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Group logs by date string (yyyy-MM-dd)
    const logsByDate: Record<string, typeof attendanceLogs> = {};
    attendanceLogs.forEach(log => {
      const dateStr = format(log.timestamp, 'yyyy-MM-dd');
      if (!logsByDate[dateStr]) {
        logsByDate[dateStr] = [];
      }
      logsByDate[dateStr].push(log);
    });

    // Automatically infer IN/OUT for each day if logs do not differentiate (e.g. all IN from biometric machines)
    Object.keys(logsByDate).forEach(dateStr => {
      const dayLogs = logsByDate[dateStr];
      if (dayLogs.length > 1) {
        const hasExplicitOut = dayLogs.some(l => l.type === 'OUT');
        const hasExplicitIn = dayLogs.some(l => l.type === 'IN');
        if (!hasExplicitIn || !hasExplicitOut) {
          logsByDate[dateStr] = dayLogs.map((log, index) => ({
            ...log,
            type: (index === dayLogs.length - 1 || index % 2 === 1) ? 'OUT' : 'IN'
          }));
        }
      } else if (dayLogs.length === 1 && dayLogs[0].type !== 'OUT') {
        logsByDate[dateStr] = [{ ...dayLogs[0], type: 'IN' }];
      }
    });

    const today = startOfDay(new Date());
    const systemStartDate = process.env.SYSTEM_START_DATE || null;
    const doj = staff.payrollInfo?.doj || staff.createdAt;
    const normalizedDoj = startOfDay(new Date(doj));

    const recordsByDate = new Map<string, typeof allDailyRecords[0]>();
    for (const r of allDailyRecords) {
      recordsByDate.set(format(r.date, 'yyyy-MM-dd'), r);
    }

    const monthDays = eachDayOfInterval({ start: sOfMonth, end: eOfMonth });
    const days: any[] = [];
    let totalPayrollEligibleDays = 0;

    for (const dayDate of monthDays) {
      const dateStr = format(dayDate, 'yyyy-MM-dd');
      const isFuture = isAfter(startOfDay(dayDate), today);
      const hasLogs = logsByDate[dateStr] && logsByDate[dateStr].length > 0;
      if (isFuture && !hasLogs) continue;

      const record = recordsByDate.get(dateStr);
      const isEmployed = isEmployedOnDate(staff, dateStr);
      const isPreSystem = Boolean(systemStartDate && dateStr < systemStartDate);

      if (!isEmployed || isPreSystem) {
        days.push({
          id: record ? record.id : `not-employed-${dateStr}`,
          staffId: staff.id,
          date: dayDate,
          status: 'NOT_EMPLOYED',
          checkIn: null,
          checkOut: null,
          lateMinutes: 0,
          workMinutes: 0,
          overtimeMinutes: 0,
          payrollEligible: 0,
          isSandwiched: false,
          logs: logsByDate[dateStr] || [],
        });
        continue;
      }

      if (record) {
        let payrollEligible = 0;
        let isSandwiched = false;

        // If the date is before the employee joined, they are not eligible for any pay
        if (record.date < normalizedDoj) {
          payrollEligible = 0;
        } else if (record.status === 'PRESENT') {
          payrollEligible = 1;
        } else if (record.status === 'HALF_DAY') {
          payrollEligible = 0.5;
        } else if (record.status === 'WEEKOFF' || record.status === 'HOLIDAY') {
          // Apply Sandwich Rule using allDailyRecords
          const i = allDailyRecords.findIndex(r => r.id === record.id);
          
          let prevWorkingDayStatus = null;
          for (let j = i - 1; j >= 0; j--) {
             if (allDailyRecords[j].status !== "WEEKOFF" && allDailyRecords[j].status !== "HOLIDAY") {
                prevWorkingDayStatus = allDailyRecords[j].status;
                break;
             }
          }
          
          let nextWorkingDayStatus = null;
          for (let j = i + 1; j < allDailyRecords.length; j++) {
             if (allDailyRecords[j].status !== "WEEKOFF" && allDailyRecords[j].status !== "HOLIDAY") {
                nextWorkingDayStatus = allDailyRecords[j].status;
                break;
             }
          }

          if (prevWorkingDayStatus === "ABSENT" && nextWorkingDayStatus === "ABSENT") {
             payrollEligible = 0;
             isSandwiched = true;
          } else {
             payrollEligible = 1;
          }
        }

        totalPayrollEligibleDays += payrollEligible;

        days.push({
          ...record,
          payrollEligible,
          isSandwiched,
          logs: logsByDate[dateStr] || []
        });
      }
    }

    // Calculate totals (only count absents for past and current days when employed and not pre-system)
    const totalPresents = days.filter(r => r.status === 'PRESENT').length;
    const totalAbsents = days.filter(r => r.status === 'ABSENT' && !isAfter(startOfDay(r.date), today)).length;
    const totalHalfDays = days.filter(r => r.status === 'HALF_DAY').length;
    const totalLateMinutes = days.reduce((sum, r) => sum + r.lateMinutes, 0);
    const totalWorkMinutes = days.reduce((sum, r) => sum + r.workMinutes, 0);

    const monthlyPayroll = await prisma.monthlyPayroll.findUnique({
      where: {
        staffId_month_year: {
          staffId: staffId,
          month: month,
          year: year
        }
      }
    });

    return NextResponse.json({
      staff,
      days,
      summary: {
        totalPresents,
        totalAbsents,
        totalHalfDays,
        totalLateMinutes,
        totalWorkMinutes,
        totalPayrollEligibleDays
      },
      payroll: monthlyPayroll
    })

  } catch (error) {
    console.error('Member Attendance API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch member attendance records' }, { status: 500 })
  }
}
