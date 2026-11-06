import { differenceInMinutes, parse, isAfter } from 'date-fns'

export type DayLog = { timestamp: Date; type: string }

export type DayPolicy = {
  lateArrivalAllow: string
  halfDayIfWorkHrsLessThan: string
  absentIfWorkHrsLessThan: string
  allInOut: string
}

export type DayResult = {
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'HOLIDAY' | 'WEEKOFF'
  checkIn: Date | null
  checkOut: Date | null
  lateMinutes: number
  workMinutes: number
  overtimeMinutes: 0
}

const parseTime = (timeStr: string) => {
  if (!timeStr) return 0
  const [hrs, mins] = timeStr.split(':').map(Number)
  return (hrs * 60) + (mins || 0)
}

/**
 * Pure per-person day evaluation. `date` is the day's local start and `logs`
 * are that person's punches for the day, ascending.
 */
export function evaluateDay(input: {
  date: Date
  logs: DayLog[]
  shift: { startTime: string } | null
  policy: DayPolicy
  isHoliday: boolean
  isWeekOff: boolean
}): DayResult {
  const { date, logs: myLogs, shift, policy, isHoliday, isWeekOff } = input

  const lateAllowMins = parseTime(policy.lateArrivalAllow)
  const halfDayWorkMins = parseTime(policy.halfDayIfWorkHrsLessThan)
  const absentWorkMins = parseTime(policy.absentIfWorkHrsLessThan)

  let status: DayResult['status'] = 'ABSENT'
  let checkIn: Date | null = null
  let checkOut: Date | null = null
  let workMinutes = 0
  let lateMinutes = 0

  if (myLogs.length > 0) {
    status = 'PRESENT'

    if (policy.allInOut === 'First IN Last OUT') {
      checkIn = myLogs[0].timestamp
      checkOut = myLogs[myLogs.length - 1].timestamp

      if (checkIn.getTime() !== checkOut.getTime()) {
        workMinutes = differenceInMinutes(checkOut, checkIn)
      }
    } else {
      // "Every IN OUT" calculation
      let totalMinutes = 0
      let currentIn: Date | null = null

      const hasExplicitOut = myLogs.some(l => l.type === 'OUT')
      const effectiveLogs = (myLogs.length > 1 && !hasExplicitOut)
        ? myLogs.map((l, idx) => ({ ...l, type: (idx === myLogs.length - 1 || idx % 2 === 1) ? 'OUT' : 'IN' }))
        : myLogs

      for (const log of effectiveLogs) {
        if (log.type === 'IN') {
          currentIn = log.timestamp
        } else if (log.type === 'OUT' && currentIn) {
          totalMinutes += differenceInMinutes(log.timestamp, currentIn)
          currentIn = null // Reset for next pair
        }
      }

      checkIn = myLogs[0].timestamp
      checkOut = myLogs[myLogs.length - 1].timestamp
      workMinutes = totalMinutes
    }

    // Calculate Late Minutes based on shift
    if (shift) {
      const shiftStart = parse(shift.startTime, 'HH:mm', date)
      const expectedArrival = new Date(shiftStart.getTime() + lateAllowMins * 60000)

      if (isAfter(checkIn, expectedArrival)) {
        lateMinutes = differenceInMinutes(checkIn, shiftStart)
      }
    }

    if (!isHoliday && !isWeekOff) {
      if (workMinutes < absentWorkMins && absentWorkMins > 0) {
        status = 'ABSENT'
      } else if (workMinutes < halfDayWorkMins && halfDayWorkMins > 0) {
        status = 'HALF_DAY'
      }
    }
  } else {
    // No logs. Check if it's a holiday or a week off
    if (isHoliday) {
      status = 'HOLIDAY'
    } else if (isWeekOff) {
      status = 'WEEKOFF'
    }
  }

  return { status, checkIn, checkOut, lateMinutes, workMinutes, overtimeMinutes: 0 }
}
