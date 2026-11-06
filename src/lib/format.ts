export const SCHOOL_TZ = "Asia/Kolkata";

export function formatINR(amount: number, opts: { paise?: boolean } = {}): string {
  const digits = opts.paise ? 2 : 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHOOL_TZ,
  hour: "2-digit",
  minute: "2-digit",
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

/** "Friday, 6 November 2026" in IST */
export function formatDateLong(d: Date): string {
  const parts = Object.fromEntries(
    dateLongFmt.formatToParts(d).map((p) => [p.type, p.value]),
  );
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
}
