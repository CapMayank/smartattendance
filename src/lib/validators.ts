// Shared input validators for API routes. Day keys and times are plain strings in
// this app (`YYYY-MM-DD` in India time, `HH:MM` 24-hour), so they are checked as text.

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** `HH:MM` in 24-hour time, zero-padded (e.g. "08:05", "23:59"). */
export function isTimeHHMM(value: unknown): value is string {
  return typeof value === 'string' && TIME_REGEX.test(value)
}

/** A real calendar date written `YYYY-MM-DD` (rejects e.g. 2026-02-30). */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_KEY_REGEX.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function isPunchType(value: unknown): value is 'IN' | 'OUT' {
  return value === 'IN' || value === 'OUT'
}

/** Whole-number month (1-12) and a plausible four-digit year, from query or JSON input. */
export function parseMonthYear(month: unknown, year: unknown): { month: number; year: number } | null {
  const m = typeof month === 'string' && month.trim() !== '' ? Number(month) : month
  const y = typeof year === 'string' && year.trim() !== '' ? Number(year) : year
  if (typeof m !== 'number' || typeof y !== 'number') return null
  if (!Number.isInteger(m) || !Number.isInteger(y)) return null
  if (m < 1 || m > 12 || y < 2000 || y > 2100) return null
  return { month: m, year: y }
}

/** True when a Prisma error is a unique-constraint violation. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}
