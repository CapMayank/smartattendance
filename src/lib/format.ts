export const SCHOOL_TZ = "Asia/Kolkata";

/**
 * en-IN rupees. Default: whole rupees. `paise`: always 2 decimals.
 * `exact`: 0-3 decimals, for unrounded values (matches the old `toLocaleString()` digits).
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

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHOOL_TZ,
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h12",
});

const timeSecondsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: SCHOOL_TZ,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h12",
});

// Built from parts so the output is always "9:42 am" (no locale-specific narrow spaces / casing).
function to12h(fmt: Intl.DateTimeFormat, d: Date): string {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const secs = p.second ? `:${p.second}` : "";
  return `${p.hour}:${p.minute}${secs} ${String(p.dayPeriod).toLowerCase()}`;
}

const dateLongFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHOOL_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "9:42 am" in IST */
export function formatTime(d: Date): string {
  return to12h(timeFmt, d);
}

/** "9:42:07 am" in IST */
export function formatTimeSeconds(d: Date): string {
  return to12h(timeSecondsFmt, d);
}

/** Stored 24h "HH:mm" (shift times) or "HH:mm:ss" -> "9:55 am". Returns the input unchanged if it isn't HH:mm. */
export function formatHHmm(s: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s ?? "");
  if (!m) return s;
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

/** formatTime for an ISO string / Date / 24h time string that may be missing; "-" when empty or invalid. */
export function formatTimeOpt(v?: string | Date | null): string {
  if (!v) return "-";
  if (typeof v === "string" && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(v)) {
    return formatHHmm(v);
  }
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : formatTime(d);
}

const dateShortFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHOOL_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** "DD-MM-YYYY" in IST (e.g. "06-11-2026") */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d || d === "-") return "-";
  if (typeof d === "string") {
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, day] = trimmed.split("-");
      return `${day}-${m}-${y}`;
    }
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const dateObj = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dateObj.getTime())) return "-";
  const p = Object.fromEntries(dateShortFmt.formatToParts(dateObj).map((x) => [x.type, x.value]));
  return `${p.day}-${p.month}-${p.year}`;
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
