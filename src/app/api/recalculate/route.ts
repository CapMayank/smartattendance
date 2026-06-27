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

    // Delete existing records in the date range to recalculate
    await prisma.dailyRecord.deleteMany({
      where: {
        date: {
          gte: startOfDay(startD),
          lte: startOfDay(endD)
        }
      }
    });

    const newRecords = [];

    for (const date of dateRange) {
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
             checkIn = myLogs[0].timestamp;
             checkOut = myLogs[myLogs.length - 1].timestamp;
             workMinutes = differenceInMinutes(checkOut, checkIn);
          }

          // Calculate Late Minutes based on shift
          if (staff.shift) {
            const shiftStart = parse(staff.shift.startTime, 'HH:mm', date);
            const expectedArrival = new Date(shiftStart.getTime() + lateAllowMins * 60000);
            
            if (isAfter(checkIn, expectedArrival)) {
              lateMinutes = differenceInMinutes(checkIn, shiftStart);
            }
          }

          if (workMinutes < absentWorkMins && absentWorkMins > 0) {
             status = 'ABSENT';
          } else if (workMinutes < halfDayWorkMins && halfDayWorkMins > 0) {
             status = 'HALF_DAY';
          }
        }

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

    await prisma.dailyRecord.createMany({
      data: newRecords,
    });

    return NextResponse.json({ success: true, recalculatedDays: dateRange.length, processedRecords: newRecords.length });

  } catch (error: any) {
    console.error('Recalculate Error:', error);
    return NextResponse.json({ error: 'Failed to recalculate data' }, { status: 500 });
  }
}
