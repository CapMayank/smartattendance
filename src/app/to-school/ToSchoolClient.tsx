"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  PlusCircle,
  Building,
  CalendarDays,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import type { ToSchoolData, ToSchoolDay } from "@/lib/to-school";
import { AttendanceIndexSidebar } from "@/components/calendar/AttendanceIndexSidebar";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const REASONS = [
  { value: "FORGOT_SWIPE", label: "Forgot to mark attendance / Missed terminal check" },
  { value: "DUTY_OUTSIDE", label: "Official on-duty assignment / Off-campus school duty" },
  { value: "DEVICE_OFFLINE", label: "Attendance terminal offline / Recognition error" },
  { value: "POWER_FAILURE", label: "Campus power outage / Terminal unavailable" },
  { value: "OTHER", label: "Other reason (specify details below)" },
];

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ToSchoolClient({
  initialData,
  staffId,
}: {
  initialData: ToSchoolData;
  staffId?: string;
}) {
  const [data, setData] = useState<ToSchoolData>(initialData);
  const [selectedYear, setSelectedYear] = useState<number>(initialData.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialData.month);
  const [isLoading, setIsLoading] = useState(false);

  const discrepancyDays = data.days.filter(
    (d) =>
      d.isEmployed &&
      !d.isSunday &&
      !d.isHoliday &&
      !d.isToday &&
      !d.hasPendingRequest &&
      ((d.checkIn && !d.checkOut) || (!d.checkIn && d.checkOut) || d.isNoShow)
  );
  const discrepancyCount = discrepancyDays.length;

  // Punch Request Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState<string>("");
  const [punchType, setPunchType] = useState<"BOTH" | "IN" | "OUT">("BOTH");
  const [requestedTime, setRequestedTime] = useState<string>("09:00");
  const [requestedInTime, setRequestedInTime] = useState<string>("09:00");
  const [requestedOutTime, setRequestedOutTime] = useState<string>("16:30");
  const [reason, setReason] = useState<string>("FORGOT_SWIPE");
  const [explanation, setExplanation] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function fetchMonthData(year: number, month: number) {
    setIsLoading(true);
    try {
      const q = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (staffId) q.set("staffId", staffId);

      const res = await fetch(`/api/employee/to-school?${q.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load calendar data");
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setSelectedYear(year);
        setSelectedMonth(month);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error loading calendar";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function handlePrevMonth() {
    let nextY = selectedYear;
    let nextM = selectedMonth - 1;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    fetchMonthData(nextY, nextM);
  }

  function handleNextMonth() {
    let nextY = selectedYear;
    let nextM = selectedMonth + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    fetchMonthData(nextY, nextM);
  }

  function openRegularizationModal(day: ToSchoolDay) {
    setModalDate(day.dateKey);
    // If checkIn was present but not checkOut, default to OUT
    if (day.checkIn && !day.checkOut) {
      setPunchType("OUT");
      setRequestedTime("16:30");
    } else if (!day.checkIn && day.checkOut) {
      setPunchType("IN");
      setRequestedTime("09:00");
    } else {
      setPunchType("BOTH");
      setRequestedInTime("09:00");
      setRequestedOutTime("16:30");
    }
    setReason("FORGOT_SWIPE");
    setExplanation("");
    setIsModalOpen(true);
  }

  async function handleSubmitPunchRequest(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        date: modalDate,
        punchType,
        reason,
        explanation: explanation.trim() || null,
      };

      if (staffId) {
        payload.staffId = staffId;
      }

      if (punchType === "IN" || punchType === "OUT") {
        payload.requestedTime = requestedTime;
      } else {
        payload.requestedInTime = requestedInTime;
        payload.requestedOutTime = requestedOutTime;
      }

      const res = await fetch("/api/punch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit punch regularization request");
      }

      toast.success("Punch regularization request submitted successfully");
      setIsModalOpen(false);
      // Refresh current calendar view
      fetchMonthData(selectedYear, selectedMonth);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error submitting request";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Calculate leading empty cells for Monday start:
  // dayOfWeek: 0 = Sun, 1 = Mon, ..., 6 = Sat
  // Mon -> 0 empty cells, Tue -> 1, ..., Sun -> 6
  const firstDay = data.days[0];
  const leadingEmptyCount = firstDay ? (firstDay.dayOfWeek + 6) % 7 : 0;

  return (
    <div className="mx-auto max-w-[1480px] p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-acc-2/15 text-acc-2">
              <Calendar className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-text sm:text-2xl">
              ToSchool · School Attendance Calendar
            </h1>
          </div>
          <p className="mt-1 text-xs text-muted">
            {data.staff.name}
            {data.staff.employeeCode ? ` (${data.staff.employeeCode})` : ""} ·{" "}
            {data.staff.departmentName || "General Staff"} · Lakhnadon Campus
          </p>
        </div>

        {/* Month Selector Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card hover:bg-card-hi transition-colors disabled:opacity-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4 text-text" />
          </button>

          <div className="flex items-center rounded-lg border border-line bg-card px-3.5 py-1.5 shadow-sm">
            <CalendarDays className="mr-2 h-4 w-4 text-acc-2" />
            <span className="text-sm font-semibold tracking-tight text-text">
              {data.monthLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isLoading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-card hover:bg-card-hi transition-colors disabled:opacity-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4 text-text" />
          </button>

          <Link
            href={`/punch-requests?month=${selectedMonth}&year=${selectedYear}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-medium text-text hover:bg-card-hi transition-colors ml-1"
          >
            <FileText className="h-3.5 w-3.5 text-acc-2" />
            <span>Regularization Hub</span>
          </Link>
        </div>
      </div>

      {/* Discrepancy Banner */}
      {discrepancyCount > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
          <div className="flex items-center gap-2.5 text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              You have <strong>{discrepancyCount}</strong> attendance {discrepancyCount === 1 ? "discrepancy" : "discrepancies"} needing regularization for {data.monthLabel} (missed terminal check-in, check-out, or no attendance recorded).
            </span>
          </div>
          <Link
            href={`/punch-requests?month=${selectedMonth}&year=${selectedYear}`}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors"
          >
            <span>Review in Regularization Center</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Color Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card/60 p-3 text-xs text-muted">
        <span className="font-semibold text-text uppercase tracking-wider text-[11px] mr-1">
          Legend:
        </span>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-present" />
          <span>Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-late" />
          <span>Half Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-indigo-400" />
          <span>Branch Holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
          <span>Sunday Off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-absent" />
          <span>No Show / Missed Punch</span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Calendar Grid Container */}
        <div className="flex-1 overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-line bg-card-hi/60 text-center text-xs font-semibold text-muted">
            {WEEKDAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={`py-2.5 ${i === 6 ? "text-slate-400" : ""}`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-line/70">
            {/* Leading empty cells for days from previous month */}
            {Array.from({ length: leadingEmptyCount }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="min-h-[110px] bg-canvas/30 p-2 opacity-30 sm:min-h-[125px]"
              />
            ))}

            {/* Days in Month */}
            {data.days.map((day) => {
              const isSunday = day.isSunday;
              const isHoliday = day.isHoliday;
              const isNoShow = day.isNoShow;
              const isToday = day.isToday;
              const hasPending = day.hasPendingRequest;

              let cellBg = "bg-card hover:bg-card-hi/40";
              let borderAccent = "";

              if (isNoShow) {
                cellBg = "bg-rose-950/20";
                borderAccent = "ring-1 ring-rose-500/50 border-rose-500/50";
              } else if (isToday) {
                cellBg = "bg-acc-2/10 hover:bg-acc-2/15";
                borderAccent = "ring-1 ring-acc-2/60 border-acc-2/60";
              } else if (day.status === "PRESENT") {
                cellBg = "bg-card";
              } else if (day.status === "HALF_DAY") {
                cellBg = "bg-amber-950/10";
              } else if (isHoliday) {
                cellBg = "bg-indigo-950/15";
              } else if (isSunday) {
                cellBg = "bg-slate-900/30";
              }

              return (
                <div
                  key={day.dateKey}
                  className={`relative flex min-h-[110px] flex-col justify-between p-2.5 transition-colors sm:min-h-[125px] ${cellBg} ${borderAccent}`}
                >
                  {/* Top Row: Day Number + Duration Bracket Badge */}
                  <div className="flex items-start justify-between">
                    <span
                      className={`num text-sm font-bold tracking-tight ${
                        isSunday
                          ? "text-slate-400"
                          : isNoShow
                            ? "text-rose-400"
                            : isToday
                              ? "text-acc-1"
                              : "text-text"
                      }`}
                    >
                      {String(day.dayNumber).padStart(2, "0")}
                    </span>

                    {/* Duration Bracket or Today Badge */}
                    {day.hoursBracket !== "—" ? (
                      <span className="rounded border border-line bg-card-hi px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                        {day.hoursBracket}
                      </span>
                    ) : isToday ? (
                      <span className="rounded border border-acc-2/40 bg-acc-2/20 px-1.5 py-0.5 text-[10px] font-semibold text-acc-1">
                        Today
                      </span>
                    ) : null}
                  </div>

                  {/* Middle Row: Campus or Special Status */}
                  <div className="my-1.5 flex flex-col gap-1">
                    {isHoliday ? (
                      <div className="inline-block truncate rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-medium text-indigo-300">
                        {day.holidayName || "School Holiday"}
                      </div>
                    ) : isSunday ? (
                      <span className="text-[11px] font-medium text-slate-400">
                        Sunday Off
                      </span>
                    ) : !day.isEmployed ? (
                      <span className="text-[11px] font-medium text-muted">
                        Not Employed
                      </span>
                    ) : isToday ? (
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 rounded border border-acc-2/30 bg-acc-2/15 px-1.5 py-0.5 text-[10px] font-medium text-acc-1">
                          <Clock className="h-2.5 w-2.5" />
                          {day.checkIn ? "In Progress" : "Active Today"}
                        </span>
                      </div>
                    ) : isNoShow ? (
                      <div className="flex items-center gap-1">
                        <span className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          No Show
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-muted">
                        <Building className="h-3 w-3 flex-none text-subtle" />
                        <span className="truncate">Lakhnadon</span>
                      </div>
                    )}

                    {/* Pending Request Badge */}
                    {hasPending && (
                      <span className="inline-flex items-center gap-1 rounded border border-late/40 bg-late/15 px-1.5 py-0.5 text-[10px] font-medium text-late">
                        <Clock className="h-2.5 w-2.5" />
                        Request Pending
                      </span>
                    )}
                  </div>

                  {/* Bottom Row: In/Out Times or Regularize Link */}
                  <div className="mt-auto pt-1">
                    {isNoShow ? (
                      <button
                        type="button"
                        onClick={() => openRegularizationModal(day)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-acc-1 hover:text-acc-2 transition-colors"
                      >
                        <PlusCircle className="h-3 w-3" />
                        Request Punch
                      </button>
                    ) : isToday ? (
                      <div className="flex items-center justify-between gap-1">
                        {day.checkIn ? (
                          <div className="num text-[11px] text-muted">
                            <span>In: {day.checkIn}</span>
                            <span className="mx-1 text-line">·</span>
                            <span>Out: {day.checkOut ?? "—"}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openRegularizationModal(day)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-acc-1 hover:text-acc-2 transition-colors"
                          >
                            <PlusCircle className="h-3 w-3" />
                            Request Punch
                          </button>
                        )}
                      </div>
                    ) : day.status === "HALF_DAY" ? (
                      <div className="flex flex-col gap-1">
                        <div className="num text-[11px] text-muted">
                          {day.checkIn ? (
                            <span>In: {day.checkIn}</span>
                          ) : (
                            <span className="font-medium text-amber-400">In: Missing</span>
                          )}
                          <span className="mx-1 text-line">·</span>
                          {day.checkOut ? (
                            <span>Out: {day.checkOut}</span>
                          ) : (
                            <span className="font-medium text-amber-400">Out: Missing</span>
                          )}
                        </div>
                        {!hasPending && !day.isToday && (
                          <button
                            type="button"
                            onClick={() => openRegularizationModal(day)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-acc-1 hover:text-acc-2 transition-colors"
                          >
                            <PlusCircle className="h-2.5 w-2.5" />
                            {day.checkIn && !day.checkOut
                              ? "Request Out Punch"
                              : !day.checkIn && day.checkOut
                                ? "Request In Punch"
                                : "Request Punch"}
                          </button>
                        )}
                      </div>
                    ) : day.status === "PRESENT" ? (
                      <div className="num text-[11px] text-muted">
                        <span>In: {day.checkIn ?? "—"}</span>
                        <span className="mx-1 text-line">·</span>
                        <span>Out: {day.checkOut ?? "—"}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-subtle">—</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Compliance Index */}
        <AttendanceIndexSidebar
          compliance={data.compliance}
          summary={data.summary}
        />
      </div>

      {/* Missed Punch Regularization Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Request Punch Regularization"
      >
        <form onSubmit={handleSubmitPunchRequest} className="space-y-4">
          <p className="text-xs text-muted">
            Raise a missed punch regularization request for administrative review.
          </p>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Date
            </label>
            <input
              type="text"
              readOnly
              value={modalDate}
              className="w-full rounded-lg border border-line bg-card-hi px-3 py-2 text-xs text-text outline-none opacity-80"
            />
          </div>

          {/* Punch Type Selector */}
          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Punch Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPunchType("BOTH")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  punchType === "BOTH"
                    ? "border-acc-2 bg-acc-2/15 text-acc-1"
                    : "border-line bg-card hover:bg-card-hi text-muted"
                }`}
              >
                Both (Full Day)
              </button>
              <button
                type="button"
                onClick={() => setPunchType("IN")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  punchType === "IN"
                    ? "border-acc-2 bg-acc-2/15 text-acc-1"
                    : "border-line bg-card hover:bg-card-hi text-muted"
                }`}
              >
                Check-in (IN)
              </button>
              <button
                type="button"
                onClick={() => setPunchType("OUT")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                  punchType === "OUT"
                    ? "border-acc-2 bg-acc-2/15 text-acc-1"
                    : "border-line bg-card hover:bg-card-hi text-muted"
                }`}
              >
                Check-out (OUT)
              </button>
            </div>
          </div>

          {/* Times */}
          {punchType === "BOTH" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Expected In Time (HH:MM)
                </label>
                <input
                  type="time"
                  required
                  value={requestedInTime}
                  onChange={(e) => setRequestedInTime(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-text outline-none focus:border-acc-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text mb-1">
                  Expected Out Time (HH:MM)
                </label>
                <input
                  type="time"
                  required
                  value={requestedOutTime}
                  onChange={(e) => setRequestedOutTime(e.target.value)}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-text outline-none focus:border-acc-2"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-text mb-1">
                Requested Time (HH:MM)
              </label>
              <input
                type="time"
                required
                value={requestedTime}
                onChange={(e) => setRequestedTime(e.target.value)}
                className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-text outline-none focus:border-acc-2"
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Reason Category
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-text outline-none focus:border-acc-2"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Explanation */}
          <div>
            <label className="block text-xs font-medium text-text mb-1">
              Explanation (Optional)
            </label>
            <textarea
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Provide additional details regarding this missed punch..."
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-xs text-text outline-none focus:border-acc-2 placeholder:text-muted/60"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
