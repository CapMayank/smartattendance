"use client";

import { Fragment, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { CalendarOff, ChevronDown, Fingerprint, PencilLine, Search, Users } from "lucide-react";
import { Avatar, Chip, ChipGroup, EmptyState, Pagination, StatusBadge, Tabs, type Tone } from "@/components/ui";
import type { DashboardData } from "@/lib/dashboard";
import { formatTime } from "@/lib/format";
import { parseHHMM } from "@/lib/dashboard-calc";
import { cn } from "@/lib/cn";
import { PunchTimeline, formatDuration } from "./PunchTimeline";

type Row = DashboardData["staff"][number];
type Filter = "all" | "on-duty" | "late" | "absent";

const PAGE_SIZE = 12;
const DEFAULT_SHIFT_MINUTES = 360;

function avatarTone(status: Row["status"], workingDay: boolean): Tone | undefined {
  if (status === "on-duty") return "present";
  if (status === "late") return "late";
  if (status === "absent" && workingDay) return "absent";
  return undefined;
}

function shiftMinutes(shift: Row["shift"]) {
  if (!shift) return DEFAULT_SHIFT_MINUTES;
  const d = parseHHMM(shift.end) - parseHHMM(shift.start);
  return d > 0 ? d : DEFAULT_SHIFT_MINUTES;
}

function OffDayBadge() {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card-hi px-2.5 text-xs text-muted">
      <CalendarOff size={13} aria-hidden="true" />
      Off day
    </span>
  );
}

const dash = <span className="text-subtle">—</span>;

