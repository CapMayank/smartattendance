export type EmploymentPeriodLite = {
  startDate: string; // YYYY-MM-DD
  endDate: string | null; // YYYY-MM-DD
};

export type StaffEmploymentProfile = {
  id: string;
  periods?: EmploymentPeriodLite[];
};

/**
 * Determines whether a staff member is considered employed on a specific date (YYYY-MM-DD).
 *
 * Rule 1 (Legacy Staff):
 * If `staff.periods` is undefined or empty (`length === 0`), return `true`.
 * Legacy staff without recorded employment periods are treated as active across all dates.
 *
 * Rule 2 (Active Period Check):
 * If `staff.periods` has items, return `true` if any period satisfies:
 *   `period.startDate <= dateKey && (period.endDate === null || period.endDate >= dateKey)`
 * Otherwise, return `false`.
 */
export function isEmployedOnDate(
  staff: StaffEmploymentProfile | null | undefined,
  dateKey: string
): boolean {
  if (!staff || !dateKey || typeof dateKey !== 'string' || dateKey.trim() === '') {
    return false;
  }

  const periods = staff.periods;
  if (!periods || periods.length === 0) {
    return true;
  }

  return periods.some((period) => {
    if (!period || !period.startDate) return false;
    const startMatches = period.startDate <= dateKey;
    const endMatches = !period.endDate || period.endDate >= dateKey;
    return startMatches && endMatches;
  });
}

export const isEmployed = isEmployedOnDate;
