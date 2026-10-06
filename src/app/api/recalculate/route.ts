import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { startOfDay, endOfDay, eachDayOfInterval, differenceInMinutes, parse, isBefore, isAfter, format } from 'date-fns'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { startDate, endDate } = await request.json().catch(() => ({}));

    // If no dates provided, calculate from the earliest log up to today
    let startD = startDate ? new Date(startDate) : null;
    let endD = endDate ? new Date(endDate) : new Date();

    if (!startD) {
      const earliestLog = await prisma.attendanceLog.findFirst({
        orderBy: { timestamp: 'asc' }
      });
      if (earliestLog) {
        startD = earliestLog.timestamp;
      } else {
        startD = new Date(); // Today
      }
    }

    const dateRange = eachDayOfInterval({
      start: startOfDay(startD),
      end: startOfDay(endD)
    });

    const staffList = await prisma.staff.findMany({
      include: { shift: true }
    });

    const policy = await prisma.policy.findFirst() || {
      lateArrivalAllow: "00:15",
      halfDayIfWorkHrsLessThan: "06:00",
      absentIfWorkHrsLessThan: "00:00",
      allInOut: "First IN Last OUT"
    };

    const parseTime = (timeStr: string) => {
      if (!timeStr) return 0;
      const [hrs, mins] = timeStr.split(':').map(Number);
      return (hrs * 60) + (mins || 0);
    };

    const lateAllowMins = parseTime(policy.lateArrivalAllow as string);
    const halfDayWorkMins = parseTime(policy.halfDayIfWorkHrsLessThan as string);
    const absentWorkMins = parseTime(policy.absentIfWorkHrsLessThan as string);

    const holidays = await prisma.holiday.findMany({
      where: {
        date: {
          gte: startOfDay(startD),
          lte: startOfDay(endD)
        }
      }
    });
    
    const holidayMap = new Map(holidays.map(h => [h.date.getTime(), h.name]));
    const weekOffDays = (policy as any).weekOffDays ? (policy as any).weekOffDays.split(',').map(Number) : [0]; // default Sunday

    // Deletion will happen safely at the end inside a transaction

    const startYear = startD.getFullYear();
    const endYear = endD.getFullYear();

    // Fetch all locked payrolls within this range to prevent modifying their daily records
    const lockedPayrolls = await prisma.monthlyPayroll.findMany({
      where: {
        isLocked: true,
        year: { gte: startYear, lte: endYear }
      },
      select: { staffId: true, month: true, year: true }
    });
    
    const lockedKeys = new Set(lockedPayrolls.map(p => `${p.staffId}-${p.month}-${p.year}`));

    const newRecords: any[] = [];

    for (const date of dateRange) {
      const dayOfWeek = date.getDay();
      const dateKey = startOfDay(date).getTime();
      const isHoliday = holidayMap.has(dateKey);
      const isWeekOff = weekOffDays.includes(dayOfWeek);

      // Find all logs for this date
      const logs = await prisma.attendanceLog.findMany({
        where: {
          timestamp: {
            gte: startOfDay(date),
            lte: endOfDay(date)
          }
        },
        orderBy: { timestamp: 'asc' }
      });

      // Group logs by staff
      const staffLogs: Record<string, typeof logs> = {};
      for (const log of logs) {
        if (!staffLogs[log.staffId]) staffLogs[log.staffId] = [];
        staffLogs[log.staffId].push(log);
      }

      for (const staff of staffList) {
        const myLogs = staffLogs[staff.id] || [];
        
        let status = 'ABSENT';
        let checkIn = null;
        let checkOut = null;
        let workMinutes = 0;
        let lateMinutes = 0;

        if (myLogs.length > 0) {
          status = 'PRESENT';
          
          if (policy.allInOut === 'First IN Last OUT') {
            checkIn = myLogs[0].timestamp;
            checkOut = myLogs[myLogs.length - 1].timestamp;
            
            if (checkIn.getTime() !== checkOut.getTime()) {
              workMinutes = differenceInMinutes(checkOut, checkIn);
            }
          } else {
             // "Every IN OUT" calculation
             let totalMinutes = 0;
             let currentIn = null;
             
             for (const log of myLogs) {
                if (log.type === 'IN') {
                   currentIn = log.timestamp;
                } else if (log.type === 'OUT' && currentIn) {
                   totalMinutes += differenceInMinutes(log.timestamp, currentIn);
                   currentIn = null; // Reset for next pair
                }
             }
             
             checkIn = myLogs[0].timestamp;
             checkOut = myLogs[myLogs.length - 1].timestamp;
             workMinutes = totalMinutes;
          }

          // Calculate Late Minutes based on shift
          if (staff.shift) {
            const shiftStart = parse(staff.shift.startTime, 'HH:mm', date);
            const expectedArrival = new Date(shiftStart.getTime() + lateAllowMins * 60000);
            
            if (isAfter(checkIn, expectedArrival)) {
              lateMinutes = differenceInMinutes(checkIn, shiftStart);
            }
          }

          if (!isHoliday && !isWeekOff) {
            if (workMinutes < absentWorkMins && absentWorkMins > 0) {
               status = 'ABSENT';
            } else if (workMinutes < halfDayWorkMins && halfDayWorkMins > 0) {
               status = 'HALF_DAY';
            }
          }
        } else {
          // No logs. Check if it's a holiday or a week off
          if (isHoliday) {
            status = 'HOLIDAY';
          } else if (isWeekOff) {
            status = 'WEEKOFF';
          }
        }

        if (!lockedKeys.has(`${staff.id}-${date.getMonth() + 1}-${date.getFullYear()}`)) {
          newRecords.push({
            staffId: staff.id,
            date: startOfDay(date),
            status,
            checkIn,
            checkOut,
            lateMinutes,
            workMinutes,
            overtimeMinutes: 0 // Simplification for now
          });
        }
      }
    }

    // Use a transaction to safely delete and replace to prevent race conditions
    await prisma.$transaction(async (tx) => {
      
      // Fast path: if no locked payrolls, just delete all in range
      if (lockedPayrolls.length === 0) {
        await tx.dailyRecord.deleteMany({
          where: {
            date: {
              gte: startOfDay(startD!),
              lte: startOfDay(endD)
            }
          }
        });
      } else {
        // Build conditions to exclude locked staff/months from deletion
        const lockedConditions = lockedPayrolls.map(p => {
          // Use local timezone to match the 'startOfDay' dates in the DB
          const startOfM = startOfDay(new Date(p.year, p.month - 1, 1));
          const endOfM = endOfDay(new Date(p.year, p.month, 0));
          return {
            staffId: p.staffId,
            date: { gte: startOfM, lte: endOfM }
          };
        });

        await tx.dailyRecord.deleteMany({
          where: {
            date: {
              gte: startOfDay(startD!),
              lte: startOfDay(endD)
            },
            NOT: { OR: lockedConditions }
          }
        });
      }

      // Batch insert valid new records
      const chunkSize = 100;
      for (let i = 0; i < newRecords.length; i += chunkSize) {
        const chunk = newRecords.slice(i, i + chunkSize);
        await tx.dailyRecord.createMany({
          data: chunk,
        });
      }
    });

    return NextResponse.json({ success: true, recalculatedDays: dateRange.length, processedRecords: newRecords.length });

  } catch (error: any) {
    console.error('Recalculate Error:', error);
    return NextResponse.json({ error: 'Failed to recalculate data' }, { status: 500 });
  }
}
