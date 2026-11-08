"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  IndianRupee,
  KeyRound,
  XCircle,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  KpiTile,
  Modal,
  PageHeader,
  SectionLabel,
} from "@/components/ui";
import type { EmployeePortalData } from "@/lib/employee-portal";
import { formatHHmm, formatTime } from "@/lib/format";
import { amountInWords } from "@/lib/amount-in-words";
import { staffPhotoUrl } from "@/lib/photo-url";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function EmployeeMyDashboard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: EmployeePortalData;
}) {
  const { profile, today, monthSummary, monthRecords, payslips } = data;
  const [selectedSlip, setSelectedSlip] = useState<EmployeePortalData["payslips"][number] | null>(null);

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Link
            href="/change-password"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-card-hi px-3.5 text-[13px] font-medium text-text transition-colors hover:border-subtle"
          >
            <KeyRound size={15} aria-hidden="true" />
            Change Password
          </Link>
        }
      />

      {/* My Identity + Today Status */}
      <section className="grid grid-cols-1 gap-3.5 min-[1024px]:grid-cols-12">
        <Card className="min-[1024px]:col-span-7">
          <CardHeader title="My Profile & Shift" caption="Your school identity and assigned schedule" />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <Avatar name={profile.name} src={staffPhotoUrl({ id: profile.id, profilePhotoId: profile.profilePhotoId })} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-text">{profile.name}</h2>
                  {profile.employeeCode && (
                    <span className="num rounded-md border border-acc-2/40 bg-acc-2/10 px-2 py-0.5 text-xs font-medium text-acc-1">
                      {profile.employeeCode}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[13px] text-muted">
                  {profile.designationName || "Staff Member"} · {profile.departmentName || "General Department"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg border border-line-soft bg-canvas px-2.5 py-1.5 text-muted">
                Machine ID <b className="num text-text">#{profile.machineId}</b>
              </span>
              <span className="rounded-lg border border-line-soft bg-canvas px-2.5 py-1.5 text-muted">
                Pay Group <b className="text-text">{profile.payGroup === "CASH" ? "Cash" : "Bank / EPF"}</b>
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-line-soft pt-4 sm:grid-cols-3">
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <span className="text-xs text-subtle">Assigned Shift</span>
              <p className="mt-1 text-[13.5px] font-medium text-text">
                {profile.shift ? (
                  <>
                    {profile.shift.name}{" "}
                    <span className="num text-muted">
                      ({formatHHmm(profile.shift.startTime)}–{formatHHmm(profile.shift.endTime)})
                    </span>
                  </>
                ) : (
                  "General Schedule"
                )}
              </p>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <span className="text-xs text-subtle">Date of Joining</span>
              <p className="num mt-1 text-[13.5px] font-medium text-text">{profile.joiningDate || "—"}</p>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <span className="text-xs text-subtle">Registered Email</span>
              <p className="mt-1 truncate text-[13.5px] font-medium text-text">{profile.email || "Use Employee ID"}</p>
            </div>
          </div>
        </Card>

        <Card className="min-[1024px]:col-span-5">
          <CardHeader
            title="My Attendance Today"
            caption={`Date: ${today.dateKey}`}
            action={
              <span
                className={
                  today.status === "PRESENT"
                    ? "tint-badge tone-present rounded-full px-2.5 py-0.5 text-xs font-medium"
                    : today.status === "HALF_DAY"
                      ? "tint-badge tone-late rounded-full px-2.5 py-0.5 text-xs font-medium"
                      : today.status === "ABSENT"
                        ? "tint-badge tone-absent rounded-full px-2.5 py-0.5 text-xs font-medium"
                        : "rounded-full border border-line bg-card-hi px-2.5 py-0.5 text-xs text-muted"
                }
              >
                {today.status === "PRESENT"
                  ? "Present Today"
                  : today.status === "HALF_DAY"
                    ? "Half Day"
                    : today.status === "ABSENT"
                      ? "Absent"
                      : "No Punch Yet"}
              </span>
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <span className="text-xs text-subtle">First Check-In</span>
              <p className="num mt-1 text-[15px] font-semibold text-present">
                {today.checkIn ? formatTime(new Date(today.checkIn)) : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <span className="text-xs text-subtle">Last Check-Out</span>
              <p className="num mt-1 text-[15px] font-semibold text-text">
                {today.checkOut ? formatTime(new Date(today.checkOut)) : "—"}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-line-soft bg-canvas p-3">
            <div className="flex items-center justify-between text-xs text-subtle">
              <span>Today&apos;s Biometric Punches ({today.punches.length})</span>
              {today.lateMinutes > 0 && <span className="num text-late">Late by {today.lateMinutes}m</span>}
            </div>
            {today.punches.length === 0 ? (
              <p className="mt-1.5 text-[13px] text-muted">No biometric punches recorded yet for today.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {today.punches.map((p) => (
                  <span
                    key={p.id}
                    className="num inline-flex items-center gap-1.5 rounded-md border border-line bg-card-hi px-2 py-1 text-xs text-text"
                  >
                    <Clock size={12} className="text-acc-2" aria-hidden="true" />
                    {formatTime(new Date(p.timestamp))}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      <SectionLabel>My Month · {monthSummary.monthLabel}</SectionLabel>

      <section
        aria-label="My monthly attendance summary"
        className="grid grid-cols-1 gap-3.5 min-[600px]:grid-cols-2 min-[1100px]:grid-cols-4"
      >
        <KpiTile
          tone="present"
          icon={CheckCircle2}
          label="My present days"
          value={monthSummary.presentDays}
          foot={`${formatMinutes(monthSummary.totalWorkMinutes)} logged this month`}
        />
        <KpiTile
          tone="late"
          icon={AlarmClock}
          label="My late arrivals"
          value={monthSummary.lateDays}
          foot={monthSummary.lateDays === 0 ? "On time all month" : "Days with late check-in"}
        />
        <KpiTile
          tone="accent"
          icon={Calendar}
          label="My half days"
          value={monthSummary.halfDays}
          foot="Counted as 0.5 day in payroll"
        />
        <KpiTile
          tone="absent"
          icon={XCircle}
          label="My absent days"
          value={monthSummary.absentDays}
          foot="Marked absent this month"
        />
      </section>

      <section className="grid grid-cols-1 gap-3.5 min-[1150px]:grid-cols-12">
        <Card className="overflow-hidden !p-0 min-[1150px]:col-span-7">
          <div className="p-4 pb-2">
            <CardHeader title="My Daily Attendance Log" caption={monthSummary.monthLabel} />
          </div>
          {monthRecords.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Calendar}
                title="No attendance records for this month yet"
                hint="Your daily check-in and check-out logs will appear here."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {monthRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="num font-medium text-text">{r.dateKey}</td>
                      <td>
                        <span
                          className={
                            r.status === "PRESENT"
                              ? "tint-badge tone-present inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                              : r.status === "HALF_DAY"
                                ? "tint-badge tone-late inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                                : "tint-badge tone-absent inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                          }
                        >
                          {r.status === "HALF_DAY" ? "Half Day" : r.status}
                        </span>
                      </td>
                      <td className="num text-muted">
                        {r.checkIn ? formatTime(new Date(r.checkIn)) : "—"}
                        {r.lateMinutes > 0 && <span className="ml-1.5 text-xs text-late">(+{r.lateMinutes}m)</span>}
                      </td>
                      <td className="num text-muted">{r.checkOut ? formatTime(new Date(r.checkOut)) : "—"}</td>
                      <td className="num text-muted">{formatMinutes(r.workMinutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden !p-0 min-[1150px]:col-span-5">
          <div className="p-4 pb-2">
            <CardHeader
              title="My Payslips"
              caption="Monthly salary statements"
              action={
                <Link
                  href="/payslips"
                  className="text-xs font-semibold text-acc-2 hover:underline"
                >
                  View all payslips →
                </Link>
              }
            />
          </div>
          {payslips.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={IndianRupee}
                title="No payslips generated yet"
                hint="Once monthly payroll is processed, your salary slips will appear here."
              />
            </div>
          ) : (
            <div className="divide-y divide-line-soft">
              {payslips.map((slip) => (
                <div key={slip.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-text">
                        {SHORT_MONTHS[(slip.month || 1) - 1]} {slip.year}
                      </span>
                      <span className="rounded border border-line-soft bg-canvas px-1.5 py-0.5 text-[11px] text-subtle">
                        {slip.payGroup === "CASH" ? "Cash" : "Bank / EPF"}
                      </span>
                    </div>
                    <p className="num mt-0.5 text-xs text-subtle">
                      Paid days: {slip.presentDays} / {slip.totalDays}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-1">
                      <span className="num block font-semibold text-present">{formatInr(slip.netPayment)}</span>
                      <span className="text-[11px] text-subtle">Net Pay</span>
                    </div>
                    <Button variant="secondary" size="sm" icon={FileText} onClick={() => setSelectedSlip(slip)}>
                      Slip
                    </Button>
                    <a
                      href={`/api/payroll/${slip.id}/pdf`}
                      download
                      className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-line bg-card-hi px-2.5 text-xs font-medium text-text transition-colors hover:border-subtle"
                    >
                      <Download size={13} aria-hidden="true" />
                      PDF
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <Modal
        open={selectedSlip !== null}
        onClose={() => setSelectedSlip(null)}
        title={
          selectedSlip
            ? `Salary Slip · ${SHORT_MONTHS[(selectedSlip.month || 1) - 1]} ${selectedSlip.year}`
            : "Salary Slip"
        }
        footer={
          <>
            {selectedSlip && (
              <a
                href={`/api/payroll/${selectedSlip.id}/pdf`}
                download
                className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-text px-3.5 text-[13px] font-medium text-ground transition-colors hover:bg-text/90"
              >
                <Download size={15} aria-hidden="true" />
                Download PDF
              </a>
            )}
            <Button variant="secondary" onClick={() => setSelectedSlip(null)}>
              Close
            </Button>
          </>
        }
      >
        {selectedSlip && (
          <div className="space-y-4 text-[13.5px]">
            <div className="rounded-xl border border-line bg-canvas p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-text">{profile.name}</div>
                  <div className="text-xs text-subtle">
                    {profile.designationName || "Staff"} · {profile.departmentName || "General"}
                  </div>
                </div>
                {profile.employeeCode && (
                  <span className="num rounded border border-line bg-card-hi px-2 py-0.5 text-xs text-acc-1">
                    {profile.employeeCode}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl border border-line-soft bg-canvas p-2.5">
                <span className="text-xs text-subtle">Total Days</span>
                <b className="num mt-0.5 block text-text">{selectedSlip.totalDays}</b>
              </div>
              <div className="rounded-xl border border-line-soft bg-canvas p-2.5">
                <span className="text-xs text-subtle">Present Days</span>
                <b className="num mt-0.5 block text-present">{selectedSlip.presentDays}</b>
              </div>
              <div className="rounded-xl border border-line-soft bg-canvas p-2.5">
                <span className="text-xs text-subtle">LOP / NCP Days</span>
                <b className="num mt-0.5 block text-absent">{selectedSlip.ncpDays}</b>
              </div>
            </div>

            <div className="divide-y divide-line-soft rounded-xl border border-line-soft">
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-muted">Gross Wage Earned</span>
                <span className="num font-medium text-text">{formatInr(selectedSlip.grossWage)}</span>
              </div>
              <div className="flex justify-between px-3.5 py-2.5">
                <span className="text-muted">Basic Wage</span>
                <span className="num text-muted">{formatInr(selectedSlip.basicWage)}</span>
              </div>
              {selectedSlip.bonusAmount > 0 && (
                <div className="flex justify-between px-3.5 py-2.5">
                  <span className="text-muted">Bonus / Incentive</span>
                  <span className="num text-present">+{formatInr(selectedSlip.bonusAmount)}</span>
                </div>
              )}
              {selectedSlip.employeeEpf > 0 && (
                <div className="flex justify-between px-3.5 py-2.5">
                  <span className="text-muted">Employee EPF Contribution</span>
                  <span className="num text-absent">-{formatInr(selectedSlip.employeeEpf)}</span>
                </div>
              )}
              <div className="bg-card-hi px-3.5 py-3">
                <div className="flex justify-between font-semibold">
                  <span className="text-text">Net Payable Salary</span>
                  <span className="num text-[15px] text-present">{formatInr(selectedSlip.netPayment)}</span>
                </div>
                <p className="mt-1 text-xs italic text-muted">
                  {amountInWords(selectedSlip.netPayment)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
