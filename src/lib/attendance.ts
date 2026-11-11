import { recalculateRange } from '@/lib/attendance-range'

/**
 * Recalculates daily records for the range and returns the number of records written.
 * With `staffId` only that person's records are recalculated; otherwise every staff member's.
 */
export async function recalculateAttendance(startDate: Date, endDate: Date, staffId?: string): Promise<number> {
  return (await recalculateRange({ startDate, endDate, ...(staffId ? { staffId } : {}) })).records
}
