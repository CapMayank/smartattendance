import { recalculateRange } from '@/lib/attendance-range'

/** Recalculates every staff's daily records for the range; returns the number of records written. */
export async function recalculateAttendance(startDate: Date, endDate: Date): Promise<number> {
  return (await recalculateRange({ startDate, endDate })).records
}
