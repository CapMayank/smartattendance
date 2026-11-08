import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac"
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format, isAfter } from 'date-fns'
import { recalculateAttendance } from '@/lib/attendance'
import { isEmployedOnDate } from '@/lib/employment'

type DaySummary = {
  status: string
  checkIn: Date | null
  checkOut: Date | null
  lateMinutes: number
  workMinutes: number
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN', 'APPROVER'])
  if (auth.errorResponse) return auth.errorResponse

  const allowedDepartmentIds = getApproverDepartmentIds(auth.user)

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'daily'
    const dateParam = searchParams.get('date')
    const monthParam = searchParams.get('month') // e.g., "2026-06"
    const systemStartDate = process.env.SYSTEM_START_DATE || null

    if (type === 'daily') {
      if (!dateParam) return NextResponse.json({ error: 'Date is required for daily report' }, { status: 400 })
      
      const targetDate = new Date(dateParam)
      
      // Auto-recalculate for this specific day to ensure it's always up to date
      await recalculateAttendance(targetDate, targetDate);

      const allRecords = await prisma.dailyRecord.findMany({
        where: {
          date: {
            gte: startOfDay(targetDate),
            lte: endOfDay(targetDate)
          }
        },
        include: {
          staff: {
            include: {
              department: true,
              designation: true,
              shift: true,
              employmentPeriods: true,
            }
          }
        }
      })

      const records =
        allowedDepartmentIds !== null
          ? allRecords.filter(
              (r) => r.staff.departmentId !== null && allowedDepartmentIds.includes(r.staff.departmentId)
            )
          : allRecords

      // Sort by machineId numerically since it is a String in DB
      records.sort((a, b) => 
        a.staff.machineId.localeCompare(b.staff.machineId, undefined, { numeric: true })
      )

      const formattedRecords = records.map((record) => {
        const dateStr = format(record.date, 'yyyy-MM-dd')
        const isEmployed = isEmployedOnDate(record.staff, dateStr)
        const isPreSystem = Boolean(systemStartDate && dateStr < systemStartDate)

        if (!isEmployed || isPreSystem) {
          return {
            ...record,
            status: 'NOT_EMPLOYED',
            checkIn: null,
            checkOut: null,
            lateMinutes: 0,
            workMinutes: 0,
          }
        }
        return record
      })

      return NextResponse.json(formattedRecords)
    } 
    else if (type === 'monthly') {
      if (!monthParam) return NextResponse.json({ error: 'Month is required for monthly report' }, { status: 400 })
      
      const [year, month] = monthParam.split('-').map(Number);
      const targetMonth = new Date(year, month - 1, 1);
      
      const sOfMonth = startOfMonth(targetMonth);
      const eOfMonth = endOfMonth(targetMonth);

      // Auto-recalculate for the entire month
      await recalculateAttendance(sOfMonth, eOfMonth);

      const allRecords = await prisma.dailyRecord.findMany({
        where: {
          date: {
            gte: sOfMonth,
            lte: eOfMonth
          }
        },
        include: {
          staff: {
            include: {
              department: true,
              designation: true,
              shift: true,
              employmentPeriods: true,
            }
          }
        }
      })

      const records =
        allowedDepartmentIds !== null
          ? allRecords.filter(
              (r) => r.staff.departmentId !== null && allowedDepartmentIds.includes(r.staff.departmentId)
            )
          : allRecords

      // Aggregate data per staff
      const aggregated = new Map<
        string,
        {
          staff: (typeof records)[number]['staff']
          days: Record<string, DaySummary>
          totalPresents: number
          totalAbsents: number
          totalHalfDays: number
          totalLateMinutes: number
          totalWorkMinutes: number
        }
      >();

      records.forEach(record => {
        const staffId = record.staff.id;
        if (!aggregated.has(staffId)) {
          aggregated.set(staffId, {
            staff: record.staff,
            days: {},
            totalPresents: 0,
            totalAbsents: 0,
            totalHalfDays: 0,
            totalLateMinutes: 0,
            totalWorkMinutes: 0
          });
        }
        
        const stats = aggregated.get(staffId)!;
        
        // Add daily details
        const dateStr = format(record.date, 'yyyy-MM-dd');
        const isEmployed = isEmployedOnDate(record.staff, dateStr);
        const isPreSystem = Boolean(systemStartDate && dateStr < systemStartDate);

        if (!isEmployed || isPreSystem) {
          stats.days[dateStr] = {
            status: 'NOT_EMPLOYED',
            checkIn: null,
            checkOut: null,
            lateMinutes: 0,
            workMinutes: 0,
          };
        } else {
          stats.days[dateStr] = {
            status: record.status,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            lateMinutes: record.lateMinutes,
            workMinutes: record.workMinutes
          };
          
          const today = startOfDay(new Date());
          if (record.status === 'PRESENT') stats.totalPresents++;
          else if (record.status === 'ABSENT' && !isAfter(startOfDay(record.date), today)) stats.totalAbsents++;
          else if (record.status === 'HALF_DAY') stats.totalHalfDays++;
          
          stats.totalLateMinutes += record.lateMinutes;
          stats.totalWorkMinutes += record.workMinutes;
        }
      });

      // Convert map to array and sort by staff machineId
      const result = Array.from(aggregated.values()).sort((a, b) => 
        a.staff.machineId.localeCompare(b.staff.machineId, undefined, { numeric: true })
      );

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })

  } catch (error) {
    console.error('Reports API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch records' }, { status: 500 })
  }
}
