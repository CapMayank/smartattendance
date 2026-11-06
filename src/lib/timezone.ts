export const SCHOOL_TIMEZONE = "Asia/Kolkata"

/** Pin the process timezone to the school's (IST) so date-fns/Date day boundaries agree with the devices. */
export function ensureSchoolTimezone(env: Record<string, string | undefined> = process.env) {
  env.TZ = SCHOOL_TIMEZONE
  return env.TZ
}