export function StaffToday({
  staff,
  punchLog,
  workingDay,
  now,
}: {
  staff: Row[];
  punchLog: DashboardData["punchLog"];
  workingDay: boolean;
  now: string;
}) {
  const [tab, setTab] = useState("staff");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const counts = useMemo(() => {
    const c = { all: staff.length, "on-duty": 0, late: 0, absent: 0 };
    for (const s of staff) {
      if (s.status === "on-duty" || s.status === "left") c["on-duty"]++;
      else if (s.status === "late") c.late++;
      else if (workingDay) c.absent++;
    }
    return c;
  }, [staff, workingDay]);

  const q = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      staff.filter((s) => {
        const okFilter =
          filter === "all" ||
          (filter === "on-duty" && (s.status === "on-duty" || s.status === "left")) ||
          (filter === "late" && s.status === "late") ||
          (filter === "absent" && s.status === "absent" && workingDay);
        const okQuery = !q || `${s.name} ${s.role} ${s.empId}`.toLowerCase().includes(q);
        return okFilter && okQuery;
      }),
    [staff, filter, q, workingDay],
  );
  const logRows = useMemo(
    () => punchLog.filter((p) => !q || `${p.name} ${p.empId}`.toLowerCase().includes(q)),
    [punchLog, q],
  );

  const list = tab === "staff" ? rows : logRows;
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const from = (current - 1) * PAGE_SIZE;

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function onRowKey(e: KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(id);
    }
  }

  const filters: { id: Filter; label: string; dot?: Tone }[] = [
    { id: "all", label: "All" },
    { id: "on-duty", label: "On duty", dot: "present" },
    { id: "late", label: "Late", dot: "late" },
    { id: "absent", label: "Absent", dot: "absent" },
  ];

  return (
    <section className="flex flex-col gap-4" aria-label="Staff today">
      <Tabs
        tabs={[
          { id: "staff", label: "Today’s staff", count: staff.length },
          { id: "log", label: "Punch log", count: punchLog.length },
        ]}
        value={tab}
        onChange={(id) => {
          setTab(id);
          setPage(1);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {tab === "staff" ? (
          <ChipGroup label="Filter staff by status">
            {filters.map((f) => (
              <Chip
                key={f.id}
                pressed={filter === f.id}
                dot={f.dot}
                count={counts[f.id]}
                onClick={() => {
                  setFilter(f.id);
                  setPage(1);
                }}
              >
                {f.label}
              </Chip>
            ))}
          </ChipGroup>
        ) : null}
        <label className="flex h-9 w-full items-center gap-2 rounded-[10px] border border-line px-3 text-subtle focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-acc-2 sm:ml-auto sm:w-[300px]">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Search staff</span>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={tab === "staff" ? "Search name, ID, role…" : "Search name or ID…"}
            className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-subtle"
          />
        </label>
      </div>

      <div className="table-wrap -mx-1.5">
        {tab === "staff" ? (
          <table className="data-table min-w-[980px]">
            <thead>
              <tr>
                <th>Staff</th>
                <th>Department</th>
                <th>First in</th>
                <th>Last out</th>
                <th>On duty</th>
                <th>Punches</th>
                <th>Status</th>
                <th className="text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState icon={Users} title={staff.length ? "No staff match this filter" : "No staff on roll"} />
                  </td>
                </tr>
              ) : (
                rows.slice(from, from + PAGE_SIZE).map((s) => {
                  const expanded = open.has(s.id);
                  const first = s.punches[0];
                  const last = s.punches[s.punches.length - 1];
                  const lastOut = last && last.type === "OUT" ? last : null;
                  const devices = [...new Set(s.punches.map((p) => p.device).filter((d): d is string => !!d))];
                  return (
                    <Fragment key={s.id}>
                      <tr
                        tabIndex={0}
                        aria-expanded={expanded}
                        onClick={() => toggle(s.id)}
                        onKeyDown={(e) => onRowKey(e, s.id)}
                        className={cn("cursor-pointer", expanded && "[&>td]:bg-card-hi/40")}
                      >
                        <td className="max-w-[260px]">
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar name={s.name} status={avatarTone(s.status, workingDay)} />
                            <div className="min-w-0">
                              <b className="block truncate font-medium text-text">{s.name}</b>
                              <small className="block truncate text-xs text-subtle">
                                {s.role} · <span className="num">{s.empId}</span>
                              </small>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[160px] truncate text-[12.5px] text-muted">{s.department}</td>
                        <td className="num">
                          {first ? (
                            <>
                              {formatTime(new Date(first.at))}
                              {s.lateBy > 0 ? <small className="block text-xs text-late">+{s.lateBy} min</small> : null}
                            </>
                          ) : (
                            dash
                          )}
                        </td>
                        <td className="num">{lastOut ? formatTime(new Date(lastOut.at)) : dash}</td>
                        <td>
                          {first ? (
                            <div className="flex items-center gap-2.5">
                              <div className="h-1.5 w-[84px] overflow-hidden rounded-full bg-card-hi">
                                <div
                                  className="h-full rounded-full bg-linear-to-r from-acc-2 to-acc-1"
                                  style={{ width: `${Math.min(100, (s.dutyMinutes / shiftMinutes(s.shift)) * 100)}%` }}
                                />
                              </div>
                              <span className="num text-muted">{formatDuration(s.dutyMinutes)}</span>
                            </div>
                          ) : (
                            dash
                          )}
                        </td>
                        <td>
                          {s.punches.length ? (
                            <div
                              className="flex items-center gap-1"
                              title={s.punches.map((p) => `${formatTime(new Date(p.at))} ${p.type}`).join(", ")}
                            >
                              {s.punches.slice(0, 8).map((p, i) => (
                                <i
                                  key={i}
                                  className={cn("block size-[9px] rounded-[3px]", p.type === "IN" ? "bg-present" : "bg-subtle")}
                                />
                              ))}
                              <span className="num ml-1.5 text-subtle">{s.punches.length}</span>
                            </div>
                          ) : (
                            dash
                          )}
                        </td>
                        <td>
                          {s.status === "absent" && !workingDay ? <OffDayBadge /> : <StatusBadge status={s.status} />}
                        </td>
                        <td className="text-right">
                          <span className="inline-flex gap-1">
                            <Link
                              href={`/attendance/manual?staffId=${encodeURIComponent(s.id)}`}
                              aria-label={`Add manual punch for ${s.name}`}
                              onClick={(e) => e.stopPropagation()}
                              title="Manual punch"
                              className="grid size-[30px] place-items-center rounded-lg border border-transparent text-subtle transition-colors duration-150 hover:border-line hover:text-text"
                            >
                              <PencilLine size={16} aria-hidden="true" />
                            </Link>
                            <button
                              type="button"
                              aria-expanded={expanded}
                              aria-label={`${expanded ? "Hide" : "Show"} punches for ${s.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(s.id);
                              }}
                              className="grid size-[30px] place-items-center rounded-lg border border-transparent text-subtle transition-colors duration-150 hover:border-line hover:text-text"
                            >
                              <ChevronDown
                                size={16}
                                aria-hidden="true"
                                className={cn("transition-transform duration-150", expanded && "rotate-180")}
                              />
                            </button>
                          </span>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={8} className="border-t-0! bg-card-hi/40! px-3! pt-0! pb-4!">
                            {s.punches.length ? (
                              <>
                                <PunchTimeline punches={s.punches} shift={s.shift} now={now} />
                                <div className="flex flex-wrap gap-x-[22px] gap-y-1 pt-3.5 text-[12.5px] text-muted sm:pl-[62px]">
                                  <span>
                                    Shift{" "}
                                    <b className="num font-medium text-text">
                                      {s.shift ? `${s.shift.start}–${s.shift.end}` : "None assigned"}
                                    </b>
                                  </span>
                                  <span>
                                    Devices <b className="font-medium text-text">{devices.length ? devices.join(", ") : "Not recorded"}</b>
                                  </span>
                                  <span>
                                    On duty so far <b className="num font-medium text-text">{formatDuration(s.dutyMinutes)}</b>
                                  </span>
                                  <span className={cn("num", s.punches.length <= 6 && "sr-only")}>
                                    <span className="sr-only">Punches: </span>
                                    {s.punches
                                      .map((p) => `${formatTime(new Date(p.at))} ${p.type}${p.device ? ` (${p.device})` : ""}`)
                                      .join(s.punches.length <= 6 ? ", " : " · ")}
                                  </span>
                                </div>
                              </>
                            ) : (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-[12.5px] text-muted sm:pl-[62px]">
                                <span>{workingDay ? "No punch today" : "No punch · off day"}</span>
                                <Link href={`/attendance/manual?staffId=${encodeURIComponent(s.id)}`} className="text-acc-2 hover:underline">
                                  Add manual punch
                                </Link>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table min-w-[640px]">
            <thead>
              <tr>
                <th>Time</th>
                <th>Staff</th>
                <th>ID</th>
                <th>Device</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {logRows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon={Fingerprint} title={punchLog.length ? "No punches match this search" : "No punches yet today"} />
                  </td>
                </tr>
              ) : (
                logRows.slice(from, from + PAGE_SIZE).map((p, i) => (
                  <tr key={`${p.at}-${p.empId}-${i}`}>
                    <td className="num">{formatTime(new Date(p.at))}</td>
                    <td className="max-w-[260px] truncate text-text">{p.name}</td>
                    <td className="num text-muted">{p.empId}</td>
                    <td className="text-muted">{p.device ?? dash}</td>
                    <td>
                      <StatusBadge status={p.type === "IN" ? "on-duty" : "left"}>{p.type}</StatusBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-1 text-[12.5px] text-subtle">
        <span>
          {list.length === 0 ? (
            "Nothing to show"
          ) : (
            <>
              Showing <span className="num text-muted">{from + 1}–{Math.min(from + PAGE_SIZE, list.length)}</span> of{" "}
              <span className="num text-muted">{list.length}</span> {tab === "staff" ? "staff · select a row to see the day’s punches" : "punches"}
            </>
          )}
        </span>
        <div className="ml-auto">
          <Pagination page={current} pageCount={pageCount} onPage={setPage} />
        </div>
      </div>
    </section>
  );
}
