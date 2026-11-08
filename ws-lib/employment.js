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

function istDateKey(d) {
  if (!d) return '';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(dateObj.getTime() + istOffset);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${istDate.getUTCFullYear()}-${pad(istDate.getUTCMonth() + 1)}-${pad(istDate.getUTCDate())}`;
}

module.exports = {
  isEmployedOnDate,
  isEmployed: isEmployedOnDate,
  istDateKey,
};
