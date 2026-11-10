"use client";

import { useState, useEffect } from "react";
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
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Info,
  Send,
  RotateCcw,
  AlertCircle,
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
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "PARTIALLY_APPROVED";
  requestedData: string;
  currentData?: string | null;
  reason?: string | null;
  decidedByUserId?: string | null;
  decidedAt?: string | null;
  decisionRemarks?: string | null;
  createdAt: string;
};

type TabKey = "personal" | "banking" | "statutory" | "history";

type FormState = {
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
};

const DEFAULT_FORM: FormState = {
  name: "",
  email: "",
  mobileNumber: "",
  dob: "",
  gender: "",
  fatherHusbandName: "",
  relationship: "",
  maritalStatus: "",
  nationality: "INDIAN",
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
  isInternationalWorker: "N",
  countryOfOrigin: "INDIA",
  passportNumber: "",
  passportValidFrom: "",
  passportValidTill: "",
  isPhysicalHandicap: "N",
  locomotive: "N",
  hearing: "N",
  visual: "N",
};

export const FIELD_LABELS: Record<string, string> = {
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
  isInternationalWorker: "International Worker",
  countryOfOrigin: "Country of Origin",
  passportNumber: "Passport Number",
  passportValidFrom: "Passport Valid From",
  passportValidTill: "Passport Valid Till",
  isPhysicalHandicap: "Disability Status",
  locomotive: "Locomotive Disability",
  hearing: "Hearing Disability",
  visual: "Visual Disability",
};

