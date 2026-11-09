"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Clock,
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  RefreshCw,
  LogIn,
  LogOut,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Ban,
  FileText,
  RotateCcw,
  ArrowRight,
  Check,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestPunchModal, type PunchType } from "@/components/punches/RequestPunchModal";
import { formatDate, formatHHmm } from "@/lib/format";
import type { ToSchoolData, ToSchoolDay } from "@/lib/to-school";

export interface PunchItem {
  id: string;
  timestamp: string;
  type: "IN" | "OUT";
  dateKey: string;
  timeStr: string;
}

export interface PunchRequestItem {
  id: string;
  staffId: string;
  date: string;
  punchType: "IN" | "OUT" | "BOTH";
  requestedTime?: string | null;
  requestedInTime?: string | null;
  requestedOutTime?: string | null;
  reason: string;
  explanation?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  decisionRemarks?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

interface PunchRequestsClientProps {
  userRole: string;
  staffId?: string | null;
  initialMonth?: number;
  initialYear?: number;
}

const REASON_MAP: Record<string, string> = {
  FORGOT_SWIPE: "Forgot to mark attendance / Missed terminal check",
  DUTY_OUTSIDE: "Official on-duty assignment / Off-campus school duty",
  DEVICE_OFFLINE: "Attendance terminal offline / Recognition error",
  POWER_FAILURE: "Campus power outage / Terminal unavailable",
  OTHER: "Other reason (specify details below)",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function PunchRequestsClient({
  userRole,
  staffId,
  initialMonth,
  initialYear,
}: PunchRequestsClientProps) {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(
    initialYear && Number.isFinite(initialYear) ? initialYear : currentDate.getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    initialMonth && Number.isFinite(initialMonth) ? initialMonth : currentDate.getMonth() + 1
  );

  const [activeTab, setActiveTab] = useState<string>("action-needed");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<{
    date?: string;
    punchType?: PunchType;
    time?: string;
  }>({});

  // ToSchool Daily Attendance State
  const [toSchoolData, setToSchoolData] = useState<ToSchoolData | null>(null);
  const [isLoadingToSchool, setIsLoadingToSchool] = useState(true);

  // Punch history state
  const [punches, setPunches] = useState<PunchItem[]>([]);
  const [isLoadingPunches, setIsLoadingPunches] = useState(true);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Regularization requests state
  const [requests, setRequests] = useState<PunchRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchToSchoolData = useCallback(async (year: number, month: number) => {
    setIsLoadingToSchool(true);
    try {
      const q = new URLSearchParams({
        year: String(year),
        month: String(month),
      });
      if (staffId) q.set("staffId", staffId);

      const res = await fetch(`/api/employee/to-school?${q.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load monthly attendance data");
      }
      const json = await res.json();
      if (json.success && json.data) {
        setToSchoolData(json.data);
      }
    } catch (err: unknown) {
      console.error("Error loading to-school data:", err);
      // Non-blocking toast: fallback gracefully
    } finally {
      setIsLoadingToSchool(false);
    }
  }, [staffId]);

  const fetchPunches = useCallback(async () => {
    setIsLoadingPunches(true);
    try {
      const params = new URLSearchParams();
      if (staffId) params.set("staffId", staffId);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const url = `/api/employee/punches${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch punches");
      }

      setPunches(data.punches || []);
    } catch (err: unknown) {
      console.error("Error fetching punches:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load biometric punches");
    } finally {
      setIsLoadingPunches(false);
    }
  }, [staffId, fromDate, toDate]);

  const fetchRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const params = new URLSearchParams();
      if (staffId) params.set("staffId", staffId);

      const url = `/api/punch-requests${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch punch requests");
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error("Error fetching punch requests:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load regularization requests");
    } finally {
      setIsLoadingRequests(false);
    }
  }, [staffId]);

  useEffect(() => {
    fetchToSchoolData(selectedYear, selectedMonth);
  }, [fetchToSchoolData, selectedYear, selectedMonth]);

  useEffect(() => {
    fetchPunches();
  }, [fetchPunches]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function handlePrevMonth() {
    let nextY = selectedYear;
    let nextM = selectedMonth - 1;
    if (nextM < 1) {
      nextM = 12;
      nextY -= 1;
    }
    setSelectedYear(nextY);
    setSelectedMonth(nextM);
  }

  function handleNextMonth() {
    let nextY = selectedYear;
    let nextM = selectedMonth + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    setSelectedYear(nextY);
    setSelectedMonth(nextM);
  }

  function openModal(date?: string, punchType?: PunchType, time?: string) {
    setModalPrefill({ date, punchType, time });
    setIsModalOpen(true);
  }

  async function handleCancelRequest(requestId: string) {
    if (!confirm("Are you sure you want to cancel this punch regularization request?")) {
      return;
    }

    setCancellingId(requestId);
    try {
      const res = await fetch(`/api/punch-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel request");
      }

      toast.success("Request cancelled successfully.");
      await fetchRequests();
      await fetchToSchoolData(selectedYear, selectedMonth);
    } catch (err: unknown) {
      console.error("Error cancelling request:", err);
      toast.error(err instanceof Error ? err.message : "Failed to cancel request");
    } finally {
      setCancellingId(null);
    }
  }

