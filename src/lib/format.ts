export const SCHOOL_TZ = "Asia/Kolkata";

/**
 * en-IN rupees. Default: whole rupees. `paise`: always 2 decimals.
 * `exact`: 0–3 decimals, for unrounded values (matches the old `toLocaleString()` digits).
 */
export function formatINR(amount: number, opts: { paise?: boolean; exact?: boolean } = {}): string {
  const digits = opts.paise ? 2 : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: opts.exact ? 3 : digits,
  }).format(amount);
}

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHOOL_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const timeSecondsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHOOL_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const dateLongFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHOOL_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "HH:mm" in IST */
export function formatTime(d: Date): string {
  return timeFmt.format(d);
}

/** "HH:mm:ss" in IST */
export function formatTimeSeconds(d: Date): string {
  return timeSecondsFmt.format(d);
}

/** "Friday, 6 November 2026" in IST */
export function formatDateLong(d: Date): string {
  const parts = Object.fromEntries(
    dateLongFmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
}

const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: SCHOOL_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dayMonthFmt = new Intl.DateTimeFormat("en-GB", { timeZone: SCHOOL_TZ, day: "numeric", month: "short" });

/** Last-ping text in IST: "HH:mm" when on the same IST day as `now`, otherwise "d MMM HH:mm". */
export function formatPing(d: Date, now: Date): string {
  if (dayKeyFmt.format(d) === dayKeyFmt.format(now)) return formatTime(d);
  return `${dayMonthFmt.format(d)} ${formatTime(d)}`;
}