export function RequestProfileEditModal({
  open,
  onClose,
  initialTab = "personal",
  reRequestFields,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: TabKey;
  reRequestFields?: string[];
  onSubmitted?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [currentProfile, setCurrentProfile] = useState<ProfileData | null>(null);
  const [historyRequests, setHistoryRequests] = useState<ProfileRequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");

  const [initialValues, setInitialValues] = useState<FormState>(DEFAULT_FORM);
  const [formValues, setFormValues] = useState<FormState>(DEFAULT_FORM);

  const populateFromProfile = (p: ProfileData) => {
    const populated: FormState = {
      name: p.name || "",
      email: p.email || "",
      mobileNumber: p.mobileNumber || "",
      dob: p.dob || "",
      gender: p.gender || "",
      fatherHusbandName: p.fatherHusbandName || "",
      relationship: p.relationship || "",
      maritalStatus: p.maritalStatus || "",
      nationality: p.nationality || "INDIAN",
      qualification: p.qualification || "",
      bankAccount: p.bankAccount || "",
      confirmBankAccount: p.bankAccount || "",
      ifsc: p.ifsc || "",
      nameAsPerBank: p.nameAsPerBank || p.name || "",
      pan: p.pan || "",
      nameOnPan: p.nameOnPan || p.name || "",
      aadhaar: p.aadhaar || "",
      nameOnAadhaar: p.nameOnAadhaar || p.name || "",
      uan: p.uan || "",
      nameOnUan: p.nameOnUan || p.name || "",
      previousMemberId: p.previousMemberId || "",
      isInternationalWorker: p.isInternationalWorker || "N",
      countryOfOrigin: p.countryOfOrigin || "INDIA",
      passportNumber: p.passportNumber || "",
      passportValidFrom: p.passportValidFrom || "",
      passportValidTill: p.passportValidTill || "",
      isPhysicalHandicap: p.isPhysicalHandicap || "N",
      locomotive: p.locomotive || "N",
      hearing: p.hearing || "N",
      visual: p.visual || "N",
    };
    setInitialValues(populated);
    setFormValues(populated);
  };

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
        if (pData.profile) {
          populateFromProfile(pData.profile);
        }
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

  // Determine which fields have actually been modified by comparing with initialValues
  const isFieldModified = (key: keyof FormState) => {
    if (key === "confirmBankAccount") return false;
    return formValues[key].trim() !== initialValues[key].trim();
  };

  const revertField = (key: keyof FormState) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: initialValues[key],
      ...(key === "bankAccount" ? { confirmBankAccount: initialValues.bankAccount } : {}),
    }));
  };

  const modifiedKeys = (Object.keys(formValues) as Array<keyof FormState>).filter((k) =>
    isFieldModified(k)
  );
  const changedFieldsCount = modifiedKeys.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changedFieldsCount === 0) {
      toast.error("No changes made. Please modify at least one field before submitting.");
      return;
    }

    if (
      isFieldModified("bankAccount") &&
      formValues.bankAccount !== formValues.confirmBankAccount
    ) {
      toast.error("Bank account numbers do not match. Please verify.");
      return;
    }

    if (
      isFieldModified("pan") &&
      formValues.pan &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(formValues.pan)
    ) {
      toast.error("Invalid PAN format. Must be 10 characters (e.g. ABCDE1234F).");
      return;
    }

    if (
      isFieldModified("ifsc") &&
      formValues.ifsc &&
      !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(formValues.ifsc)
    ) {
      toast.error("Invalid IFSC format. Must be 11 characters (e.g. SBIN0001234).");
      return;
    }

    if (
      isFieldModified("aadhaar") &&
      formValues.aadhaar &&
      !/^[2-9]\d{11}$/.test(formValues.aadhaar.trim())
    ) {
      toast.error("Invalid Aadhaar number. Must be exactly 12 digits and cannot start with 0 or 1.");
      return;
    }

    if (
      isFieldModified("uan") &&
      formValues.uan &&
      !/^\d{12}$/.test(formValues.uan.trim())
    ) {
      toast.error("Invalid UAN format. Must be exactly 12 digits.");
      return;
    }

    if (
      isFieldModified("bankAccount") &&
      formValues.bankAccount &&
      !/^\d{9,18}$/.test(formValues.bankAccount.trim())
    ) {
      toast.error("Invalid bank account number. Must be between 9 and 18 digits.");
      return;
    }

    if (
      isFieldModified("relationship") &&
      formValues.relationship &&
      !["Father", "Husband", "F", "H"].includes(formValues.relationship.trim())
    ) {
      toast.error("Invalid Relationship. Must be Father or Husband.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, string> = {};
      for (const k of modifiedKeys) {
        payload[k] = formValues[k].trim();
      }

      const res = await fetch("/api/employee/profile-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedData: payload,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit change request");
      }

      toast.success(
        `Request submitted successfully (${changedFieldsCount} ${
          changedFieldsCount === 1 ? "field" : "fields"
        } sent for admin approval)`
      );
      setReason("");
      fetchData();
      setActiveTab("history");
      onSubmitted?.();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Network error submitting request");
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

  const renderFieldHeader = (fieldKey: keyof FormState, label: string) => {
    const modified = isFieldModified(fieldKey);
    const isReRequestTarget = reRequestFields?.includes(fieldKey);

    return (
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12.5px] font-medium text-muted">{label}</span>
        <div className="flex items-center gap-1.5">
          {isReRequestTarget && !modified && (
            <span className="rounded bg-rose-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
              Needs Fix
            </span>
          )}
          {modified && (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.2 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">
                ● Modified
              </span>
              <button
                type="button"
                onClick={() => revertField(fieldKey)}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-acc-1 hover:underline cursor-pointer"
                title="Revert to saved value"
              >
                <RotateCcw size={11} aria-hidden="true" />
                Revert
              </button>
            </div>
          )}
        </div>
      </div>
    );
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
                {changedFieldsCount === 0
                  ? "No Changes Made"
                  : `Submit ${changedFieldsCount} ${
                      changedFieldsCount === 1 ? "Change" : "Changes"
                    } for Approval`}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
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

        {/* Reassurance Banner */}
        {activeTab !== "history" && (
          <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-canvas p-3 text-xs text-text">
            <Info size={16} className="mt-0.5 flex-none text-acc-1" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-text">Your saved records are pre-filled below</p>
              <p className="text-muted">
                Only edit the specific details you need to change. Unmodified fields will remain completely safe and untouched.
              </p>
            </div>
            {changedFieldsCount > 0 ? (
              <span className="rounded-md border border-acc-2/40 bg-acc-2/10 px-2 py-0.5 text-xs font-semibold text-acc-1">
                {changedFieldsCount} {changedFieldsCount === 1 ? "field modified" : "fields modified"}
              </span>
            ) : (
              <span className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-muted">
                All fields saved
              </span>
            )}
          </div>
        )}

        {hasPending && activeTab !== "history" && (
          <div className="flex items-start gap-3 rounded-xl border border-late/30 bg-late/10 p-3.5 text-xs text-text">
            <Clock size={16} className="mt-0.5 flex-none text-late" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-semibold text-late">Active Request Under Review</p>
              <p className="mt-0.5 text-muted">
                You currently have a pending profile change request awaiting administrator action. You can check its status under the Request History tab.
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                {renderFieldHeader("name", "Full Name")}
                <Input
                  id="req-name"
                  value={formValues.name}
                  onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                  placeholder="Enter full name"
                  className={isFieldModified("name") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>

              <div>
                {renderFieldHeader("email", "Personal / Login Email")}
                <Input
                  id="req-email"
                  type="email"
                  value={formValues.email}
                  onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                  placeholder="email@example.com"
                  className={isFieldModified("email") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>

              <div>
                {renderFieldHeader("mobileNumber", "Mobile Number")}
                <Input
                  id="req-mobile"
                  type="tel"
                  value={formValues.mobileNumber}
                  onChange={(e) => setFormValues({ ...formValues, mobileNumber: e.target.value })}
                  placeholder="10-digit mobile number"
                  className={isFieldModified("mobileNumber") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>

              <div>
                {renderFieldHeader("dob", "Date of Birth")}
                <Input
                  id="req-dob"
                  type="date"
                  value={formValues.dob}
                  onChange={(e) => setFormValues({ ...formValues, dob: e.target.value })}
                  className={isFieldModified("dob") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>

              <div>
                {renderFieldHeader("gender", "Gender")}
                <Select
                  id="req-gender"
                  value={formValues.gender}
                  onChange={(e) => setFormValues({ ...formValues, gender: e.target.value })}
                  className={isFieldModified("gender") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                >
                  <option value="">Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </Select>
              </div>

              <div>
                {renderFieldHeader("fatherHusbandName", "Father / Husband Name")}
                <Input
                  id="req-guardian"
                  value={formValues.fatherHusbandName}
                  onChange={(e) => setFormValues({ ...formValues, fatherHusbandName: e.target.value })}
                  placeholder="Enter guardian full name"
                  className={isFieldModified("fatherHusbandName") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>

              <div>
                {renderFieldHeader("relationship", "Father / Husband Relationship")}
                <Select
                  id="req-relationship"
                  value={formValues.relationship}
                  onChange={(e) => setFormValues({ ...formValues, relationship: e.target.value })}
                  className={isFieldModified("relationship") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                >
                  <option value="">Select Relationship</option>
                  <option value="Father">Father</option>
                  <option value="Husband">Husband</option>
                </Select>
              </div>

              <div>
                {renderFieldHeader("maritalStatus", "Marital Status")}
                <Select
                  id="req-marital-status"
                  value={formValues.maritalStatus}
                  onChange={(e) => setFormValues({ ...formValues, maritalStatus: e.target.value })}
                  className={isFieldModified("maritalStatus") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                >
                  <option value="">Select Status</option>
                  <option value="Unmarried">Unmarried</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Divorced">Divorced</option>
                </Select>
              </div>

              <div>
                {renderFieldHeader("nationality", "Nationality")}
                <Input
                  id="req-nationality"
                  value={formValues.nationality}
                  onChange={(e) => setFormValues({ ...formValues, nationality: e.target.value.toUpperCase() })}
                  placeholder="INDIAN"
                  className={isFieldModified("nationality") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>

              <div>
                {renderFieldHeader("qualification", "Educational Qualification")}
                <Input
                  id="req-qualification"
                  value={formValues.qualification}
                  onChange={(e) => setFormValues({ ...formValues, qualification: e.target.value })}
                  placeholder="e.g. Graduate, Post Graduate"
                  className={isFieldModified("qualification") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Banking Details */}
        {activeTab === "banking" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                {renderFieldHeader("bankAccount", "Bank Account Number")}
                <Input
                  id="req-bank"
                  type="password"
                  value={formValues.bankAccount}
                  onChange={(e) => setFormValues({ ...formValues, bankAccount: e.target.value })}
                  placeholder="Enter account number"
                  className={isFieldModified("bankAccount") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
                {isFieldModified("bankAccount") && initialValues.bankAccount && (
                  <p className="mt-1 text-[11px] text-muted">
                    Saved: <span className="font-mono text-text">•••• {initialValues.bankAccount.slice(-4)}</span>
                  </p>
                )}
              </div>

              <div>
                <Field label="Confirm Bank Account Number" htmlFor="req-confirm-bank">
                  <Input
                    id="req-confirm-bank"
                    type="text"
                    value={formValues.confirmBankAccount}
                    onChange={(e) => setFormValues({ ...formValues, confirmBankAccount: e.target.value })}
                    placeholder="Re-enter to confirm"
                  />
                </Field>
              </div>

              <div>
                {renderFieldHeader("ifsc", "Bank IFSC Code")}
                <Input
                  id="req-ifsc"
                  value={formValues.ifsc}
                  onChange={(e) => setFormValues({ ...formValues, ifsc: e.target.value.toUpperCase() })}
                  placeholder="e.g. SBIN0001234"
                  className={isFieldModified("ifsc") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
                {isFieldModified("ifsc") && initialValues.ifsc && (
                  <p className="mt-1 text-[11px] text-muted">
                    Saved: <span className="font-mono text-text">{initialValues.ifsc}</span>
                  </p>
                )}
              </div>

              <div>
                {renderFieldHeader("nameAsPerBank", "Account Holder Name (As per Bank)")}
                <Input
                  id="req-bank-name"
                  value={formValues.nameAsPerBank}
                  onChange={(e) => setFormValues({ ...formValues, nameAsPerBank: e.target.value })}
                  placeholder="Name as printed on passbook"
                  className={isFieldModified("nameAsPerBank") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Statutory KYC */}
        {activeTab === "statutory" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                {renderFieldHeader("pan", "Permanent Account Number (PAN)")}
                <Input
                  id="req-pan"
                  value={formValues.pan}
                  onChange={(e) => setFormValues({ ...formValues, pan: e.target.value.toUpperCase() })}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  className={isFieldModified("pan") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
                {isFieldModified("pan") && initialValues.pan && (
                  <p className="mt-1 text-[11px] text-muted">
                    Saved: <span className="font-mono text-text">{initialValues.pan}</span>
                  </p>
                )}
              </div>

              <div>
                {renderFieldHeader("nameOnPan", "Name as per PAN")}
                <Input
                  id="req-name-on-pan"
                  value={formValues.nameOnPan}
                  onChange={(e) => setFormValues({ ...formValues, nameOnPan: e.target.value })}
                  placeholder="Name printed on PAN card"
                  className={isFieldModified("nameOnPan") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>

              <div>
                {renderFieldHeader("aadhaar", "Aadhaar Number (12 Digits)")}
                <Input
                  id="req-aadhaar"
                  value={formValues.aadhaar}
                  onChange={(e) => setFormValues({ ...formValues, aadhaar: e.target.value.replace(/\D/g, "") })}
                  placeholder="12-digit number (starts with 2-9)"
                  maxLength={12}
                  className={isFieldModified("aadhaar") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
                {isFieldModified("aadhaar") && initialValues.aadhaar && (
                  <p className="mt-1 text-[11px] text-muted">
                    Saved: <span className="font-mono text-text">•••• •••• {initialValues.aadhaar.slice(-4)}</span>
                  </p>
                )}
              </div>

              <div>
                {renderFieldHeader("nameOnAadhaar", "Name as per Aadhaar")}
                <Input
                  id="req-name-on-aadhaar"
                  value={formValues.nameOnAadhaar}
                  onChange={(e) => setFormValues({ ...formValues, nameOnAadhaar: e.target.value })}
                  placeholder="Name printed on Aadhaar"
                  className={isFieldModified("nameOnAadhaar") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>

              <div>
                {renderFieldHeader("uan", "Universal Account Number (UAN)")}
                <Input
                  id="req-uan"
                  value={formValues.uan}
                  onChange={(e) => setFormValues({ ...formValues, uan: e.target.value.replace(/\D/g, "") })}
                  placeholder="12-digit UAN"
                  maxLength={12}
                  className={isFieldModified("uan") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
                {isFieldModified("uan") && initialValues.uan && (
                  <p className="mt-1 text-[11px] text-muted">
                    Saved: <span className="font-mono text-text">{initialValues.uan}</span>
                  </p>
                )}
              </div>

              <div>
                {renderFieldHeader("nameOnUan", "Name on UAN")}
                <Input
                  id="req-name-on-uan"
                  value={formValues.nameOnUan}
                  onChange={(e) => setFormValues({ ...formValues, nameOnUan: e.target.value })}
                  placeholder="Name on EPFO UAN card"
                  className={isFieldModified("nameOnUan") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
              </div>

              <div className="sm:col-span-2">
                {renderFieldHeader("previousMemberId", "Previous EPFO Member ID")}
                <Input
                  id="req-prev-member-id"
                  value={formValues.previousMemberId}
                  onChange={(e) => setFormValues({ ...formValues, previousMemberId: e.target.value })}
                  placeholder="e.g. MH/BAN/0012345/000/0000001"
                  className={isFieldModified("previousMemberId") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                />
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
                  {renderFieldHeader("isInternationalWorker", "International Worker (Y/N)")}
                  <Select
                    id="req-intl-worker"
                    value={formValues.isInternationalWorker}
                    onChange={(e) => setFormValues({ ...formValues, isInternationalWorker: e.target.value })}
                    className={isFieldModified("isInternationalWorker") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                  >
                    <option value="N">No (Indian Citizen)</option>
                    <option value="Y">Yes (International Worker)</option>
                  </Select>
                </div>

                <div>
                  {renderFieldHeader("countryOfOrigin", "Country of Origin")}
                  <Input
                    id="req-country"
                    value={formValues.countryOfOrigin}
                    onChange={(e) => setFormValues({ ...formValues, countryOfOrigin: e.target.value })}
                    placeholder="INDIA"
                    className={isFieldModified("countryOfOrigin") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                  />
                </div>

                <div>
                  {renderFieldHeader("passportNumber", "Passport Number")}
                  <Input
                    id="req-passport"
                    value={formValues.passportNumber}
                    onChange={(e) => setFormValues({ ...formValues, passportNumber: e.target.value.toUpperCase() })}
                    placeholder="Passport number"
                    className={isFieldModified("passportNumber") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                  />
                </div>

                <div>
                  {renderFieldHeader("passportValidFrom", "Passport Valid From")}
                  <Input
                    id="req-passport-from"
                    type="date"
                    value={formValues.passportValidFrom}
                    onChange={(e) => setFormValues({ ...formValues, passportValidFrom: e.target.value })}
                    className={isFieldModified("passportValidFrom") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                  />
                </div>

                <div>
                  {renderFieldHeader("passportValidTill", "Passport Valid Till")}
                  <Input
                    id="req-passport-till"
                    type="date"
                    value={formValues.passportValidTill}
                    onChange={(e) => setFormValues({ ...formValues, passportValidTill: e.target.value })}
                    className={isFieldModified("passportValidTill") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                  />
                </div>

                <div>
                  {renderFieldHeader("isPhysicalHandicap", "Disability Status (Y/N)")}
                  <Select
                    id="req-handicap"
                    value={formValues.isPhysicalHandicap}
                    onChange={(e) => setFormValues({ ...formValues, isPhysicalHandicap: e.target.value })}
                    className={isFieldModified("isPhysicalHandicap") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                  >
                    <option value="N">No</option>
                    <option value="Y">Yes</option>
                  </Select>
                </div>

                {formValues.isPhysicalHandicap === "Y" && (
                  <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                    <div>
                      {renderFieldHeader("locomotive", "Locomotive")}
                      <Select
                        id="req-locomotive"
                        value={formValues.locomotive}
                        onChange={(e) => setFormValues({ ...formValues, locomotive: e.target.value })}
                        className={isFieldModified("locomotive") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                      >
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </Select>
                    </div>
                    <div>
                      {renderFieldHeader("hearing", "Hearing")}
                      <Select
                        id="req-hearing"
                        value={formValues.hearing}
                        onChange={(e) => setFormValues({ ...formValues, hearing: e.target.value })}
                        className={isFieldModified("hearing") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                      >
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </Select>
                    </div>
                    <div>
                      {renderFieldHeader("visual", "Visual")}
                      <Select
                        id="req-visual"
                        value={formValues.visual}
                        onChange={(e) => setFormValues({ ...formValues, visual: e.target.value })}
                        className={isFieldModified("visual") ? "border-acc-1 ring-1 ring-acc-1/20" : ""}
                      >
                        <option value="N">No</option>
                        <option value="Y">Yes</option>
                      </Select>
                    </div>
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
                placeholder="Briefly explain the reason for this change (e.g. 'Updated salary bank account to SBI', 'Corrected Aadhaar name mismatch')"
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
                  const isPartiallyApproved = req.status === "PARTIALLY_APPROVED";

                  let structuredMeta: {
                    note?: string;
                    approvedFields?: string[];
                    rejectedFields?: string[];
                    fieldRemarks?: Record<string, string>;
                  } | null = null;

                  if (req.decisionRemarks) {
                    try {
                      structuredMeta = JSON.parse(req.decisionRemarks);
                    } catch {
                      structuredMeta = null;
                    }
                  }

                  const hasRejectedFields =
                    (structuredMeta?.rejectedFields && structuredMeta.rejectedFields.length > 0) ||
                    isRejected;

                  return (
                    <div
                      key={req.id}
                      className="rounded-xl border border-line-soft bg-card p-4 transition-all space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft pb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              isPending
                                ? "bg-late/10 text-late border border-late/30"
                                : isApproved
                                ? "bg-present/10 text-present border border-present/30"
                                : isPartiallyApproved
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                : "bg-absent/10 text-absent border border-absent/30"
                            }`}
                          >
                            {isPending && <Clock size={12} />}
                            {isApproved && <CheckCircle2 size={12} />}
                            {isPartiallyApproved && <AlertCircle size={12} />}
                            {isRejected && <XCircle size={12} />}
                            {isPending
                              ? "Review Pending"
                              : isApproved
                              ? "Approved & Synced"
                              : isPartiallyApproved
                              ? "Partially Approved"
                              : "Request Rejected"}
                          </span>
                          <span className="text-xs text-muted">
                            Submitted {formatDate(req.createdAt)}
                          </span>
                        </div>
                        {req.decidedAt && (
                          <span className="text-[11px] text-subtle">
                            Decided {formatDate(req.decidedAt)}
                          </span>
                        )}
                      </div>

                      {/* Diff Items with Selective Status */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Object.entries(diff).map(([fieldKey, newVal]) => {
                          const isFieldApproved =
                            isApproved ||
                            (structuredMeta?.approvedFields &&
                              structuredMeta.approvedFields.includes(fieldKey));
                          const isFieldRejected =
                            isRejected ||
                            (structuredMeta?.rejectedFields &&
                              structuredMeta.rejectedFields.includes(fieldKey));
                          const fieldRemark = structuredMeta?.fieldRemarks?.[fieldKey];

                          return (
                            <div
                              key={fieldKey}
                              className={`flex flex-col gap-1 rounded-lg border p-2.5 text-xs ${
                                isFieldApproved
                                  ? "border-emerald-500/30 bg-emerald-500/5"
                                  : isFieldRejected
                                  ? "border-rose-500/30 bg-rose-500/5"
                                  : "border-line-soft bg-canvas"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-text">
                                  {FIELD_LABELS[fieldKey] || fieldKey}
                                </span>
                                {isFieldApproved && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 size={11} /> Approved
                                  </span>
                                )}
                                {isFieldRejected && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                    <XCircle size={11} /> Rejected
                                  </span>
                                )}
                              </div>
                              <span className="num font-semibold text-text">{newVal}</span>
                              {fieldRemark && (
                                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                                  Note: {fieldRemark}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {req.reason && (
                        <p className="text-xs text-muted">
                          <b className="text-subtle">Reason:</b> {req.reason}
                        </p>
                      )}

                      {(structuredMeta?.note || (req.decisionRemarks && !structuredMeta)) && (
                        <div className="rounded-lg border border-line bg-canvas p-2.5 text-xs">
                          <p className="font-semibold text-text">Administrator Remarks:</p>
                          <p className="mt-0.5 text-muted">
                            {structuredMeta?.note || req.decisionRemarks}
                          </p>
                        </div>
                      )}

                      {/* Direct CTA to re-request rejected fields */}
                      {hasRejectedFields && (
                        <div className="flex justify-end pt-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              const rejected = structuredMeta?.rejectedFields ?? Object.keys(diff);
                              // Auto switch to personal or banking or statutory
                              if (
                                rejected.some((k) =>
                                  ["bankAccount", "ifsc", "nameAsPerBank"].includes(k)
                                )
                              ) {
                                setActiveTab("banking");
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
                                setActiveTab("statutory");
                              } else {
                                setActiveTab("personal");
                              }
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
          </div>
        )}
      </div>
    </Modal>
  );
}
