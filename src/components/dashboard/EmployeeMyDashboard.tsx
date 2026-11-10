"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlarmClock,
  AlertCircle,
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
  PageHeader,
  SectionLabel,
} from "@/components/ui";
import type { EmployeePortalData } from "@/lib/employee-portal";
import { formatDate, formatHHmm, formatTime, formatINR } from "@/lib/format";
import { staffPhotoUrl } from "@/lib/photo-url";
import { RequestProfileEditModal } from "@/components/profile/RequestProfileEditModal";
import { SalarySlipModal } from "@/components/payroll/SalarySlipModal";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMinutes(mins: number): string {
  if (!mins || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
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
  const [profileEditModalOpen, setProfileEditModalOpen] = useState(false);
  const [profileEditInitialTab, setProfileEditInitialTab] = useState<"personal" | "banking" | "statutory" | "history">("personal");

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

      {/* Mandatory EPFO / KYC Compliance Alert */}
      {profile.epfoReadiness?.isBankEpf && !profile.epfoReadiness.ready && (
        profile.epfoReadiness.hasPendingRequest ? (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">EPFO &amp; KYC Update Pending Admin Review</p>
                <p className="text-xs opacity-90">
                  Your requested profile and EPFO statutory updates have been submitted and are currently awaiting review by an administrator.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-600 sm:flex-row sm:items-center sm:justify-between dark:text-red-400">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Action Required: Complete Mandatory KYC &amp; EPFO Details</p>
                <p className="text-xs opacity-90">
                  Statutory compliance requires all employees on EPF payroll to submit complete Aadhaar, PAN, Bank account, Father/Husband details, and EPFO registration fields.
                </p>
                {profile.epfoReadiness.missingFields.length > 0 && (
                  <p className="mt-1.5 text-[11.5px] font-medium">
                    Missing / Incomplete: {profile.epfoReadiness.missingFields.join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setProfileEditInitialTab("statutory");
                setProfileEditModalOpen(true);
              }}
            >
              Complete KYC &amp; EPFO Details
            </Button>
          </div>
        )
      )}

      {/* My Identity + Today Status */}
      <section className="grid grid-cols-1 gap-3.5 min-[1024px]:grid-cols-12">
        <Card className="min-[1024px]:col-span-7">
          <CardHeader
            title="My Profile & Shift"
            caption="Your school identity and assigned schedule"
            action={
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line bg-card-hi px-2.5 py-1.5 text-xs font-medium text-text transition-colors hover:border-acc-2 hover:text-acc-1"
                >
                  View Full Profile →
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setProfileEditInitialTab("personal");
                    setProfileEditModalOpen(true);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card-hi px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-acc-2 hover:text-acc-1"
                >
                  <FileText size={13} aria-hidden="true" />
                  Request Details Edit
                </button>
              </div>
            }
          />
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
              <p className="num mt-1 text-[13.5px] font-medium text-text">{profile.joiningDate ? formatDate(profile.joiningDate) : "—"}</p>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <span className="text-xs text-subtle">Registered Email</span>
              <p className="mt-1 truncate text-[13.5px] font-medium text-text">{profile.email || "Use Employee ID"}</p>
            </div>
          </div>

          {profile.kycDetails && (
            <details
              className="group mt-3.5 rounded-xl border border-line-soft bg-canvas p-3.5"
              open={Boolean(profile.epfoReadiness?.isBankEpf && !profile.epfoReadiness.ready)}
            >
              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-text">
                <span>My Statutory, KYC &amp; Banking Details</span>
                <span className="text-muted transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="mt-3 grid grid-cols-2 gap-2.5 border-t border-line-soft pt-3 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-[11px] text-subtle">UAN</span>
                  <p className="num font-medium text-text">{profile.kycDetails.uan || "Not Linked"}</p>
                  {profile.kycDetails.nameOnUan && (
                    <p className="truncate text-[10.5px] text-muted">{profile.kycDetails.nameOnUan}</p>
                  )}
                </div>
                <div>
                  <span className="text-[11px] text-subtle">Aadhaar Number</span>
                  <p className="num font-medium text-text">{profile.kycDetails.aadhaar || "Not Provided"}</p>
                  {profile.kycDetails.nameOnAadhaar && (
                    <p className="truncate text-[10.5px] text-muted">{profile.kycDetails.nameOnAadhaar}</p>
                  )}
                </div>
                <div>
                  <span className="text-[11px] text-subtle">PAN Number</span>
                  <p className="num font-medium text-text">{profile.kycDetails.pan || "Not Provided"}</p>
                  {profile.kycDetails.nameOnPan && (
                    <p className="truncate text-[10.5px] text-muted">{profile.kycDetails.nameOnPan}</p>
                  )}
                </div>
                <div>
                  <span className="text-[11px] text-subtle">Bank Account &amp; IFSC</span>
                  <p className="num font-medium text-text">
                    {profile.kycDetails.bankAccount
                      ? `${profile.kycDetails.bankAccount} (${profile.kycDetails.ifsc || "No IFSC"})`
                      : "Not Provided"}
                  </p>
                  {profile.kycDetails.nameAsPerBank && (
                    <p className="truncate text-[10.5px] text-muted">{profile.kycDetails.nameAsPerBank}</p>
                  )}
                </div>
                <div>
                  <span className="text-[11px] text-subtle">Father / Husband</span>
                  <p className="font-medium text-text">
                    {profile.kycDetails.fatherHusbandName
                      ? `${profile.kycDetails.fatherHusbandName}${profile.kycDetails.relationship ? ` (${profile.kycDetails.relationship})` : ""}`
                      : "Not Provided"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-subtle">Marital Status &amp; Gender</span>
                  <p className="font-medium text-text">
                    {[profile.kycDetails.maritalStatus, profile.kycDetails.gender].filter(Boolean).join(" · ") || "Not Provided"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-subtle">Date of Birth &amp; Mobile</span>
                  <p className="num font-medium text-text">
                    {[profile.kycDetails.dob, profile.kycDetails.mobileNumber].filter(Boolean).join(" · ") || "Not Provided"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-subtle">Qualification &amp; Nationality</span>
                  <p className="font-medium text-text">
                    {[profile.kycDetails.qualification, profile.kycDetails.nationality].filter(Boolean).join(" · ") || "INDIAN"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] text-subtle">Previous Member ID</span>
                  <p className="num font-medium text-text">{profile.kycDetails.previousMemberId || "—"}</p>
                </div>
              </div>
            </details>
          )}
        </Card>

        <Card className="min-[1024px]:col-span-5">
          <CardHeader
            title="My Attendance Today"
            caption={`Date: ${formatDate(today.dateKey)}`}
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
                      <td className="num font-medium text-text">{formatDate(r.dateKey)}</td>
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
                      <span className="num block font-semibold text-present">{formatINR(slip.netPayment)}</span>
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

      <SalarySlipModal
        slip={selectedSlip}
        open={selectedSlip !== null}
        onClose={() => setSelectedSlip(null)}
      />

      <RequestProfileEditModal
        open={profileEditModalOpen}
        onClose={() => setProfileEditModalOpen(false)}
        initialTab={profileEditInitialTab}
      />
    </div>
  );
}
