import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, eachDayOfInterval, differenceInMinutes, parse, isAfter } from 'date-fns'

export async function recalculateAttendance(startDate: Date, endDate: Date) {
  const dateRange = eachDayOfInterval({
    start: startOfDay(startDate),
    end: startOfDay(endDate)
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
        gte: startOfDay(startDate),
        lte: startOfDay(endDate)
      }
    }
  });
  
  const holidayMap = new Map(holidays.map(h => [h.date.getTime(), h.name]));
  const weekOffDays = (policy as any).weekOffDays ? (policy as any).weekOffDays.split(',').map(Number) : [0]; // default Sunday

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

      const dayOfWeek = date.getDay();
      const dateKey = startOfDay(date).getTime();
      const isHoliday = holidayMap.has(dateKey);
      const isWeekOff = weekOffDays.includes(dayOfWeek);

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

      newRecords.push({
        staffId: staff.id,
        date: startOfDay(date),
        status,
        checkIn,
        checkOut,
        lateMinutes,
        workMinutes,
        overtimeMinutes: 0
      });
    }
  }

  // Use a transaction to safely delete and replace to prevent race conditions
  await prisma.$transaction(async (tx) => {
    // Delete existing records in the date range to recalculate
    await tx.dailyRecord.deleteMany({
      where: {
        date: {
          gte: startOfDay(startDate),
          lte: startOfDay(endDate)
        }
      }
    });

    // Batch insert
    const chunkSize = 100;
    for (let i = 0; i < newRecords.length; i += chunkSize) {
      const chunk = newRecords.slice(i, i + chunkSize);
      await tx.dailyRecord.createMany({
        data: chunk,
      });
    }
  });

  return newRecords.length;
}