  // Compute Discrepancies needing action from toSchoolData
  const daysList = toSchoolData?.days || [];
  const discrepancies = daysList.filter(
    (d) =>
      d.isEmployed &&
      !d.isSunday &&
      !d.isHoliday &&
      !d.isToday &&
      ((d.checkIn && !d.checkOut) || (!d.checkIn && d.checkOut) || d.isNoShow || d.hasPendingRequest)
  );

  const pendingDiscrepancies = discrepancies.filter((d) => d.hasPendingRequest);
  const actionNeededDiscrepancies = discrepancies.filter((d) => !d.hasPendingRequest);

  const monthLabel = toSchoolData?.monthLabel || `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

  const tabs: TabItem[] = [
    { id: "action-needed", label: "Action Needed", count: actionNeededDiscrepancies.length },
    { id: "daily", label: "Daily Punch Breakdown", count: daysList.length },
    { id: "requests", label: "My Regularization Requests", count: requests.length },
    { id: "raw-logs", label: "Raw Device Logs", count: punches.length },
  ];

  function renderStatusBadge(status: PunchRequestItem["status"]) {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-late/30 bg-late/10 px-2.5 py-0.5 text-xs font-medium text-late">
            <Clock size={12} aria-hidden="true" />
            Pending
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-present/30 bg-present/10 px-2.5 py-0.5 text-xs font-medium text-present">
            <CheckCircle2 size={12} aria-hidden="true" />
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-absent/30 bg-absent/10 px-2.5 py-0.5 text-xs font-medium text-absent">
            <XCircle size={12} aria-hidden="true" />
            Rejected
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card-hi px-2.5 py-0.5 text-xs font-medium text-muted">
            <Ban size={12} aria-hidden="true" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Page Header with Integrated Navigation & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-text sm:text-[30px]">
            My Punches &amp; Requests
          </h1>
          <p className="mt-0.5 text-[13px] text-subtle">
            Reconcile daily terminal attendance, resolve missing punches, and track regularization requests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center rounded-xl border border-line bg-card p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-card-hi text-text transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 px-3 text-xs font-semibold text-text">
              <CalendarDays size={14} className="text-acc-2" />
              <span>{monthLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-card-hi text-text transition-colors"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Bridge link to ToSchool Calendar */}
          <Link
            href={`/to-school?month=${selectedMonth}&year=${selectedYear}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 text-xs font-medium text-text hover:bg-card-hi transition-colors"
          >
            <CalendarIcon size={14} className="text-acc-2" />
            <span>Monthly Calendar Grid</span>
            <ArrowRight size={14} className="text-subtle" />
          </Link>

          {/* New Request Modal Trigger */}
          <Button
            variant="primary"
            icon={PlusCircle}
            onClick={() => openModal()}
          >
            Request Missed Punch
          </Button>
        </div>
      </div>

      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />

