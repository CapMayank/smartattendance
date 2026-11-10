"use client";

import { useState, useEffect, useId } from "react";
import {
  Modal,
  Button,
  Field,
  Input,
  Select,
} from "@/components/ui";
import {
  User,
  CreditCard,
  ShieldCheck,
  History,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Info,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export type ProfileData = {
  id?: string;
  name?: string;
  employeeCode?: string | null;
  machineId?: string;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
  email?: string;
  mobileNumber?: string;
  dob?: string;
  gender?: string;
  fatherHusbandName?: string;
  relationship?: string;
  maritalStatus?: string;
  nationality?: string;
  qualification?: string;
  bankAccount?: string;
  ifsc?: string;
  nameAsPerBank?: string;
  pan?: string;
  nameOnPan?: string;
  aadhaar?: string;
  nameOnAadhaar?: string;
  uan?: string;
  nameOnUan?: string;
  previousMemberId?: string;
  isInternationalWorker?: string;
  countryOfOrigin?: string;
  passportNumber?: string;
  passportValidFrom?: string;
  passportValidTill?: string;
  isPhysicalHandicap?: string;
  locomotive?: string;
  hearing?: string;
  visual?: string;
};

export type ProfileRequestItem = {
  id: string;
  staffId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  requestedData: string;
  currentData?: string | null;
  reason?: string | null;
  decidedByUserId?: string | null;
  decidedAt?: string | null;
  decisionRemarks?: string | null;
  createdAt: string;
};

type TabKey = "personal" | "banking" | "statutory" | "history";

export function RequestProfileEditModal({
  open,
  onClose,
  initialTab = "personal",
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: TabKey;
  onSubmitted?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [currentProfile, setCurrentProfile] = useState<ProfileData | null>(null);
  const [historyRequests, setHistoryRequests] = useState<ProfileRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");

  const [edits, setEdits] = useState<{
    name: string;
    email: string;
    mobileNumber: string;
    dob: string;
    gender: string;
    fatherHusbandName: string;
    relationship: string;
    maritalStatus: string;
    nationality: string;
    qualification: string;
    bankAccount: string;
    confirmBankAccount: string;
    ifsc: string;
    nameAsPerBank: string;
    pan: string;
    nameOnPan: string;
    aadhaar: string;
    nameOnAadhaar: string;
    uan: string;
    nameOnUan: string;
    previousMemberId: string;
    isInternationalWorker: string;
    countryOfOrigin: string;
    passportNumber: string;
    passportValidFrom: string;
    passportValidTill: string;
    isPhysicalHandicap: string;
    locomotive: string;
    hearing: string;
    visual: string;
  }>({
    name: "",
    email: "",
    mobileNumber: "",
    dob: "",
    gender: "",
    fatherHusbandName: "",
    relationship: "",
    maritalStatus: "",
    nationality: "",
    qualification: "",
    bankAccount: "",
    confirmBankAccount: "",
    ifsc: "",
    nameAsPerBank: "",
    pan: "",
    nameOnPan: "",
    aadhaar: "",
    nameOnAadhaar: "",
    uan: "",
    nameOnUan: "",
    previousMemberId: "",
    isInternationalWorker: "",
    countryOfOrigin: "",
    passportNumber: "",
    passportValidFrom: "",
    passportValidTill: "",
    isPhysicalHandicap: "",
    locomotive: "",
    hearing: "",
    visual: "",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [profRes, reqRes] = await Promise.all([
        fetch("/api/employee/profile"),
        fetch("/api/employee/profile-requests"),
      ]);

      if (profRes.ok) {
        const pData = await profRes.json();
        setCurrentProfile(pData.profile);
      }
      if (reqRes.ok) {
        const rData = await reqRes.json();
        setHistoryRequests(rData.requests ?? []);
      }
    } catch {
      // Non-fatal if running in static test environment
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const hasPending = historyRequests.some((r) => r.status === "PENDING");

  const changedFieldsCount = Object.entries(edits).filter(([k, v]) => {
    if (k === "confirmBankAccount") return false;
    return v.trim().length > 0;
  }).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changedFieldsCount === 0) {
      toast.error("Please update at least one field before submitting.");
      return;
    }

    if (edits.bankAccount && edits.confirmBankAccount && edits.bankAccount !== edits.confirmBankAccount) {
      toast.error("Bank account numbers do not match. Please verify.");
      return;
    }

    if (edits.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(edits.pan)) {
      toast.error("Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).");
      return;
    }

    if (edits.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(edits.ifsc)) {
      toast.error("Invalid IFSC format. Must be 11 characters (e.g. SBIN0001234).");
      return;
    }

    if (edits.aadhaar && !/^[2-9]\d{11}$/.test(edits.aadhaar.trim())) {
      toast.error("Invalid Aadhaar number. Must be exactly 12 digits and cannot start with 0 or 1.");
      return;
    }

    if (edits.relationship && !["Father", "Husband", "F", "H"].includes(edits.relationship.trim())) {
      toast.error("Invalid Relationship. Must be Father or Husband.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(edits)) {
        if (k === "confirmBankAccount") continue;
        if (v.trim().length > 0) {
          payload[k] = v.trim();
        }
      }

      const res = await fetch("/api/employee/profile-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedData: payload,
          reason: reason.trim(),
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        toast.error(resData.error || "Failed to submit change request.");
        setSubmitting(false);
        return;
      }

      toast.success("Profile change request submitted successfully for admin review!");
      setEdits({
        name: "",
        email: "",
        mobileNumber: "",
        dob: "",
        gender: "",
        fatherHusbandName: "",
        relationship: "",
        maritalStatus: "",
        nationality: "",
        qualification: "",
        bankAccount: "",
        confirmBankAccount: "",
        ifsc: "",
        nameAsPerBank: "",
        pan: "",
        nameOnPan: "",
        aadhaar: "",
        nameOnAadhaar: "",
        uan: "",
        nameOnUan: "",
        previousMemberId: "",
        isInternationalWorker: "",
        countryOfOrigin: "",
        passportNumber: "",
        passportValidFrom: "",
        passportValidTill: "",
        isPhysicalHandicap: "",
        locomotive: "",
        hearing: "",
        visual: "",
      });
      setReason("");
      fetchData();
      setActiveTab("history");
      onSubmitted?.();
    } catch {
      toast.error("Network error submitting request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const parseRequestedDiff = (jsonStr: string) => {
    try {
      return JSON.parse(jsonStr) as Record<string, string>;
    } catch {
      return {};
    }
  };

  const FIELD_LABELS: Record<string, string> = {
    name: "Full Name",
    email: "Personal / Login Email",
    mobileNumber: "Mobile Number",
    dob: "Date of Birth",
    gender: "Gender",
    fatherHusbandName: "Father / Husband Name",
    relationship: "Father / Husband Relationship",
    maritalStatus: "Marital Status",
    nationality: "Nationality",
    qualification: "Educational Qualification",
    bankAccount: "Bank Account Number",
    ifsc: "IFSC Code",
    nameAsPerBank: "Name as per Bank",
    pan: "Permanent Account Number (PAN)",
    nameOnPan: "Name as per PAN",
    aadhaar: "Aadhaar Number",
    nameOnAadhaar: "Name as per Aadhaar",
    uan: "Universal Account Number (UAN)",
    nameOnUan: "Name on UAN",
    previousMemberId: "Previous EPFO Member ID",
    isInternationalWorker: "International Worker (Y/N)",
    countryOfOrigin: "Country of Origin",
    passportNumber: "Passport Number",
    passportValidFrom: "Passport Valid From",
    passportValidTill: "Passport Valid Till",
    isPhysicalHandicap: "Disability Status (Y/N)",
    locomotive: "Locomotive Disability",
    hearing: "Hearing Disability",
    visual: "Visual Disability",
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request Profile &amp; KYC Update"
      subtitle="Submit verified change requests for administrator approval"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {changedFieldsCount > 0 && activeTab !== "history" && (
              <span className="rounded-md border border-acc-2/30 bg-acc-2/10 px-2.5 py-1 text-xs font-medium text-acc-1">
                {changedFieldsCount} {changedFieldsCount === 1 ? "field" : "fields"} to update
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={submitting}>
              {activeTab === "history" ? "Close" : "Cancel"}
            </Button>
            {activeTab !== "history" && (
              <Button
                icon={Send}
                onClick={handleSubmit}
                loading={submitting}
                disabled={submitting || changedFieldsCount === 0}
              >
                Submit Request to Admin
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Apple Segmented Control Navigation */}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-line-soft bg-canvas p-1 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => setActiveTab("personal")}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
              activeTab === "personal"
                ? "bg-card text-text shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            <User size={15} aria-hidden="true" />
            <span>Personal &amp; Contact</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("banking")}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
              activeTab === "banking"
                ? "bg-card text-text shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            <CreditCard size={15} aria-hidden="true" />
            <span>Banking Details</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("statutory")}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
              activeTab === "statutory"
                ? "bg-card text-text shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            <ShieldCheck size={15} aria-hidden="true" />
            <span>Statutory KYC</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
              activeTab === "history"
                ? "bg-card text-text shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
            <History size={15} aria-hidden="true" />
            <span>Request History</span>
            {hasPending && (
              <span className="size-2 rounded-full bg-late animate-pulse" />
            )}
          </button>
        </div>

        {hasPending && activeTab !== "history" && (
          <div className="flex items-start gap-3 rounded-xl border border-late/30 bg-late/10 p-3.5 text-xs text-text">
            <Clock size={16} className="mt-0.5 flex-none text-late" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-late">Active Request Under Review</p>
              <p className="mt-0.5 text-muted">
                You already have a pending profile change request awaiting administrator action. You can check its status under the Request History tab.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className="font-medium text-acc-1 hover:underline cursor-pointer"
            >
              View Status →
            </button>
          </div>
        )}

        {/* Tab 1: Personal & Contact */}
        {activeTab === "personal" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line-soft bg-canvas p-3.5">
              <p className="text-[13px] font-semibold text-text">Personal Identity &amp; Contact Information</p>
              <p className="text-xs text-muted">
                Proposed changes will be routed to HR and School Administrators for verification.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Field label="Full Name" htmlFor="req-name">
                  <Input
                    id="req-name"
                    value={edits.name}
                    onChange={(e) => setEdits({ ...edits, name: e.target.value })}
                    placeholder={currentProfile?.name || "Enter proposed new full name"}
                  />
                </Field>
                {currentProfile?.name && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.name}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Personal / Login Email" htmlFor="req-email">
                  <Input
                    id="req-email"
                    type="email"
                    value={edits.email}
                    onChange={(e) => setEdits({ ...edits, email: e.target.value })}
                    placeholder={currentProfile?.email || "email@example.com"}
                  />
                </Field>
                {currentProfile?.email && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.email}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Mobile Number" htmlFor="req-mobile">
                  <Input
                    id="req-mobile"
                    type="tel"
                    value={edits.mobileNumber}
                    onChange={(e) => setEdits({ ...edits, mobileNumber: e.target.value })}
                    placeholder={currentProfile?.mobileNumber || "10-digit mobile number"}
                  />
                </Field>
                {currentProfile?.mobileNumber && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="num font-medium text-text">{currentProfile.mobileNumber}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Date of Birth" htmlFor="req-dob">
                  <Input
                    id="req-dob"
                    type="date"
                    value={edits.dob}
                    onChange={(e) => setEdits({ ...edits, dob: e.target.value })}
                  />
                </Field>
                {currentProfile?.dob && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="num font-medium text-text">{currentProfile.dob}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Gender" htmlFor="req-gender">
                  <Select
                    id="req-gender"
                    value={edits.gender}
                    onChange={(e) => setEdits({ ...edits, gender: e.target.value })}
                  >
                    <option value="">Leave unchanged ({currentProfile?.gender || "Not Set"})</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
              </div>

              <div>
                <Field label="Father / Husband Name" htmlFor="req-guardian">
                  <Input
                    id="req-guardian"
                    value={edits.fatherHusbandName}
                    onChange={(e) => setEdits({ ...edits, fatherHusbandName: e.target.value })}
                    placeholder={currentProfile?.fatherHusbandName || "Enter guardian full name"}
                  />
                </Field>
                {currentProfile?.fatherHusbandName && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.fatherHusbandName}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Father / Husband Relationship" htmlFor="req-relationship">
                  <Select
                    id="req-relationship"
                    value={edits.relationship}
                    onChange={(e) => setEdits({ ...edits, relationship: e.target.value })}
                  >
                    <option value="">Leave unchanged ({currentProfile?.relationship || "Not Set"})</option>
                    <option value="Father">Father</option>
                    <option value="Husband">Husband</option>
                  </Select>
                </Field>
                {currentProfile?.relationship && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.relationship}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Marital Status" htmlFor="req-marital-status">
                  <Select
                    id="req-marital-status"
                    value={edits.maritalStatus}
                    onChange={(e) => setEdits({ ...edits, maritalStatus: e.target.value })}
                  >
                    <option value="">Leave unchanged ({currentProfile?.maritalStatus || "Not Set"})</option>
                    <option value="Unmarried">Unmarried</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Divorced">Divorced</option>
                  </Select>
                </Field>
                {currentProfile?.maritalStatus && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.maritalStatus}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Nationality" htmlFor="req-nationality">
                  <Input
                    id="req-nationality"
                    value={edits.nationality}
                    onChange={(e) => setEdits({ ...edits, nationality: e.target.value.toUpperCase() })}
                    placeholder={currentProfile?.nationality || "INDIAN"}
                  />
                </Field>
                {currentProfile?.nationality && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.nationality}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Educational Qualification" htmlFor="req-qualification">
                  <Input
                    id="req-qualification"
                    value={edits.qualification}
                    onChange={(e) => setEdits({ ...edits, qualification: e.target.value })}
                    placeholder={currentProfile?.qualification || "e.g. Graduate, Post Graduate"}
                  />
                </Field>
                {currentProfile?.qualification && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.qualification}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Banking Details */}
        {activeTab === "banking" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line-soft bg-canvas p-3.5">
              <p className="text-[13px] font-semibold text-text">Salary Bank Account Information</p>
              <p className="text-xs text-muted">
                Ensure bank account number and IFSC code match your passbook/cheque leaf exactly for direct salary credit.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Field label="New Bank Account Number" htmlFor="req-bank">
                  <Input
                    id="req-bank"
                    type="password"
                    value={edits.bankAccount}
                    onChange={(e) => setEdits({ ...edits, bankAccount: e.target.value })}
                    placeholder="Enter new account number"
                  />
                </Field>
                {currentProfile?.bankAccount && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="num font-medium text-text">{currentProfile.bankAccount}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Confirm Bank Account Number" htmlFor="req-confirm-bank">
                  <Input
                    id="req-confirm-bank"
                    type="text"
                    value={edits.confirmBankAccount}
                    onChange={(e) => setEdits({ ...edits, confirmBankAccount: e.target.value })}
                    placeholder="Re-enter to confirm"
                  />
                </Field>
              </div>

              <div>
                <Field label="Bank IFSC Code" htmlFor="req-ifsc">
                  <Input
                    id="req-ifsc"
                    value={edits.ifsc}
                    onChange={(e) => setEdits({ ...edits, ifsc: e.target.value.toUpperCase() })}
                    placeholder="e.g. SBIN0001234"
                  />
                </Field>
                {currentProfile?.ifsc && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="num font-medium text-text">{currentProfile.ifsc}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Account Holder Name (As per Bank)" htmlFor="req-bank-name">
                  <Input
                    id="req-bank-name"
                    value={edits.nameAsPerBank}
                    onChange={(e) => setEdits({ ...edits, nameAsPerBank: e.target.value })}
                    placeholder={currentProfile?.nameAsPerBank || "Name as printed on passbook"}
                  />
                </Field>
                {currentProfile?.nameAsPerBank && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.nameAsPerBank}</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Statutory KYC */}
        {activeTab === "statutory" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-line-soft bg-canvas p-3.5">
              <p className="text-[13px] font-semibold text-text">Statutory &amp; Identity Records (PAN / Aadhaar / UAN)</p>
              <p className="text-xs text-muted">
                Statutory identifiers are used for EPF, TDS deduction, and monthly compliance filing.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Field label="Permanent Account Number (PAN)" htmlFor="req-pan">
                  <Input
                    id="req-pan"
                    value={edits.pan}
                    onChange={(e) => setEdits({ ...edits, pan: e.target.value.toUpperCase() })}
                    placeholder="e.g. ABCDE1234F"
                    maxLength={10}
                  />
                </Field>
                {currentProfile?.pan && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="num font-medium text-text">{currentProfile.pan}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Name as per PAN" htmlFor="req-name-on-pan">
                  <Input
                    id="req-name-on-pan"
                    value={edits.nameOnPan}
                    onChange={(e) => setEdits({ ...edits, nameOnPan: e.target.value })}
                    placeholder={currentProfile?.nameOnPan || currentProfile?.name || "Name printed on PAN card"}
                  />
                </Field>
                {currentProfile?.nameOnPan && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.nameOnPan}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Aadhaar Number (12 Digits)" htmlFor="req-aadhaar">
                  <Input
                    id="req-aadhaar"
                    value={edits.aadhaar}
                    onChange={(e) => setEdits({ ...edits, aadhaar: e.target.value.replace(/\D/g, "") })}
                    placeholder="12-digit number (starts with 2-9)"
                    maxLength={12}
                  />
                </Field>
                {currentProfile?.aadhaar && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="num font-medium text-text">{currentProfile.aadhaar}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Name as per Aadhaar" htmlFor="req-name-on-aadhaar">
                  <Input
                    id="req-name-on-aadhaar"
                    value={edits.nameOnAadhaar}
                    onChange={(e) => setEdits({ ...edits, nameOnAadhaar: e.target.value })}
                    placeholder={currentProfile?.nameOnAadhaar || currentProfile?.name || "Name printed on Aadhaar"}
                  />
                </Field>
                {currentProfile?.nameOnAadhaar && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.nameOnAadhaar}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Universal Account Number (UAN)" htmlFor="req-uan">
                  <Input
                    id="req-uan"
                    value={edits.uan}
                    onChange={(e) => setEdits({ ...edits, uan: e.target.value.replace(/\D/g, "") })}
                    placeholder="12-digit UAN"
                    maxLength={12}
                  />
                </Field>
                {currentProfile?.uan && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="num font-medium text-text">{currentProfile.uan}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Name on UAN" htmlFor="req-name-on-uan">
                  <Input
                    id="req-name-on-uan"
                    value={edits.nameOnUan}
                    onChange={(e) => setEdits({ ...edits, nameOnUan: e.target.value })}
                    placeholder={currentProfile?.nameOnUan || currentProfile?.name || "Name on EPFO UAN card"}
                  />
                </Field>
                {currentProfile?.nameOnUan && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.nameOnUan}</span>
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <Field label="Previous EPFO Member ID" htmlFor="req-prev-member-id">
                  <Input
                    id="req-prev-member-id"
                    value={edits.previousMemberId}
                    onChange={(e) => setEdits({ ...edits, previousMemberId: e.target.value })}
                    placeholder={currentProfile?.previousMemberId || "e.g. MH/BAN/0012345/000/0000001"}
                  />
                </Field>
                {currentProfile?.previousMemberId && (
                  <p className="mt-1 text-[11px] text-muted">
                    Current: <span className="font-medium text-text">{currentProfile.previousMemberId}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Collapsible International Worker & Disability section */}
            <details className="group rounded-xl border border-line-soft bg-canvas p-3.5">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-text">
                <span>International Worker &amp; Disability Details</span>
                <span className="text-muted transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="mt-3.5 grid grid-cols-1 gap-4 border-t border-line-soft pt-3.5 sm:grid-cols-2">
                <div>
                  <Field label="International Worker (Y/N)" htmlFor="req-intl-worker">
                    <Select
                      id="req-intl-worker"
                      value={edits.isInternationalWorker}
                      onChange={(e) => setEdits({ ...edits, isInternationalWorker: e.target.value })}
                    >
                      <option value="">Leave unchanged ({currentProfile?.isInternationalWorker || "N"})</option>
                      <option value="N">No (Indian Citizen)</option>
                      <option value="Y">Yes (International Worker)</option>
                    </Select>
                  </Field>
                </div>

                <div>
                  <Field label="Country of Origin" htmlFor="req-country">
                    <Input
                      id="req-country"
                      value={edits.countryOfOrigin}
                      onChange={(e) => setEdits({ ...edits, countryOfOrigin: e.target.value })}
                      placeholder={currentProfile?.countryOfOrigin || "INDIA"}
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Passport Number" htmlFor="req-passport">
                    <Input
                      id="req-passport"
                      value={edits.passportNumber}
                      onChange={(e) => setEdits({ ...edits, passportNumber: e.target.value.toUpperCase() })}
                      placeholder={currentProfile?.passportNumber || "Passport number"}
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Passport Valid Till" htmlFor="req-passport-till">
                    <Input
                      id="req-passport-till"
                      type="date"
                      value={edits.passportValidTill}
                      onChange={(e) => setEdits({ ...edits, passportValidTill: e.target.value })}
                    />
                  </Field>
                </div>

                <div>
                  <Field label="Disability Status (Y/N)" htmlFor="req-handicap">
                    <Select
                      id="req-handicap"
                      value={edits.isPhysicalHandicap}
                      onChange={(e) => setEdits({ ...edits, isPhysicalHandicap: e.target.value })}
                    >
                      <option value="">Leave unchanged ({currentProfile?.isPhysicalHandicap || "N"})</option>
                      <option value="N">No</option>
                      <option value="Y">Yes</option>
                    </Select>
                  </Field>
                </div>

                {edits.isPhysicalHandicap === "Y" && (
                  <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                    <Field label="Locomotive" htmlFor="req-locomotive">
                      <Select
                        id="req-locomotive"
                        value={edits.locomotive}
                        onChange={(e) => setEdits({ ...edits, locomotive: e.target.value })}
                      >
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </Select>
                    </Field>
                    <Field label="Hearing" htmlFor="req-hearing">
                      <Select
                        id="req-hearing"
                        value={edits.hearing}
                        onChange={(e) => setEdits({ ...edits, hearing: e.target.value })}
                      >
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </Select>
                    </Field>
                    <Field label="Visual" htmlFor="req-visual">
                      <Select
                        id="req-visual"
                        value={edits.visual}
                        onChange={(e) => setEdits({ ...edits, visual: e.target.value })}
                      >
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </Select>
                    </Field>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Reason for Request (Shown on active edit tabs) */}
        {activeTab !== "history" && (
          <div className="rounded-xl border border-line-soft bg-canvas p-4 space-y-2">
            <Field label="Reason for Request / Note to Administrator" htmlFor="req-reason">
              <textarea
                id="req-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly explain the reason for this change (e.g. 'Updated salary bank account to SBI', 'PAN card corrected')"
                className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-xs text-text placeholder:text-subtle focus:border-acc-2 focus:outline-none"
              />
            </Field>
          </div>
        )}

        {/* Tab 4: Request History */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-text">Your Submitted Profile Change Requests</p>
                <p className="text-xs text-muted">
                  Track status, approval dates, and administrator feedback.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={fetchData} loading={loading}>
                Refresh
              </Button>
            </div>

            {historyRequests.length === 0 ? (
              <div className="rounded-xl border border-line-soft bg-canvas p-8 text-center">
                <Info size={24} className="mx-auto text-subtle" />
                <p className="mt-2 text-xs font-medium text-text">No Change Requests Found</p>
                <p className="mt-0.5 text-xs text-muted">
                  You have not submitted any profile or statutory change requests yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyRequests.map((req) => {
                  const diff = parseRequestedDiff(req.requestedData);
                  const isPending = req.status === "PENDING";
                  const isApproved = req.status === "APPROVED";
                  const isRejected = req.status === "REJECTED";

                  return (
                    <div
                      key={req.id}
                      className="rounded-xl border border-line-soft bg-card p-4 transition-all"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isPending
                                ? "bg-late/10 text-late border border-late/30"
                                : isApproved
                                  ? "bg-present/10 text-present border border-present/30"
                                  : "bg-absent/10 text-absent border border-absent/30"
                            }`}
                          >
                            {isPending && <Clock size={12} />}
                            {isApproved && <CheckCircle2 size={12} />}
                            {isRejected && <XCircle size={12} />}
                            {isPending
                              ? "Review Pending"
                              : isApproved
                                ? "Approved & Synced"
                                : "Request Rejected"}
                          </span>
                          <span className="text-xs text-muted">
                            Submitted on {formatDate(req.createdAt)}
                          </span>
                        </div>
                        {req.decidedAt && (
                          <span className="text-[11px] text-subtle">
                            Decided {formatDate(req.decidedAt)}
                          </span>
                        )}
                      </div>

                      {/* Diff Items */}
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Object.entries(diff).map(([fieldKey, newVal]) => (
                          <div
                            key={fieldKey}
                            className="flex items-center justify-between rounded-lg border border-line-soft bg-canvas px-3 py-1.5 text-xs"
                          >
                            <span className="text-muted">{FIELD_LABELS[fieldKey] || fieldKey}</span>
                            <span className="num font-semibold text-text">{newVal}</span>
                          </div>
                        ))}
                      </div>

                      {req.reason && (
                        <p className="mt-2.5 text-xs text-muted">
                          <b className="text-subtle">Reason:</b> {req.reason}
                        </p>
                      )}

                      {req.decisionRemarks && (
                        <div className="mt-2.5 rounded-lg border border-line bg-canvas p-2.5 text-xs">
                          <p className="font-semibold text-text">Administrator Remarks:</p>
                          <p className="mt-0.5 text-muted">{req.decisionRemarks}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
