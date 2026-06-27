import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import { recalculateAttendance } from '@/lib/attendance'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'daily'
    const dateParam = searchParams.get('date')
    const monthParam = searchParams.get('month') // e.g., "2026-06"
    
    if (type === 'daily') {
      if (!dateParam) return NextResponse.json({ error: 'Date is required for daily report' }, { status: 400 })
      
      const targetDate = new Date(dateParam)
      
      // Auto-recalculate for this specific day to ensure it's always up to date
      await recalculateAttendance(targetDate, targetDate);

      const records = await prisma.dailyRecord.findMany({
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
              shift: true
            }
          }
        },
        orderBy: {
          staff: {
            machineId: 'asc'
          }
        }
      })

      return NextResponse.json(records)
    } 
    else if (type === 'monthly') {
      if (!monthParam) return NextResponse.json({ error: 'Month is required for monthly report' }, { status: 400 })
      
      const [year, month] = monthParam.split('-').map(Number);
      const targetMonth = new Date(year, month - 1, 1);
      
      const sOfMonth = startOfMonth(targetMonth);
      const eOfMonth = endOfMonth(targetMonth);

      // Auto-recalculate for the entire month
      // Note: This might take a few seconds depending on the number of logs, but it guarantees up-to-date data.
      await recalculateAttendance(sOfMonth, eOfMonth);

      const records = await prisma.dailyRecord.findMany({
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
              shift: true
            }
          }
        }
      })

      // Aggregate data per staff
      const aggregated = new Map();

      records.forEach(record => {
        const staffId = record.staff.id;
        if (!aggregated.has(staffId)) {
          aggregated.set(staffId, {
            staff: record.staff,
            days: {} as Record<string, any>,
            totalPresents: 0,
            totalAbsents: 0,
            totalHalfDays: 0,
            totalLateMinutes: 0,
            totalWorkMinutes: 0
          });
        }
        
        const stats = aggregated.get(staffId);
        
        // Add daily details
        const dateStr = record.date.toISOString().split('T')[0];
        stats.days[dateStr] = {
          status: record.status,
          checkIn: record.checkIn,
          checkOut: record.checkOut,
          lateMinutes: record.lateMinutes,
          workMinutes: record.workMinutes
        };
        
        if (record.status === 'PRESENT') stats.totalPresents++;
        else if (record.status === 'ABSENT') stats.totalAbsents++;
        else if (record.status === 'HALF_DAY') stats.totalHalfDays++;
        
        stats.totalLateMinutes += record.lateMinutes;
        stats.totalWorkMinutes += record.workMinutes;
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
