"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Building2,
  Calendar,
  CreditCard,
  ShieldCheck,
  History,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  KeyRound,
  Download,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  PageHeader,
  EmptyState,
} from "@/components/ui";
import { formatDate, formatHHmm } from "@/lib/format";
import { staffPhotoUrl } from "@/lib/photo-url";
import { RequestProfileEditModal } from "@/components/profile/RequestProfileEditModal";
import type { EmployeePortalData } from "@/lib/employee-portal";
import { PROFILE_FIELD_LABELS } from "@/app/requests/ProfileRequestsTab";

export interface ProfileRequestItem {
  id: string;
  staffId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "PARTIALLY_APPROVED";
  requestedData: string;
  currentData?: string | null;
  reason?: string | null;
  decidedByUserId?: string | null;
  decidedAt?: string | null;
  decisionRemarks?: string | null;
  createdAt: string;
}

export interface EmployeeProfileClientProps {
  initialData: {
    profile: EmployeePortalData["profile"];
    requests: ProfileRequestItem[];
  };
}

export function EmployeeProfileClient({ initialData }: EmployeeProfileClientProps) {
  const router = useRouter();
  const { profile, requests } = initialData;
  const kyc = profile.kycDetails;
  const epfo = profile.epfoReadiness;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<"personal" | "banking" | "statutory" | "history">("personal");
  const [reRequestFields, setReRequestFields] = useState<string[] | undefined>(undefined);

  const openEdit = (
    tab: "personal" | "banking" | "statutory" | "history" = "personal",
    targetFields?: string[]
  ) => {
    setModalTab(tab);
    setReRequestFields(targetFields);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Profile & Statutory KYC"
        subtitle="Manage personal records, banking details, and statutory EPFO compliance"
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              icon={FileText}
              onClick={() => openEdit("personal")}
            >
              Request Details Edit
            </Button>
          </div>
        }
      />

      {/* Compliance Status Alert Banner */}
      {epfo?.isBankEpf && !epfo.ready && (
        epfo.hasPendingRequest ? (
          <div className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">EPFO &amp; KYC Update Pending Admin Review</p>
                <p className="text-xs opacity-90">
                  Your submitted profile updates are currently awaiting review by a school administrator. You can monitor the status under Request History below.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openEdit("history")}
            >
              View Request
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-600 sm:flex-row sm:items-center sm:justify-between dark:text-red-400">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">Action Required: Complete Mandatory KYC &amp; EPFO Details</p>
                <p className="text-xs opacity-90">
                  EPF compliance requires valid Aadhaar, PAN, Bank account, Father/Husband details, and EPFO statutory records.
                </p>
                {epfo.missingFields.length > 0 && (
                  <p className="mt-1.5 text-[11.5px] font-medium">
                    Missing / Incomplete: {epfo.missingFields.join(" · ")}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="shrink-0"
              onClick={() => openEdit("statutory")}
            >
              Complete KYC &amp; EPFO Details
            </Button>
          </div>
        )
      )}

      {/* Overview Card with Identity & Shift */}
      <Card>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar
              name={profile.name}
              src={staffPhotoUrl({ id: profile.id, profilePhotoId: profile.profilePhotoId })}
              size={38}
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-text">{profile.name}</h2>
                {profile.employeeCode && (
                  <span className="num rounded-md border border-acc-2/40 bg-acc-2/10 px-2 py-0.5 text-xs font-medium text-acc-1">
                    {profile.employeeCode}
                  </span>
                )}
                {profile.payGroup === "BANK_EPF" ? (
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Bank / EPF
                  </span>
                ) : (
                  <span className="rounded-md border border-border bg-card-hi px-2 py-0.5 text-xs font-medium text-muted">
                    Cash
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted">
                {profile.designationName || "Staff Member"} · {profile.departmentName || "General Department"} · Machine #{profile.machineId}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button variant="secondary" size="sm" onClick={() => openEdit("personal")}>
              Edit Profile
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Section 1: School Identity & Employment */}
        <Card>
          <CardHeader
            title="School Identity & Employment"
            caption="Official organizational assignment and schedule"
          />
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Department</dt>
              <dd className="mt-1 font-semibold text-text">{profile.departmentName || "General"}</dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Designation</dt>
              <dd className="mt-1 font-semibold text-text">{profile.designationName || "Staff Member"}</dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Assigned Shift</dt>
              <dd className="mt-1 font-semibold text-text">
                {profile.shift ? (
                  <>
                    {profile.shift.name}{" "}
                    <span className="num text-muted font-normal">
                      ({formatHHmm(profile.shift.startTime)}–{formatHHmm(profile.shift.endTime)})
                    </span>
                  </>
                ) : (
                  "General Schedule"
                )}
              </dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Date of Joining</dt>
              <dd className="num mt-1 font-semibold text-text">
                {profile.joiningDate ? formatDate(profile.joiningDate) : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Machine ID</dt>
              <dd className="num mt-1 font-semibold text-text">#{profile.machineId}</dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Official Email</dt>
              <dd className="mt-1 truncate font-semibold text-text">{profile.email || "—"}</dd>
            </div>
          </dl>
        </Card>

        {/* Section 2: Personal & Contact Information */}
        <Card>
          <CardHeader
            title="Personal & Contact Information"
            caption="Basic identity and contact information"
            action={
              <button
                type="button"
                onClick={() => openEdit("personal")}
                className="text-xs font-medium text-acc-1 hover:underline cursor-pointer"
              >
                Edit Personal Details
              </button>
            }
          />
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Mobile Number</dt>
              <dd className="num mt-1 font-semibold text-text">{kyc?.mobileNumber || "—"}</dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Date of Birth</dt>
              <dd className="num mt-1 font-semibold text-text">
                {kyc?.dob ? formatDate(kyc.dob) : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Gender</dt>
              <dd className="mt-1 font-semibold text-text">{kyc?.gender || "—"}</dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Marital Status</dt>
              <dd className="mt-1 font-semibold text-text">{kyc?.maritalStatus || "—"}</dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Father / Husband Name</dt>
              <dd className="mt-1 font-semibold text-text">
                {kyc?.fatherHusbandName
                  ? `${kyc.fatherHusbandName}${kyc.relationship ? ` (${kyc.relationship})` : ""}`
                  : "—"}
              </dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Nationality</dt>
              <dd className="mt-1 font-semibold text-text">{kyc?.nationality || "INDIAN"}</dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3 sm:col-span-2">
              <dt className="text-subtle font-medium">Educational Qualification</dt>
              <dd className="mt-1 font-semibold text-text">{kyc?.qualification || "—"}</dd>
            </div>
          </dl>
        </Card>

        {/* Section 3: Salary Bank Account */}
        <Card>
          <CardHeader
            title="Salary Bank Account"
            caption="Verified banking records for salary credit"
            action={
              <button
                type="button"
                onClick={() => openEdit("banking")}
                className="text-xs font-medium text-acc-1 hover:underline cursor-pointer"
              >
                Edit Banking Details
              </button>
            }
          />
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Bank Account Number</dt>
              <dd className="num mt-1 font-semibold text-text font-mono">
                {kyc?.bankAccount ? kyc.bankAccount : "Not Provided"}
              </dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Bank IFSC Code</dt>
              <dd className="num mt-1 font-semibold text-text font-mono">
                {kyc?.ifsc ? kyc.ifsc : "Not Provided"}
              </dd>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3 sm:col-span-2">
              <dt className="text-subtle font-medium">Account Holder Name (As per Bank)</dt>
              <dd className="mt-1 font-semibold text-text">
                {kyc?.nameAsPerBank || profile.name}
              </dd>
            </div>
          </dl>
        </Card>

        {/* Section 4: Statutory Records & EPFO Compliance */}
        <Card>
          <CardHeader
            title="Statutory Records & EPFO Compliance"
            caption="Official government identity identifiers and EPF registration"
            action={
              <button
                type="button"
                onClick={() => openEdit("statutory")}
                className="text-xs font-medium text-acc-1 hover:underline cursor-pointer"
              >
                Update Statutory &amp; KYC
              </button>
            }
          />
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Universal Account Number (UAN)</dt>
              <dd className="num mt-1 font-semibold text-text font-mono">
                {kyc?.uan || "Not Linked"}
              </dd>
              {kyc?.nameOnUan && (
                <p className="mt-0.5 text-[11px] text-muted">Name: {kyc.nameOnUan}</p>
              )}
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Aadhaar Number</dt>
              <dd className="num mt-1 font-semibold text-text font-mono">
                {kyc?.aadhaar ? `•••• •••• ${kyc.aadhaar.slice(-4)}` : "Not Provided"}
              </dd>
              {kyc?.nameOnAadhaar && (
                <p className="mt-0.5 text-[11px] text-muted">Name: {kyc.nameOnAadhaar}</p>
              )}
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Permanent Account Number (PAN)</dt>
              <dd className="num mt-1 font-semibold text-text font-mono">
                {kyc?.pan || "Not Provided"}
              </dd>
              {kyc?.nameOnPan && (
                <p className="mt-0.5 text-[11px] text-muted">Name: {kyc.nameOnPan}</p>
              )}
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <dt className="text-subtle font-medium">Previous EPFO Member ID</dt>
              <dd className="num mt-1 font-semibold text-text font-mono">
                {kyc?.previousMemberId || "—"}
              </dd>
            </div>

            {/* International Worker & Disability Indicators */}
            <div className="rounded-xl border border-line-soft bg-canvas p-3 sm:col-span-2">
              <dt className="text-subtle font-medium">International Worker &amp; Disability Details</dt>
              <dd className="mt-1 flex flex-wrap gap-2 text-[11.5px]">
                <span className="rounded bg-muted/15 px-2 py-0.5">
                  International Worker: <b>{kyc?.isInternationalWorker === "Y" ? "Yes" : "No"}</b>
                </span>
                {kyc?.isInternationalWorker === "Y" && kyc.passportNumber && (
                  <span className="rounded bg-muted/15 px-2 py-0.5 font-mono">
                    Passport: {kyc.passportNumber}
                  </span>
                )}
                <span className="rounded bg-muted/15 px-2 py-0.5">
                  Disability Status: <b>{kyc?.isPhysicalHandicap === "Y" ? "Yes" : "No"}</b>
                </span>
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Section 5: Profile Change Requests & Status History */}
      <Card>
        <CardHeader
          title="Profile Change Requests & Status History"
          caption="History of submitted profile and KYC modification requests"
          action={
            <Button variant="secondary" size="sm" onClick={() => openEdit("history")}>
              View All in Modal
            </Button>
          }
        />
        {requests.length === 0 ? (
          <EmptyState
            icon={History}
            title="No change requests submitted"
            hint="When you submit a profile or KYC change request, its verification status will appear here."
          />
        ) : (
          <div className="divide-y divide-border/40">
            {requests.map((r) => {
              let parsedDiff: Record<string, string> = {};
              try {
                parsedDiff = JSON.parse(r.requestedData);
              } catch {
                parsedDiff = {};
              }
              const keys = Object.keys(parsedDiff);

              let structuredMeta: {
                note?: string;
                approvedFields?: string[];
                rejectedFields?: string[];
                fieldRemarks?: Record<string, string>;
              } | null = null;

              if (r.decisionRemarks) {
                try {
                  structuredMeta = JSON.parse(r.decisionRemarks);
                } catch {
                  structuredMeta = null;
                }
              }

              const isPartiallyApproved = r.status === "PARTIALLY_APPROVED";
              const isApproved = r.status === "APPROVED";
              const isRejected = r.status === "REJECTED";
              const isPending = r.status === "PENDING";

              const hasRejectedFields =
                (structuredMeta?.rejectedFields && structuredMeta.rejectedFields.length > 0) ||
                isRejected;

              return (
                <div key={r.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          isPending
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                            : isApproved
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : isPartiallyApproved
                            ? "bg-amber-500/15 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-500/30"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}
                      >
                        {isPending && <Clock size={12} />}
                        {isApproved && <CheckCircle2 size={12} />}
                        {isPartiallyApproved && <AlertCircle size={12} />}
                        {isRejected && <XCircle size={12} />}
                        {isPartiallyApproved ? "PARTIALLY APPROVED" : r.status}
                      </span>
                      <span className="text-xs text-muted">
                        Submitted {formatDate(r.createdAt)}
                      </span>
                    </div>
                    {r.decidedAt && (
                      <span className="text-[11px] text-muted">
                        Decided {formatDate(r.decidedAt)}
                      </span>
                    )}
                  </div>

                  {r.reason && (
                    <p className="text-xs text-text">
                      <span className="text-muted">Reason: </span>
                      {r.reason}
                    </p>
                  )}

                  {keys.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {keys.map((k) => {
                        const isFieldApproved =
                          isApproved ||
                          (structuredMeta?.approvedFields &&
                            structuredMeta.approvedFields.includes(k));
                        const isFieldRejected =
                          isRejected ||
                          (structuredMeta?.rejectedFields &&
                            structuredMeta.rejectedFields.includes(k));
                        const fieldNote = structuredMeta?.fieldRemarks?.[k];

                        return (
                          <div
                            key={k}
                            className={`rounded-lg border p-2 text-xs flex flex-col gap-1 ${
                              isFieldApproved
                                ? "border-emerald-500/30 bg-emerald-500/5"
                                : isFieldRejected
                                ? "border-rose-500/30 bg-rose-500/5"
                                : "border-line-soft bg-canvas"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-text">
                                {PROFILE_FIELD_LABELS[k] || k}
                              </span>
                              {isFieldApproved && (
                                <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 size={11} /> Approved
                                </span>
                              )}
                              {isFieldRejected && (
                                <span className="inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-rose-600 dark:text-rose-400">
                                  <XCircle size={11} /> Rejected
                                </span>
                              )}
                            </div>
                            <span className="num font-semibold text-text">{parsedDiff[k]}</span>
                            {fieldNote && (
                              <p className="text-[11px] text-rose-600 dark:text-rose-400">
                                Reason: {fieldNote}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(structuredMeta?.note || (r.decisionRemarks && !structuredMeta)) && (
                    <p className="text-[11.5px] text-muted italic">
                      Admin Note: {structuredMeta?.note || r.decisionRemarks}
                    </p>
                  )}

                  {/* Re-request CTA */}
                  {hasRejectedFields && (
                    <div className="flex justify-end pt-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          const rejected = structuredMeta?.rejectedFields ?? keys;
                          let tab: "personal" | "banking" | "statutory" = "personal";
                          if (
                            rejected.some((k) =>
                              ["bankAccount", "ifsc", "nameAsPerBank"].includes(k)
                            )
                          ) {
                            tab = "banking";
                          } else if (
                            rejected.some((k) =>
                              [
                                "pan",
                                "nameOnPan",
                                "aadhaar",
                                "nameOnAadhaar",
                                "uan",
                                "nameOnUan",
                              ].includes(k)
                            )
                          ) {
                            tab = "statutory";
                          }
                          openEdit(tab, rejected);
                        }}
                      >
                        Fix &amp; Re-Submit Rejected Details →
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <RequestProfileEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialTab={modalTab}
        reRequestFields={reRequestFields}
        onSubmitted={() => {
          setModalOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
