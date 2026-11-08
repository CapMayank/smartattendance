import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { startOfMonth, endOfMonth, startOfDay, format } from 'date-fns'
import { isEmployedOnDate } from '@/lib/employment'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { id } = await context.params;

    const payroll = await prisma.monthlyPayroll.findUnique({
      where: { id },
      include: {
        staff: {
          include: {
            department: true,
            designation: true,
            payrollInfo: true,
            employmentPeriods: true,
          }
        }
      }
    });

    if (!payroll) {
      return NextResponse.json({ error: 'Payroll record not found' }, { status: 404 })
    }

    // Calculate system present days dynamically to compare against payroll.presentDays
    const targetMonth = new Date(payroll.year, payroll.month - 1, 1);
    
    const queryStartDate = new Date(payroll.year, payroll.month - 1, -6);
    const queryEndDate = new Date(payroll.year, payroll.month, 7, 23, 59, 59);

    const allDailyRecords = await prisma.dailyRecord.findMany({
      where: {
        staffId: payroll.staffId,
        date: { gte: queryStartDate, lte: queryEndDate }
      },
      orderBy: { date: 'asc' }
    });

    const sOfMonth = startOfMonth(targetMonth);
    const eOfMonth = endOfMonth(targetMonth);
    const dailyRecords = allDailyRecords.filter(r => r.date >= sOfMonth && r.date <= eOfMonth);
    
    let systemPresentDays = 0;
    const staffRecord = payroll.staff;
    const hasPeriods = Array.isArray(staffRecord.employmentPeriods) && staffRecord.employmentPeriods.length > 0;
    const rawDoj = staffRecord.payrollInfo?.doj || (staffRecord.joiningDate ? new Date(`${staffRecord.joiningDate}T00:00:00`) : staffRecord.createdAt);
    const normalizedDoj = rawDoj ? startOfDay(new Date(rawDoj)) : null;

    dailyRecords.forEach(record => {
      const dateStr = format(record.date, 'yyyy-MM-dd');
      let payrollEligible = 0;
      if (hasPeriods && !isEmployedOnDate(staffRecord, dateStr)) {
        payrollEligible = 0;
      } else if (!hasPeriods && normalizedDoj && record.date < normalizedDoj) {
        payrollEligible = 0;
      } else if (record.status === 'PRESENT') {
        payrollEligible = 1;
      } else if (record.status === 'HALF_DAY') {
        payrollEligible = 0.5;
      } else if (record.status === 'WEEKOFF' || record.status === 'HOLIDAY') {
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
        } else {
           payrollEligible = 1;
        }
      }
      systemPresentDays += payrollEligible;
    });

    return NextResponse.json({
      payroll,
      systemPresentDays
    });

  } catch (error) {
    console.error('Fetch Payroll Details API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch payroll details' }, { status: 500 })
  }
}
