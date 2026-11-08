/**
 * CommonJS helper for employment date checks in Node ws-server.
 * Mirrors src/lib/employment.ts exactly.
 */

function isEmployedOnDate(staff, dateKey) {
  if (!staff || !dateKey || typeof dateKey !== 'string' || dateKey.trim() === '') {
    return false;
  }

  const periods = staff.periods || staff.employmentPeriods;
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

module.exports = {
  isEmployedOnDate,
  isEmployed: isEmployedOnDate,
};