      {/* TAB 1: ACTION NEEDED (DISCREPANCIES DASHBOARD) */}
      {activeTab === "action-needed" && (
        <div className="space-y-4">
          {actionNeededDiscrepancies.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold text-amber-950 dark:text-amber-100">
                  {actionNeededDiscrepancies.length} attendance{" "}
                  {actionNeededDiscrepancies.length === 1 ? "discrepancy" : "discrepancies"} detected for {monthLabel}
                </p>
                <p className="mt-0.5 text-amber-900/90 dark:text-amber-200/90 text-[12px]">
                  Missing check-ins or check-outs impact your recorded duration and penalize attendance as a Half Day or Absent. Submit a regularization request below to fix them.
                </p>
              </div>
            </div>
          )}

          {isLoadingToSchool ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-line bg-card">
              <RefreshCw className="size-6 animate-spin text-subtle" />
            </div>
          ) : actionNeededDiscrepancies.length === 0 && pendingDiscrepancies.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                icon={CheckCircle2}
                title="All punches reconciled!"
                hint={`Zero missing punches or attendance discrepancies detected for ${monthLabel}. Your attendance records are fully up to date.`}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {actionNeededDiscrepancies.map((d) => {
                const isMissingOut = d.checkIn && !d.checkOut;
                const isMissingIn = !d.checkIn && d.checkOut;
                const isNoShow = d.isNoShow;

                const dateObj = new Date(`${d.dateKey}T12:00:00Z`);
                const weekday = dateObj.toLocaleDateString("en-US", {
                  weekday: "short",
                });
                const formattedDate = `${weekday}, ${formatDate(d.dateKey)}`;

                return (
                  <div
                    key={d.dateKey}
                    className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-card p-4 sm:flex-row sm:items-center hover:border-subtle transition-colors shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm text-text">
                          {formattedDate}
                        </span>
                        {isMissingOut ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                            <LogOut size={12} />
                            Missing Check-Out
                          </span>
                        ) : isMissingIn ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                            <LogIn size={12} />
                            Missing Check-In
                          </span>
                        ) : isNoShow ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300">
                            <AlertCircle size={12} />
                            No Attendance Recorded
                          </span>
                        ) : null}

                        <span className="text-[11px] text-muted">
                          Impact:{" "}
                          <strong className={isNoShow ? "text-rose-600 dark:text-rose-400" : "text-amber-700 dark:text-amber-400"}>
                            {d.status === "HALF_DAY" ? "Recorded as Half Day" : "Recorded as Absent"}
                          </strong>
                        </span>
                      </div>

                      <p className="text-xs text-subtle">
                        {isMissingOut
                          ? `Recorded Check-In at ${formatHHmm(d.checkIn || "")}. No campus exit registered at facial recognition / attendance terminal.`
                          : isMissingIn
                          ? `Recorded Check-Out at ${formatHHmm(d.checkOut || "")}. No morning arrival registered at attendance terminal.`
                          : "No terminal punches registered on this scheduled working day."}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {isMissingOut ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={PlusCircle}
                          onClick={() => openModal(d.dateKey, "OUT", "16:30")}
                        >
                          Regularize Out Punch
                        </Button>
                      ) : isMissingIn ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={PlusCircle}
                          onClick={() => openModal(d.dateKey, "IN", "09:00")}
                        >
                          Regularize In Punch
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={PlusCircle}
                          onClick={() => openModal(d.dateKey, "BOTH")}
                        >
                          Regularize Full Day
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Pending Discrepancies Section */}
              {pendingDiscrepancies.length > 0 && (
                <div className="mt-4 pt-4 border-t border-line space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Pending Verification ({pendingDiscrepancies.length})
                  </h3>
                  {pendingDiscrepancies.map((d) => (
                    <div
                      key={`pending-${d.dateKey}`}
                      className="flex items-center justify-between rounded-xl border border-line bg-card/60 p-3 text-xs text-muted"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text">{formatDate(d.dateKey)}</span>
                        <span>· In: {d.checkIn ? formatHHmm(d.checkIn) : "Missing"} · Out: {d.checkOut ? formatHHmm(d.checkOut) : "Missing"}</span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-late/30 bg-late/10 px-2 py-0.5 text-[11px] font-medium text-late">
                        <Clock size={11} />
                        Request Pending Approval
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAILY PUNCH BREAKDOWN LEDGER */}
      {activeTab === "daily" && (
        <Card className="space-y-4">
          <CardHeader
            title={`Daily Attendance & Punch Ledger · ${monthLabel}`}
            caption="Complete daily breakdown showing recorded terminal times, shift duration, and regularization status."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                onClick={() => fetchToSchoolData(selectedYear, selectedMonth)}
                loading={isLoadingToSchool}
              >
                Refresh
              </Button>
            }
          />

          {isLoadingToSchool ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="size-6 animate-spin text-subtle" />
            </div>
          ) : daysList.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              title="No records found"
              hint={`No attendance calendar records found for ${monthLabel}.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[12px] font-medium text-subtle">
                    <th className="py-2.5 pr-4">Date</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Terminal Check-In</th>
                    <th className="py-2.5 pr-4">Terminal Check-Out</th>
                    <th className="py-2.5 pr-4">Effective Hours</th>
                    <th className="py-2.5 text-right">Reconciliation Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft font-normal text-xs">
                  {daysList.map((day) => {
                    const isMissingOut = day.status === "HALF_DAY" && day.checkIn && !day.checkOut;
                    const isMissingIn = day.status === "HALF_DAY" && !day.checkIn && day.checkOut;
                    const isNoShow = day.isNoShow;
                    const isSunday = day.isSunday;
                    const isHoliday = day.isHoliday;

                    let statusBadge = (
                      <span className="inline-flex rounded-md border border-line bg-card-hi px-2 py-0.5 text-[11px] text-muted">
                        {day.status}
                      </span>
                    );

                    if (day.status === "PRESENT") {
                      statusBadge = (
                        <span className="inline-flex rounded-md border border-present/30 bg-present/10 px-2 py-0.5 text-[11px] font-medium text-present">
                          Present
                        </span>
                      );
                    } else if (day.status === "HALF_DAY") {
                      statusBadge = (
                        <span className="inline-flex rounded-md border border-late/30 bg-late/10 px-2 py-0.5 text-[11px] font-medium text-late">
                          Half Day
                        </span>
                      );
                    } else if (isNoShow || day.status === "ABSENT") {
                      statusBadge = (
                        <span className="inline-flex rounded-md border border-absent/30 bg-absent/10 px-2 py-0.5 text-[11px] font-medium text-absent">
                          {isNoShow ? "No Show" : "Absent"}
                        </span>
                      );
                    } else if (isHoliday) {
                      statusBadge = (
                        <span className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                          {day.holidayName || "Holiday"}
                        </span>
                      );
                    } else if (isSunday) {
                      statusBadge = (
                        <span className="inline-flex rounded-md border border-line bg-card-hi px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                          Sunday Off
                        </span>
                      );
                    }

                    return (
                      <tr key={day.dateKey} className="transition-colors hover:bg-card-hi/40">
                        <td className="py-2.5 pr-4 font-medium text-text">
                          {formatDate(day.dateKey)}
                        </td>
                        <td className="py-2.5 pr-4">{statusBadge}</td>
                        <td className="num py-2.5 pr-4">
                          {day.checkIn ? (
                            <span className="font-medium text-text">{formatHHmm(day.checkIn)}</span>
                          ) : isMissingIn ? (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">Missing</span>
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </td>
                        <td className="num py-2.5 pr-4">
                          {day.checkOut ? (
                            <span className="font-medium text-text">{formatHHmm(day.checkOut)}</span>
                          ) : isMissingOut ? (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">Missing</span>
                          ) : (
                            <span className="text-subtle">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-muted">
                          {day.hoursBracket !== "—" ? day.hoursBracket : `${Math.floor(day.workMinutes / 60)}h ${day.workMinutes % 60}m`}
                        </td>
                        <td className="py-2.5 text-right">
                          {day.hasPendingRequest ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-late">
                              <Clock size={11} />
                              Pending
                            </span>
                          ) : isMissingOut ? (
                            <button
                              type="button"
                              onClick={() => openModal(day.dateKey, "OUT", "16:30")}
                              className="inline-flex items-center gap-1 font-semibold text-acc-1 hover:text-acc-2"
                            >
                              <PlusCircle size={12} />
                              Regularize Out
                            </button>
                          ) : isMissingIn ? (
                            <button
                              type="button"
                              onClick={() => openModal(day.dateKey, "IN", "09:00")}
                              className="inline-flex items-center gap-1 font-semibold text-acc-1 hover:text-acc-2"
                            >
                              <PlusCircle size={12} />
                              Regularize In
                            </button>
                          ) : isNoShow && !day.isToday ? (
                            <button
                              type="button"
                              onClick={() => openModal(day.dateKey, "BOTH")}
                              className="inline-flex items-center gap-1 font-semibold text-acc-1 hover:text-acc-2"
                            >
                              <PlusCircle size={12} />
                              Regularize Day
                            </button>
                          ) : day.status === "PRESENT" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-present">
                              <Check size={12} />
                              Reconciled
                            </span>
                          ) : (
                            <span className="text-muted/40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: MY REGULARIZATION REQUESTS */}
      {activeTab === "requests" && (
        <Card className="space-y-4">
          <CardHeader
            title="My Regularization Requests"
            caption="Submitted missed punch requests with live administrative review status and decision notes."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                onClick={fetchRequests}
                loading={isLoadingRequests}
              >
                Refresh
              </Button>
            }
          />

          {isLoadingRequests ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="size-6 animate-spin text-subtle" />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No regularization requests"
              hint="You have not submitted any missed punch regularization requests. Click '+ Request Missed Punch' above to submit one."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[12px] font-medium text-subtle">
                    <th className="py-2.5 pr-4">Date</th>
                    <th className="py-2.5 pr-4">Type</th>
                    <th className="py-2.5 pr-4">Requested Time(s)</th>
                    <th className="py-2.5 pr-4">Reason &amp; Explanation</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Approver Remarks</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft font-normal">
                  {requests.map((req) => {
                    const isPending = req.status === "PENDING";
                    const isBoth = req.punchType === "BOTH";
                    const isIn = req.punchType === "IN";

                    const requestedTimesDisplay = isBoth
                      ? `In: ${formatHHmm(req.requestedInTime || "")} · Out: ${formatHHmm(req.requestedOutTime || "")}`
                      : isIn
                      ? `In: ${formatHHmm(req.requestedTime || req.requestedInTime || "")}`
                      : `Out: ${formatHHmm(req.requestedTime || req.requestedOutTime || "")}`;

                    return (
                      <tr key={req.id} className="transition-colors hover:bg-card-hi/40">
                        <td className="py-3 pr-4 font-medium text-text">
                          {formatDate(new Date(`${req.date}T12:00:00Z`))}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-md border border-line bg-card-hi px-2 py-0.5 text-xs text-text">
                            {isBoth ? "Both In & Out" : isIn ? "Check-In" : "Check-Out"}
                          </span>
                        </td>
                        <td className="num py-3 pr-4 text-xs font-medium text-text">
                          {requestedTimesDisplay}
                        </td>
                        <td className="max-w-xs py-3 pr-4">
                          <div className="text-xs font-medium text-text">
                            {REASON_MAP[req.reason] || req.reason}
                          </div>
                          {req.explanation && (
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-subtle">
                              {req.explanation}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {renderStatusBadge(req.status)}
                        </td>
                        <td className="max-w-xs py-3 pr-4 text-xs text-subtle">
                          {req.decisionRemarks ? (
                            <span className="italic text-text/80">{req.decisionRemarks}</span>
                          ) : (
                            <span className="text-muted/60">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {isPending ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleCancelRequest(req.id)}
                              loading={cancellingId === req.id}
                            >
                              Cancel
                            </Button>
                          ) : (
                            <span className="text-xs text-muted/50">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 4: RAW DEVICE PUNCH LOGS */}
      {activeTab === "raw-logs" && (
        <Card className="space-y-4">
          <CardHeader
            title="Raw Terminal Event Logs"
            caption="Sorted by newest timestamp. Raw records captured from school facial recognition & attendance devices."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                onClick={fetchPunches}
                loading={isLoadingPunches}
              >
                Refresh
              </Button>
            }
          />

          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft bg-canvas p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-subtle">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-line bg-card px-2.5 py-1 text-xs text-text focus:border-acc-1 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-subtle">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-line bg-card px-2.5 py-1 text-xs text-text focus:border-acc-1 focus:outline-none"
              />
            </div>
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
              >
                Reset
              </Button>
            )}
            <span className="num ml-auto text-subtle">
              Showing {punches.length} records
            </span>
          </div>

          {isLoadingPunches ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="size-6 animate-spin text-subtle" />
            </div>
          ) : punches.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No raw biometric logs found"
              hint="No attendance terminal events recorded for the selected date range."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[12px] font-medium text-subtle">
                    <th className="py-2.5 pr-4">Timestamp (IST)</th>
                    <th className="py-2.5 pr-4">Date</th>
                    <th className="py-2.5 pr-4">Time</th>
                    <th className="py-2.5">Terminal Event</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft font-normal">
                  {punches.map((p) => {
                    const isIn = p.type === "IN";
                    return (
                      <tr key={p.id} className="transition-colors hover:bg-card-hi/40">
                        <td className="num py-2.5 pr-4 text-xs font-medium text-text">
                          {formatDate(new Date(p.timestamp))}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted">
                          {formatDate(p.dateKey)}
                        </td>
                        <td className="num py-2.5 pr-4 text-xs font-semibold text-text">
                          {p.timeStr}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                              isIn
                                ? "border-acc-1/30 bg-acc-1/10 text-acc-1"
                                : "border-acc-2/30 bg-acc-2/10 text-acc-2"
                            }`}
                          >
                            {isIn ? (
                              <LogIn size={12} aria-hidden="true" />
                            ) : (
                              <LogOut size={12} aria-hidden="true" />
                            )}
                            {isIn ? "Check-In" : "Check-Out"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Missed Punch Request Modal with prefill support */}
      <RequestPunchModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchRequests();
          fetchPunches();
          fetchToSchoolData(selectedYear, selectedMonth);
        }}
        prefillDate={modalPrefill.date}
        prefillPunchType={modalPrefill.punchType}
        prefillTime={modalPrefill.time}
      />
    </div>
  );
}
