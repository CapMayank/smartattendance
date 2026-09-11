import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { startOfMonth, endOfMonth, format, startOfDay, endOfDay } from 'date-fns'
import { recalculateAttendance } from '@/lib/attendance'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
      }
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const dailyRecords = await prisma.dailyRecord.findMany({
      where: {
        staffId: staffId,
        date: {
          gte: sOfMonth,
          lte: eOfMonth
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

    const days = dailyRecords.map(record => {
      const dateStr = format(record.date, 'yyyy-MM-dd');
      return {
        ...record,
        logs: logsByDate[dateStr] || []
      };
    });

    // Calculate totals
    const totalPresents = dailyRecords.filter(r => r.status === 'PRESENT').length;
    const totalAbsents = dailyRecords.filter(r => r.status === 'ABSENT').length;
    const totalHalfDays = dailyRecords.filter(r => r.status === 'HALF_DAY').length;
    const totalLateMinutes = dailyRecords.reduce((sum, r) => sum + r.lateMinutes, 0);
    const totalWorkMinutes = dailyRecords.reduce((sum, r) => sum + r.workMinutes, 0);

    return NextResponse.json({
      staff,
      days,
      summary: {
        totalPresents,
        totalAbsents,
        totalHalfDays,
        totalLateMinutes,
        totalWorkMinutes
      }
    })

  } catch (error) {
    console.error('Member Attendance API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch member attendance records' }, { status: 500 })
  }
}
