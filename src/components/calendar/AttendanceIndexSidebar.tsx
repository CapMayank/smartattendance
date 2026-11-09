"use client";

import { Award, CheckCircle2, Clock, CalendarCheck, AlertCircle } from "lucide-react";
import type { ComplianceIndex } from "@/lib/to-school";

function RadialRing({
  monthName,
  percentage,
  presentDays,
  elapsedWorkingDays,
}: {
  monthName: string;
  percentage: number;
  presentDays: number;
  elapsedWorkingDays: number;
}) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  const strokeColor =
    percentage >= 90
      ? "var(--color-present)"
      : percentage >= 75
        ? "var(--color-late)"
        : "var(--color-absent)";

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex items-center justify-center">
        <svg className="h-20 w-20 transform -rotate-90" viewBox="0 0 72 72">
          {/* Background circle */}
          <circle
            cx="36"
            cy="36"
            r={radius}
            className="stroke-line"
            strokeWidth="5"
            fill="transparent"
          />
          {/* Progress circle */}
          <circle
            cx="36"
            cy="36"
            r={radius}
            stroke={strokeColor}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="num text-sm font-semibold tracking-tight text-text">
            {percentage}%
          </span>
        </div>
      </div>
      <div className="mt-1 text-center">
        <div className="text-xs font-medium text-text">{monthName}</div>
        <div className="text-[11px] text-muted">
          {presentDays}/{elapsedWorkingDays}d
        </div>
      </div>
    </div>
  );
}

export function AttendanceIndexSidebar({
  compliance,
  summary,
}: {
  compliance: ComplianceIndex;
  summary: {
    elapsedWorkingDays: number;
    presentDays: number;
    halfDays: number;
    lateArrivalsCount: number;
    avgDailyMinutes: number;
    totalWorkMinutes: number;
  };
}) {
  const avgHours = Math.floor(summary.avgDailyMinutes / 60);
  const avgMins = summary.avgDailyMinutes % 60;
  const avgFormatted = `${avgHours}h ${avgMins}m`;

  const totalHours = Math.floor(summary.totalWorkMinutes / 60);
  const totalMins = summary.totalWorkMinutes % 60;
  const totalFormatted = `${totalHours}h ${totalMins}m`;

  const scoreColor =
    compliance.attendanceScore >= 90
      ? "text-present"
      : compliance.attendanceScore >= 75
        ? "text-late"
        : "text-absent";

  const progressBg =
    compliance.attendanceScore >= 90
      ? "bg-present"
      : compliance.attendanceScore >= 75
        ? "bg-late"
        : "bg-absent";

  return (
    <aside className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-5 lg:w-80 xl:w-96">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-acc-2" />
          <h2 className="text-sm font-semibold tracking-tight text-text">
            My School Attendance Index
          </h2>
        </div>
        <span className="rounded-full border border-line bg-card-hi px-2.5 py-0.5 text-xs font-medium text-muted">
          {compliance.financialYear}
        </span>
      </div>

      {/* Quarterly Compliance Hero Card */}
      <div className="rounded-xl border border-line/70 bg-gradient-to-b from-card-hi/60 to-card-hi/20 p-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-medium text-text">Quarterly Compliance</span>
          <span>{compliance.quarterMonths}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-xs text-muted font-medium">
            {compliance.quarterLabel}
          </span>
          <span className={`num text-3xl font-bold tracking-tight ${scoreColor}`}>
            {compliance.attendanceScore}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
          <div
            className={`h-full transition-all duration-700 ease-out ${progressBg}`}
            style={{ width: `${Math.min(100, Math.max(0, compliance.attendanceScore))}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <span>{compliance.elapsedWorkingDays} working days elapsed</span>
          <span>Target: 90%</span>
        </div>
      </div>

      {/* Monthly Achievement Rate (Circular Rings) */}
      <div className="rounded-xl border border-line/70 bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            Past 3 Months Achievement
          </span>
          <span className="text-[11px] text-muted">School Sessions</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {compliance.monthlyAchievements.map((m) => (
            <RadialRing
              key={`${m.year}-${m.month}`}
              monthName={m.monthName}
              percentage={m.percentage}
              presentDays={m.presentDays}
              elapsedWorkingDays={m.elapsedWorkingDays}
            />
          ))}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-card-hi/70 p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-present" />
            <span>Present Days</span>
          </div>
          <div className="mt-1 num text-xl font-bold text-text">
            {summary.presentDays}
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {" "}
              / {summary.elapsedWorkingDays}d
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card-hi/70 p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Clock className="h-3.5 w-3.5 text-late" />
            <span>Late Arrivals</span>
          </div>
          <div className="mt-1 num text-xl font-bold text-text">
            {summary.lateArrivalsCount}
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400"> days</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card-hi/70 p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <CalendarCheck className="h-3.5 w-3.5 text-acc-1" />
            <span>Half Days</span>
          </div>
          <div className="mt-1 num text-xl font-bold text-text">
            {summary.halfDays}
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400"> days</span>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-card-hi/70 p-3 shadow-2xs">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Clock className="h-3.5 w-3.5 text-muted" />
            <span>Avg Daily Hours</span>
          </div>
          <div className="mt-1 num text-lg font-bold text-text">
            {avgFormatted}
          </div>
        </div>
      </div>

      {/* Total Monthly Work Hours Banner */}
      <div className="flex items-center justify-between rounded-xl border border-line bg-card-hi/30 px-3.5 py-2.5 text-xs">
        <span className="text-muted">Total Work Recorded</span>
        <span className="num font-semibold text-text">{totalFormatted}</span>
      </div>

      {/* Policy Advisory Note */}
      <div className="rounded-xl border border-line bg-card-hi/20 p-3.5 text-xs text-muted">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-late" />
          <div className="space-y-1">
            <p className="font-medium text-text">Missed Punch Reconciliation</p>
            <p className="text-[11px] leading-relaxed text-muted">
              Missed punches must be regularized within <strong>3 working days</strong>. Regularizations are routed to your department head or school admin for verification.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
