// Server only: Prisma reads for the Dashboard page.
import { prisma } from "@/lib/prisma";
import { formatPing } from "@/lib/format";
import { runDetection } from "@/lib/shift-suggestions";
import {
  absenceStreak,
  arrivalsWindow,
  binArrivals,
  dutyMinutes,
  formatHHMM,
  hasMissingOut,
  inferPunchTypes,
  istDateKey,
  isDeviceOnline,
  isLate,
  istDayStart,
  istMinutes,
  lateMinutes,
  normalizeAllow,
  parseHHMM,
  weekdayDelta,
} from "@/lib/dashboard-calc";
import { shiftOn, shiftStartForDay, type AssignmentLite, type ShiftLite } from "@/lib/shift-lookup";

type Delta = ReturnType<typeof weekdayDelta>;
export type StaffStatus = "on-duty" | "left" | "late" | "absent";
export type PunchType = "IN" | "OUT";

export type DashboardData = {
  kpis: {
    inToday: number;
    total: number;
    late: number;
    absent: number;
    devicesOnline: number;
    devicesTotal: number;
    deltas: { in: Delta; late: Delta; absent: Delta };
    /** 7 working days, oldest first. `devices` is empty: device ping history is not stored. */
    spark: { in: number[]; late: number[]; absent: number[]; devices: number[] };
  };
  /** binArrivals bins; an extra leading/trailing bin collects arrivals outside the window (`overflow`). */
  arrivals: (ReturnType<typeof binArrivals>[number] & { overflow?: "before" | "after" })[];
  /** Most common (start, end) shift among staff; header text and grace both derive from it. */
  commonShift: { start: string; end: string } | null;
  graceLabel: string | null;
  ring: { onTime: number; late: number; absent: number };
  departments: { name: string; present: number; total: number }[];
  attention: {
    kind: "absent-streak" | "late-repeat" | "device-offline" | "missing-out" | "shift-suggestions";
    title: string;
    detail: string;
    href: string;
  }[];
  /** Attention items that did not fit in the list (addition beyond the brief's type). */
  attentionMore: number;
  trend: { date: string; label: string; weekday: string; onTime: number; late: number; saturday: boolean }[];
  staff: {
    id: string;
    name: string;
    role: string;
    empId: string;
    /** Profile picture version (id of the current photo), null when the teacher has none. */
    photoId: string | null;
    department: string;
    shift: { start: string; end: string } | null;
    punches: { at: string; type: PunchType; device: string | null }[];
    status: StaffStatus;
    lateBy: number;
    dutyMinutes: number;
  }[];
  punchLog: { at: string; name: string; empId: string; device: string | null; type: PunchType }[];
  /** Additions beyond the brief's type: today is a week-off day or a Holiday. */
  workingDay: boolean;
  offDayName: string | null;
  /** ISO of the `now` the data was computed for. */
  now: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const LOG_WINDOW_DAYS = 30;
const TREND_DAYS = 15;
const SPARK_DAYS = 7;
const MAX_ATTENTION = 5;
const ARRIVAL_SLOT = 15;

const labelFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const weekdayLongFmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" });

export { istDateKey };

/** Weekday (0 = Sunday) of an IST date key. */
function keyWeekday(key: string): number {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

function keyNoon(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

function mostCommon<T>(values: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
}

export async function getDashboardData(now: Date): Promise<DashboardData> {
  const todayStart = istDayStart(now);
  const windowStart = istDayStart(new Date(todayStart.getTime() - LOG_WINDOW_DAYS * DAY_MS + DAY_MS / 2));

  const [staffRows, logs, devices, holidays, policy, assignmentRows, shiftRows] = await Promise.all([
    prisma.staff.findMany({
      include: { department: true, designation: true, shift: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceLog.findMany({
      where: { timestamp: { gte: windowStart, lte: now } },
      select: { staffId: true, timestamp: true, type: true },
      orderBy: { timestamp: "asc" },
    }),
    prisma.device.findMany({ orderBy: { name: "asc" } }),
    prisma.holiday.findMany({
      where: { date: { gte: new Date(windowStart.getTime() - DAY_MS), lte: new Date(now.getTime() + DAY_MS) } },
    }),
    prisma.policy.findFirst(),
    prisma.shiftAssignment.findMany(),
    prisma.shift.findMany(),
  ]);

  const shiftsById = new Map<string, ShiftLite>(shiftRows.map((sh) => [sh.id, sh]));
  const assignmentsByStaff = new Map<string, AssignmentLite[]>();
  for (const a of assignmentRows) {
    const list = assignmentsByStaff.get(a.staffId);
    const item = { effectiveFrom: a.effectiveFrom, shiftId: a.shiftId };
    if (list) list.push(item);
    else assignmentsByStaff.set(a.staffId, [item]);
  }

  const allow = policy?.lateArrivalAllow ?? "00:15";
  const weekOff = new Set(
    (policy?.weekOffDays ?? "0")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(Number)
      .filter((n) => Number.isInteger(n)),
  );
  const holidayByKey = new Map(holidays.map((h) => [istDateKey(h.date), h.name]));

  // ---- Calendar: IST day keys, newest first, from today back to the window start ----
  const todayKey = istDateKey(now);
  const days: { key: string; start: Date }[] = [];
  for (let start = todayStart; start.getTime() >= windowStart.getTime(); ) {
    days.push({ key: istDateKey(start), start });
    start = istDayStart(new Date(start.getTime() - DAY_MS / 2));
  }
  const isWorking = (key: string) => !weekOff.has(keyWeekday(key)) && !holidayByKey.has(key);
  const workingDayKeys = days.map((d) => d.key).filter(isWorking); // newest first
  const workingDay = isWorking(todayKey);
  const offDayName = workingDay
    ? null
    : (holidayByKey.get(todayKey) ?? weekdayLongFmt.format(keyNoon(todayKey)));

  // ---- Group logs by staff and IST day ----
  const logsByStaffDay = new Map<string, Map<string, { timestamp: Date; type: string }[]>>();
  for (const l of logs) {
    const key = istDateKey(l.timestamp);
    let byDay = logsByStaffDay.get(l.staffId);
    if (!byDay) logsByStaffDay.set(l.staffId, (byDay = new Map()));
    const arr = byDay.get(key);
    if (arr) arr.push(l);
    else byDay.set(key, [l]);
  }

  const staffInfo = staffRows.map((s) => ({
    row: s,
    assignments: assignmentsByStaff.get(s.id) ?? [],
    /** Shift start applying on an IST day key (blank start counts as none). */
    startOn: (key: string): string | null =>
      shiftStartForDay(assignmentsByStaff.get(s.id) ?? [], s.shiftId, shiftsById, key)?.trim() || null,
    joinedKey: istDateKey(s.createdAt),
    byDay: logsByStaffDay.get(s.id) ?? new Map<string, { timestamp: Date; type: string }[]>(),
  }));

  /**
   * present / late counts for one IST day. Roster rule: a staff member only counts from their
   * createdAt date onward, so staff added after their earliest imported punches drop out of earlier
   * days in the trend and in the same-weekday comparison.
   */
  /** `cutoff` limits the day to punches at or before that instant (same time-of-day comparisons). */
  function dayStats(key: string, cutoff?: Date) {
    let roster = 0;
    let present = 0;
    let late = 0;
    for (const s of staffInfo) {
      if (s.joinedKey > key) continue;
      roster++;
      const dayLogs = s.byDay.get(key);
      if (!dayLogs || dayLogs.length === 0) continue;
      if (cutoff && dayLogs[0].timestamp.getTime() > cutoff.getTime()) continue;
      present++;
      if (isLate(dayLogs[0].timestamp, s.startOn(key), allow)) late++;
    }
    return { roster, present, late, absent: isWorking(key) ? roster - present : 0 };
  }

  // ---- Today: per-staff rows ----
  const nowIso = now.toISOString();
  const firstPunches: { at: Date; late: boolean }[] = [];
  const punchLog: DashboardData["punchLog"] = [];
  const staff: DashboardData["staff"] = staffInfo.map(({ row, assignments, startOn, byDay }) => {
    const shiftStart = startOn(todayKey);
    const todayLogs = byDay.get(todayKey) ?? [];
    const types = inferPunchTypes(todayLogs);
    const punches = todayLogs.map((l, i) => ({ at: l.timestamp, type: types[i] }));
    const first = todayLogs[0]?.timestamp ?? null;
    const late = first ? isLate(first, shiftStart, allow) : false;
    const lateBy = first && late ? lateMinutes(first, shiftStart) : 0;
    if (first) firstPunches.push({ at: first, late });
    for (const p of punches) {
      punchLog.push({ at: p.at.toISOString(), name: row.name, empId: row.machineId, device: null, type: p.type });
    }
    let status: StaffStatus;
    if (!first) status = "absent";
    else if (late) status = "late";
    else status = types[types.length - 1] === "OUT" ? "left" : "on-duty";
    const shiftEnd = shiftOn(assignments, row.shiftId, shiftsById, todayKey)?.endTime?.trim();
    return {
      id: row.id,
      name: row.name,
      role: row.designation?.name ?? "—",
      empId: row.machineId,
      photoId: row.profilePhotoId ?? null,
      department: row.department?.name ?? "Unassigned",
      shift: shiftStart ? { start: shiftStart, end: shiftEnd || shiftStart } : null,
      // AttendanceLog has no device relation in the schema
      punches: punches.map((p) => ({ at: p.at.toISOString(), type: p.type, device: null })),
      status,
      lateBy,
      dutyMinutes: dutyMinutes(punches, now),
    };
  });
  punchLog.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const total = staff.length;
  const inToday = staff.filter((s) => s.status !== "absent").length;
  const lateToday = staff.filter((s) => s.status === "late").length;
  const absentToday = workingDay ? total - inToday : 0;
  const devicesOnline = devices.filter((d) => isDeviceOnline(d.lastPing, now)).length;

  // ---- KPIs: deltas vs same weekday last week, sparks over 7 working days ----
  const lastWeekKey = istDateKey(new Date(todayStart.getTime() - 7 * DAY_MS + DAY_MS / 2));
  // Same weekday last week, cut at the same IST time of day as now (IST has no DST, so exactly −7 days).
  const lastWeek = dayStats(lastWeekKey, new Date(now.getTime() - 7 * DAY_MS));
  const sparkKeys = workingDayKeys.slice(0, SPARK_DAYS).reverse();
  const sparkStats = sparkKeys.map((k) => dayStats(k));

  // ---- Grace: most common (start, end) shift, plus allow ----
  const commonKey = mostCommon(
    staff.filter((s) => s.shift).map((s) => `${s.shift!.start}|${s.shift!.end}`),
  );
  const commonShift = commonKey ? { start: commonKey.split("|")[0], end: commonKey.split("|")[1] } : null;
  const commonStart = commonShift?.start ?? null;
  const graceLabel = commonStart ? formatHHMM(parseHHMM(commonStart) + parseHHMM(normalizeAllow(allow))) : null;

  // ---- Departments ----
  const deptMap = new Map<string, { name: string; present: number; total: number }>();
  for (const s of staff) {
    const d = deptMap.get(s.department) ?? { name: s.department, present: 0, total: 0 };
    d.total++;
    if (s.status !== "absent") d.present++;
    deptMap.set(s.department, d);
  }
  const departments = [...deptMap.values()].sort((a, b) => {
    if (a.name === "Unassigned") return 1;
    if (b.name === "Unassigned") return -1;
    return b.total - a.total || a.name.localeCompare(b.name);
  });

  // ---- Trend: 15 working days (30-day log window leaves room for holidays), oldest first ----
  const trend = workingDayKeys
    .slice(0, TREND_DAYS)
    .reverse()
    .map((key) => {
      const st = dayStats(key);
      const noon = keyNoon(key);
      return {
        date: key,
        label: labelFmt.format(noon),
        weekday: weekdayFmt.format(noon),
        onTime: st.present - st.late,
        late: st.late,
        saturday: keyWeekday(key) === 6,
      };
    });

  // ---- Needs attention ----
  const pastWorking = workingDayKeys.filter((k) => k !== todayKey); // newest first
  const streaks: (DashboardData["attention"][number] & { n: number })[] = [];
  const lateRepeats: (DashboardData["attention"][number] & { n: number })[] = [];
  const weekStartKey = (() => {
    // Monday of the current Mon–Sat week
    const back = (keyWeekday(todayKey) + 6) % 7;
    return istDateKey(new Date(todayStart.getTime() - back * DAY_MS + DAY_MS / 2));
  })();

  staffInfo.forEach((s, i) => {
    const info = staff[i];
    const who = `${info.role} · ${info.department}`;
    const href = `/reports/member-attendance?staffId=${encodeURIComponent(s.row.id)}`;

    // Completed working days only (today is still in progress); present today breaks the streak.
    if (info.status === "absent") {
      const eligible = pastWorking.filter((k) => k >= s.joinedKey);
      const present = new Set(s.byDay.keys());
      const n = absenceStreak(present, eligible);
      if (n >= 3) {
        const lastSeen = [...present].sort().at(-1);
        // A streak that reaches the start of the log window may be longer than we can see.
        const capped = n === eligible.length && s.joinedKey < days[days.length - 1].key;
        streaks.push({
          kind: "absent-streak",
          title: `${s.row.name} absent ${n}${capped ? "+" : ""} working days running`,
          detail: lastSeen
            ? `${who} · last punch ${labelFmt.format(keyNoon(lastSeen))}`
            : `${who} · no punch in the last ${LOG_WINDOW_DAYS} days`,
          href,
          n,
        });
      }
    }

    let lateCount = 0;
    let lateSum = 0;
    for (const [key, dayLogs] of s.byDay) {
      if (key < weekStartKey || key > todayKey || !isWorking(key) || dayLogs.length === 0) continue;
      const first = dayLogs[0].timestamp;
      const startKey = s.startOn(key);
      if (isLate(first, startKey, allow)) {
        lateCount++;
        lateSum += lateMinutes(first, startKey);
      }
    }
    if (lateCount >= 3) {
      lateRepeats.push({
        kind: "late-repeat",
        title: `${s.row.name} late ${lateCount} times this week`,
        detail: `${who} · avg ${Math.round(lateSum / lateCount)} min`,
        href,
        n: lateCount,
      });
    }
  });
  streaks.sort((a, b) => b.n - a.n);
  lateRepeats.sort((a, b) => b.n - a.n);

  const offlineDevices = devices.filter((d) => !isDeviceOnline(d.lastPing, now));
  const lastPingText = (d: Date) =>
    `${istDateKey(d) === todayKey ? "today " : ""}${formatPing(d, now)}`;
  const offline: DashboardData["attention"] =
    offlineDevices.length === 0
      ? []
      : offlineDevices.length === 1
        ? [
            {
              kind: "device-offline",
              title: `${offlineDevices[0].name} device offline`,
              detail: `Last ping ${lastPingText(offlineDevices[0].lastPing)}`,
              href: "/devices",
            },
          ]
        : [
            {
              kind: "device-offline",
              title: `${offlineDevices.length} devices offline`,
              detail: `${offlineDevices
                .slice(0, 3)
                .map((d) => d.name)
                .join(", ")}${offlineDevices.length > 3 ? ` +${offlineDevices.length - 3}` : ""}`,
              href: "/devices",
            },
          ];

  // Missing OUT on the previous working day, derived from the punch logs (DailyRecord is only
  // written when a recalculation runs).
  const prevKey = pastWorking[0] ?? null;
  const missing: DashboardData["attention"] = [];
  if (prevKey) {
    const open = staffInfo.filter((s) => hasMissingOut(s.byDay.get(prevKey) ?? []));
    if (open.length > 0) {
      const yesterdayKey = istDateKey(new Date(todayStart.getTime() - DAY_MS / 2));
      const when = prevKey === yesterdayKey ? "yesterday" : `on ${weekdayFmt.format(keyNoon(prevKey))} ${labelFmt.format(keyNoon(prevKey))}`;
      const names = open.map((s) => s.row.name);
      missing.push({
        kind: "missing-out",
        title: open.length === 1 ? `${names[0]} missing OUT punch ${when}` : `${open.length} missing OUT punches ${when}`,
        detail:
          open.length === 1
            ? "Add the OUT punch before payroll is locked"
            : `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}`,
        href: "/attendance/manual",
      });
    }
  }

  // Shift suggestions: detection is throttled (once per 6 hours) and must never break the Dashboard.
  let pendingSuggestions = 0;
  try {
    await runDetection();
    pendingSuggestions = await prisma.shiftSuggestion.count({ where: { status: "PENDING" } });
  } catch (error) {
    console.error("[dashboard] shift detection failed:", error);
  }
  const suggestionItems: DashboardData["attention"] =
    pendingSuggestions > 0
      ? [
          {
            kind: "shift-suggestions",
            title: pendingSuggestions === 1 ? "1 shift suggestion to review" : `${pendingSuggestions} shift suggestions to review`,
            detail: "Teachers whose real arrival time differs from their shift",
            href: "/shifts",
          },
        ]
      : [];

  // Devices and the payroll-relevant missing OUT always make the cut; then up to 2 of each
  // person-kind; then fill from what is left.
  type Ranked = DashboardData["attention"][number] & { n: number };
  const strip = (r: Ranked): DashboardData["attention"][number] => ({
    kind: r.kind,
    title: r.title,
    detail: r.detail,
    href: r.href,
  });
  const primary = [...offline, ...missing, ...suggestionItems, ...streaks.slice(0, 2).map(strip), ...lateRepeats.slice(0, 2).map(strip)];
  const extra = [...streaks.slice(2).map(strip), ...lateRepeats.slice(2).map(strip)];
  const order = { "absent-streak": 0, "late-repeat": 1, "device-offline": 2, "missing-out": 3, "shift-suggestions": 4 } as const;
  const attention = [...primary.slice(0, MAX_ATTENTION), ...extra]
    .slice(0, MAX_ATTENTION)
    .sort((a, b) => order[a.kind] - order[b.kind]);
  const attentionMore = primary.length + extra.length - attention.length;

  // Table order (mockup): present staff by first punch, then absent alphabetically (staffRows is by name).
  const staffOrdered = [...staff].sort((a, b) => {
    const pa = a.punches[0]?.at;
    const pb = b.punches[0]?.at;
    if (pa && pb) return pa < pb ? -1 : pa > pb ? 1 : 0;
    if (pa) return -1;
    if (pb) return 1;
    return 0;
  });

  // Arrivals: the window around the common shift start, plus an overflow bin on each side
  // only when some first punch falls outside it (binArrivals clamps into its end bins).
  const { from: arrFrom, to: arrTo } = arrivalsWindow(commonStart);
  const early = firstPunches.some((p) => istMinutes(p.at) < arrFrom);
  const lateOver = firstPunches.some((p) => istMinutes(p.at) >= arrTo);
  const arrivals: DashboardData["arrivals"] = binArrivals(
    firstPunches,
    formatHHMM(Math.max(0, arrFrom - (early ? ARRIVAL_SLOT : 0))),
    formatHHMM(Math.min(1439, arrTo + (lateOver ? ARRIVAL_SLOT : 0))),
    ARRIVAL_SLOT,
  );
  if (early) arrivals[0] = { ...arrivals[0], label: `<${formatHHMM(arrFrom)}`, overflow: "before" };
  if (lateOver) {
    const i = arrivals.length - 1;
    arrivals[i] = { ...arrivals[i], label: `${formatHHMM(arrTo)}+`, overflow: "after" };
  }

  return {
    kpis: {
      inToday,
      total,
      late: lateToday,
      absent: absentToday,
      devicesOnline,
      devicesTotal: devices.length,
      deltas: {
        in: weekdayDelta(inToday, lastWeek.present),
        late: weekdayDelta(lateToday, lastWeek.late),
        absent: weekdayDelta(absentToday, lastWeek.absent),
      },
      spark: {
        in: sparkStats.map((s) => s.present),
        late: sparkStats.map((s) => s.late),
        absent: sparkStats.map((s) => s.absent),
        devices: [],
      },
    },
    arrivals,
    commonShift,
    graceLabel,
    ring: { onTime: inToday - lateToday, late: lateToday, absent: absentToday },
    departments,
    attention,
    attentionMore,
    trend,
    staff: staffOrdered,
    punchLog,
    workingDay,
    offDayName,
    now: nowIso,
  };
}
