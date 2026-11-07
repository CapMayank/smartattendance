import { SCHOOL_TZ } from "@/lib/format";

type Row = { year: number; month: number; isLocked?: boolean | null; grossWage?: number | null; netPayment?: number | null };

/** Calendar month of `now` in school time, as a sortable number (year * 12 + month index). */
function monthIndexInSchoolTz(now: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: SCHOOL_TZ, year: "numeric", month: "numeric" })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return Number(p.year) * 12 + Number(p.month) - 1;
}

/**
 * Payroll is run at the end of a month, so rows for the month in progress are partial (or zero)
 * and would show as a false dip. Analytics therefore use only months that are finished, or that
 * were explicitly locked (finalised), and skip months whose gross is all zero.
 */
export function selectSettledPayrolls<T extends Row>(rows: T[], now: Date = new Date()): { rows: T[]; pendingMonth: { year: number; month: number } | null } {
  const current = monthIndexInSchoolTz(now);
  const byMonth = new Map<number, T[]>();
  for (const r of rows) {
    const k = r.year * 12 + r.month - 1;
    byMonth.set(k, [...(byMonth.get(k) ?? []), r]);
  }

  const kept: T[] = [];
  let pendingMonth: { year: number; month: number } | null = null;
  for (const [k, group] of byMonth) {
    const finished = k < current;
    const finalised = group.every((r) => r.isLocked);
    const hasMoney = group.some((r) => (r.grossWage || 0) > 0 || (r.netPayment || 0) > 0);
    if ((finished || finalised) && hasMoney) {
      kept.push(...group);
    } else if (k >= current && !finalised) {
      pendingMonth = { year: group[0].year, month: group[0].month };
    }
  }
  return { rows: kept, pendingMonth };
}
