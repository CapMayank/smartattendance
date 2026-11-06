import { prisma } from '@/lib/prisma'
import { startOfDay, endOfDay, eachDayOfInterval, isAfter } from 'date-fns'
import { evaluateDay, type DayPolicy } from '@/lib/attendance-day'

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

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

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

    const isFutureDate = isAfter(startOfDay(date), startOfDay(new Date()));

    for (const staff of staffList) {
      const myLogs = staffLogs[staff.id] || [];

      // If the date is strictly in the future and has no punches, skip creating any record
      if (isFutureDate && myLogs.length === 0) {
        continue;
      }

      const result = evaluateDay({
        date,
        logs: myLogs,
        shift: staff.shift,
        policy: policy as DayPolicy,
        isHoliday,
        isWeekOff
      });

        if (!lockedKeys.has(`${staff.id}-${date.getMonth() + 1}-${date.getFullYear()}`)) {
          newRecords.push({
            staffId: staff.id,
            date: startOfDay(date),
            ...result
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
            gte: startOfDay(startDate),
            lte: startOfDay(endDate)
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
            gte: startOfDay(startDate),
            lte: startOfDay(endDate)
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

  return newRecords.length;
}
