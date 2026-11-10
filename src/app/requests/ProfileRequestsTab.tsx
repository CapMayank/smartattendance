"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  X,
  XCircle,
  AlertCircle,
  Search,
  UserCheck,
  Clock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import {
  Button,
  Card,
  Chip,
  ChipGroup,
  Field,
  Input,
  Select,
  Textarea,
  Modal,
  Avatar,
  EmptyState,
} from "@/components/ui";
import { formatDate } from "@/lib/format";

export interface AdminProfileRequestItem {
  id: string;
  staffId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PARTIALLY_APPROVED";
  requestedData: string; // JSON string
  currentData?: string | null; // JSON string
  reason?: string | null;
  decisionRemarks?: string | null;
  decidedByUserId?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  staff: {
    id: string;
    name: string;
    employeeCode?: string | null;
    machineId: string;
    departmentId?: string | null;
    profilePhotoId?: string | null;
    department?: { id: string; name: string } | null;
    designation?: { id: string; name: string } | null;
  };
}

export interface ProfileRequestsTabProps {
  initialRequests: AdminProfileRequestItem[];
  departments: { id: string; name: string }[];
  userRole: "ADMIN" | "APPROVER";
}

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: "Full Name",
  email: "Email Address",
  phone: "Phone Number",
  mobileNumber: "Mobile Number",
  dob: "Date of Birth",
  gender: "Gender",
  fatherHusbandName: "Father / Husband Name",
  relationship: "Father / Husband Relationship",
  maritalStatus: "Marital Status",
  nationality: "Nationality",
  qualification: "Educational Qualification",
  bankAccount: "Bank Account Number",
  bankIfsc: "Bank IFSC Code",
  ifsc: "Bank IFSC Code",
  bankName: "Bank Name",
  nameAsPerBank: "Name as per Bank",
  pan: "PAN Number",
  nameOnPan: "Name as per PAN",
  aadhaar: "Aadhaar Number",
  nameOnAadhaar: "Name as per Aadhaar",
  uan: "Universal Account Number (UAN)",
  nameOnUan: "Name on UAN",
  previousMemberId: "Previous EPFO Member ID",
  pfNumber: "PF / EPF Number",
  esiNumber: "ESI Number",
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

export function ProfileRequestsTab({
  initialRequests,
  departments,
  userRole,
}: ProfileRequestsTabProps) {
  const [requests, setRequests] = useState<AdminProfileRequestItem[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<
    "PENDING" | "APPROVED" | "REJECTED" | "PARTIALLY_APPROVED" | "ALL"
  >("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State for Selective Decision
  const [activeModalRequest, setActiveModalRequest] = useState<AdminProfileRequestItem | null>(null);
  const [activeModalDefaultAction, setActiveModalDefaultAction] = useState<"APPROVE" | "REJECT">("APPROVE");

  // Counters
  const counters = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      approved: requests.filter(
        (r) => r.status === "APPROVED" || r.status === "PARTIALLY_APPROVED"
      ).length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
    };
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "APPROVED") {
          if (req.status !== "APPROVED" && req.status !== "PARTIALLY_APPROVED") return false;
        } else if (req.status !== statusFilter) {
          return false;
        }
      }
      if (selectedDepartment !== "ALL") {
        if (
          req.staff.department?.id !== selectedDepartment &&
          req.staff.departmentId !== selectedDepartment
        ) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = req.staff.name.toLowerCase().includes(query);
        const codeMatch = req.staff.employeeCode?.toLowerCase().includes(query) ?? false;
        const reasonMatch = req.reason?.toLowerCase().includes(query) ?? false;
        if (!nameMatch && !codeMatch && !reasonMatch) return false;
      }
      return true;
    });
  }, [requests, statusFilter, selectedDepartment, searchQuery]);

  const handleOpenAction = (
    req: AdminProfileRequestItem,
    defaultAction: "APPROVE" | "REJECT" = "APPROVE"
  ) => {
    setActiveModalRequest(req);
    setActiveModalDefaultAction(defaultAction);
  };

  const handleCloseModal = () => {
    setActiveModalRequest(null);
  };

  return (
    <div className="space-y-6">
      {/* Approver role advisory banner */}
      {userRole === "APPROVER" && (
        <Card className="border-late/40 bg-late/5 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-9 flex-none place-items-center rounded-xl bg-late/15 text-late">
              <ShieldAlert size={18} aria-hidden="true" />
            </span>
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-text">
                Administrative Authorization Notice
              </p>
              <p className="text-xs text-muted">
                Department Approvers may view profile and statutory change requests from staff, but official verification and database updates require an Administrator.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <ChipGroup label="Filter profile requests by status">
          <Chip
            pressed={statusFilter === "PENDING"}
            onClick={() => setStatusFilter("PENDING")}
            dot="late"
            count={counters.pending > 0 ? counters.pending : undefined}
          >
            Pending
          </Chip>
          <Chip
            pressed={statusFilter === "APPROVED"}
            onClick={() => setStatusFilter("APPROVED")}
            dot="present"
            count={counters.approved > 0 ? counters.approved : undefined}
          >
            Approved
          </Chip>
          <Chip
            pressed={statusFilter === "REJECTED"}
            onClick={() => setStatusFilter("REJECTED")}
            dot="absent"
            count={counters.rejected > 0 ? counters.rejected : undefined}
          >
            Rejected
          </Chip>
          <Chip
            pressed={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
          >
            All
          </Chip>
        </ChipGroup>

        <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center md:max-w-md md:justify-end">
          {userRole === "ADMIN" && departments.length > 0 && (
            <div className="w-full sm:w-48">
              <Select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                aria-label="Filter by department"
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search staff, code, reason..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No profile edit requests"
          hint={
            searchQuery || selectedDepartment !== "ALL" || statusFilter !== "ALL"
              ? "No change requests match your filters. Try resetting the search or filter options."
              : "There are currently no staff profile or statutory KYC change requests in this inbox."
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <ProfileRequestCard
              key={req.id}
              request={req}
              userRole={userRole}
              onOpenAction={handleOpenAction}
            />
          ))}
        </div>
      )}

      {/* Selective Decision Modal */}
      <ProfileDecisionModal
        request={activeModalRequest}
        initialAction={activeModalDefaultAction}
        onClose={handleCloseModal}
        onSuccess={(updated) => {
          setRequests((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          );
          handleCloseModal();
        }}
      />
    </div>
  );
}

export interface ProfileRequestCardProps {
  request: AdminProfileRequestItem;
  userRole: "ADMIN" | "APPROVER";
  onOpenAction?: (req: AdminProfileRequestItem, defaultAction: "APPROVE" | "REJECT") => void;
  showTypeBadge?: boolean;
}

export function ProfileRequestCard({
  request: req,
  userRole,
  onOpenAction,
  showTypeBadge = false,
}: ProfileRequestCardProps) {
  const isPending = req.status === "PENDING";
  const isPartiallyApproved = req.status === "PARTIALLY_APPROVED";
  let requestedParsed: Record<string, string> = {};
  let currentParsed: Record<string, string> = {};

  try {
    requestedParsed = JSON.parse(req.requestedData);
  } catch {
    requestedParsed = {};
  }

  try {
    currentParsed = req.currentData ? JSON.parse(req.currentData) : {};
  } catch {
    currentParsed = {};
  }

  const changedKeys = Object.keys(requestedParsed);

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

  return (
    <Card key={req.id} className="p-5 transition-shadow hover:shadow-sm">
      <div className="flex flex-col gap-4">
        {showTypeBadge && (
          <div className="flex items-center gap-1.5 border-b border-line-soft pb-2">
            <span className="inline-flex items-center gap-1 rounded border border-line bg-card-hi px-2 py-0.5 text-[11px] font-semibold text-text">
              <UserCheck size={11} className="text-acc-2" /> Profile &amp; Statutory KYC Update
            </span>
          </div>
        )}

        {/* Staff Header & Status */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              name={req.staff.name}
              src={
                req.staff.profilePhotoId
                  ? `/api/photos/${req.staff.profilePhotoId}`
                  : undefined
              }
              size={38}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text">{req.staff.name}</span>
                {req.staff.employeeCode && (
                  <span className="rounded bg-card-hi px-1.5 py-0.5 text-[11px] font-medium text-muted">
                    {req.staff.employeeCode}
                  </span>
                )}
                <span className="text-xs text-muted">#{req.staff.machineId}</span>
              </div>
              <div className="text-xs text-muted">
                {req.staff.department?.name || "No department"}
                {req.staff.designation?.name ? ` · ${req.staff.designation.name}` : ""}
                {" · "}
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} aria-hidden="true" />
                  {formatDate(req.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPending && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-late/30 bg-late/10 px-2.5 py-1 text-xs font-medium text-late">
                <Clock size={12} aria-hidden="true" />
                Pending Review
              </span>
            )}
            {req.status === "APPROVED" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-present/30 bg-present/10 px-2.5 py-1 text-xs font-medium text-present">
                <CheckCircle2 size={12} aria-hidden="true" />
                Approved
              </span>
            )}
            {isPartiallyApproved && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-acc-1/40 bg-acc-1/10 px-2.5 py-1 text-xs font-medium text-acc-1">
                <AlertCircle size={12} aria-hidden="true" />
                Partially Approved
              </span>
            )}
            {req.status === "REJECTED" && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-absent/30 bg-absent/10 px-2.5 py-1 text-xs font-medium text-absent">
                <XCircle size={12} aria-hidden="true" />
                Rejected
              </span>
            )}
          </div>
        </div>

        {/* Reason Callout */}
        {req.reason && (
          <div className="rounded-lg border-l-2 border-acc-1 bg-card-hi/50 px-3.5 py-2 text-sm text-text">
            <span className="font-medium text-muted">Employee Reason: </span>
            {req.reason}
          </div>
        )}

        {/* Changes Side-by-Side Diff Table */}
        <div className="overflow-hidden rounded-xl border border-line/60 bg-canvas/60">
          <div className="border-b border-line/60 bg-card-hi/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Requested Modifications &amp; Diff Comparison ({changedKeys.length}{" "}
            {changedKeys.length === 1 ? "field" : "fields"})
          </div>
          <div className="divide-y divide-line/60">
            {changedKeys.map((key) => {
              const label = PROFILE_FIELD_LABELS[key] || key;
              const currentVal = currentParsed[key];
              const requestedVal = requestedParsed[key];

              const isFieldApproved =
                req.status === "APPROVED" ||
                (structuredMeta?.approvedFields &&
                  structuredMeta.approvedFields.includes(key));
              const isFieldRejected =
                req.status === "REJECTED" ||
                (structuredMeta?.rejectedFields &&
                  structuredMeta.rejectedFields.includes(key));
              const fieldRemark = structuredMeta?.fieldRemarks?.[key];

              return (
                <div
                  key={key}
                  className="grid grid-cols-1 items-center gap-2 px-4 py-3 text-sm sm:grid-cols-3"
                >
                  <div className="text-xs font-medium text-text sm:text-sm">
                    {label}
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="block text-xs text-muted sm:hidden">Current: </span>
                    <span className="font-mono text-muted line-through">
                      {currentVal || "— Not Set —"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs sm:text-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="block text-xs text-muted sm:hidden">
                        Requested:{" "}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded border border-acc-2/30 bg-acc-2/10 px-2 py-0.5 font-mono text-xs font-semibold text-acc-1">
                        <ArrowRight size={11} className="hidden sm:inline" />
                        {requestedVal || "—"}
                      </span>
                      {isFieldApproved && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-present">
                          <CheckCircle2 size={12} /> Approved
                        </span>
                      )}
                      {isFieldRejected && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-absent">
                          <XCircle size={12} /> Rejected
                        </span>
                      )}
                    </div>
                    {fieldRemark && (
                      <p className="text-[11px] text-absent">
                        Note: {fieldRemark}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Decision Remarks if Decided */}
        {req.status !== "PENDING" &&
          (structuredMeta?.note || (req.decisionRemarks && !structuredMeta)) && (
            <div className="rounded-lg border border-line bg-canvas/40 px-3.5 py-2 text-xs text-muted">
              <span className="font-semibold text-text">Reviewer remarks: </span>
              {structuredMeta?.note || req.decisionRemarks}
            </div>
          )}

        {/* Admin Action Bar for Pending Requests */}
        {isPending && userRole === "ADMIN" && onOpenAction && (
          <div className="flex items-center justify-end gap-2.5 border-t border-line/70 pt-3">
            <Button
              variant="secondary"
              onClick={() => onOpenAction(req, "APPROVE")}
            >
              Selective Review
            </Button>
            <Button
              variant="danger"
              icon={X}
              onClick={() => onOpenAction(req, "REJECT")}
            >
              Reject All
            </Button>
            <Button
              variant="primary"
              icon={Check}
              onClick={() => onOpenAction(req, "APPROVE")}
            >
              Approve All
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

export interface ProfileDecisionModalProps {
  request: AdminProfileRequestItem | null;
  initialAction?: "APPROVE" | "REJECT";
  onClose: () => void;
  onSuccess: (updated: AdminProfileRequestItem) => void;
}

export function ProfileDecisionModal({
  request,
  initialAction = "APPROVE",
  onClose,
  onSuccess,
}: ProfileDecisionModalProps) {
  const [fieldDecisions, setFieldDecisions] = useState<Record<string, "APPROVE" | "REJECT">>({});
  const [fieldRemarks, setFieldRemarks] = useState<Record<string, string>>({});
  const [decisionRemarks, setDecisionRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-sync decisions when request changes
  const reqId = request?.id;
  const reqData = request?.requestedData;
  useState(() => {
    if (request) {
      let requestedParsed: Record<string, string> = {};
      try {
        requestedParsed = JSON.parse(request.requestedData);
      } catch {
        requestedParsed = {};
      }
      const initialMap: Record<string, "APPROVE" | "REJECT"> = {};
      for (const key of Object.keys(requestedParsed)) {
        initialMap[key] = initialAction;
      }
      setFieldDecisions(initialMap);
      setFieldRemarks({});
      setDecisionRemarks("");
    }
  });

  // Track changes to modal request
  if (!request) return null;

  let requestedParsed: Record<string, string> = {};
  let currentParsed: Record<string, string> = {};
  try {
    requestedParsed = JSON.parse(request.requestedData);
  } catch {
    requestedParsed = {};
  }
  try {
    currentParsed = request.currentData ? JSON.parse(request.currentData) : {};
  } catch {
    currentParsed = {};
  }

  // Populate default fields if missing
  const fieldKeys = Object.keys(requestedParsed);
  for (const k of fieldKeys) {
    if (!fieldDecisions[k]) {
      fieldDecisions[k] = initialAction;
    }
  }

  const approvedCount = Object.values(fieldDecisions).filter((v) => v === "APPROVE").length;
  const rejectedCount = Object.values(fieldDecisions).filter((v) => v === "REJECT").length;
  const totalCount = fieldKeys.length;

  const handleSubmitDecision = async () => {
    setIsSubmitting(true);
    try {
      const approvedFields = Object.keys(fieldDecisions).filter(
        (k) => fieldDecisions[k] === "APPROVE"
      );
      const rejectedFields = Object.keys(fieldDecisions).filter(
        (k) => fieldDecisions[k] === "REJECT"
      );

      const res = await fetch(`/api/admin/profile-requests/${request.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SELECTIVE",
          approvedFields,
          rejectedFields,
          fieldRemarks,
          decisionRemarks: decisionRemarks.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to record decision");
      }

      const nextStatus = data.request.status as AdminProfileRequestItem["status"];
      toast.success(
        nextStatus === "APPROVED"
          ? `All changes for ${request.staff.name} approved and applied`
          : nextStatus === "PARTIALLY_APPROVED"
          ? `Selective decision recorded: ${approvedFields.length} approved, ${rejectedFields.length} rejected`
          : `Request for ${request.staff.name} rejected`
      );

      onSuccess({
        ...request,
        status: nextStatus,
        decisionRemarks: data.request.decisionRemarks,
        decidedAt: new Date().toISOString(),
      });
    } catch (err: unknown) {
      console.error("Profile decision error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to record decision");
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Review & Decide Profile Updates"
      size="lg"
    >
      <div className="space-y-5 pt-2">
        <div className="flex items-center justify-between rounded-lg border border-line-soft bg-canvas p-3 text-xs">
          <span className="font-semibold text-text">
            Selective Field Control: Choose which fields to approve or reject
          </span>
          <div className="flex items-center gap-2">
            <span className="rounded bg-present/10 px-2 py-0.5 font-semibold text-present">
              {approvedCount} Approved
            </span>
            <span className="rounded bg-absent/10 px-2 py-0.5 font-semibold text-absent">
              {rejectedCount} Rejected
            </span>
          </div>
        </div>

        {/* Field-by-Field Decision Toggles */}
        <div className="max-h-[45vh] space-y-3 overflow-y-auto overscroll-contain pr-1">
          {fieldKeys.map((key) => {
            const requestedVal = requestedParsed[key] || "";
            const currentVal = currentParsed[key] || "";
            const isApproved = fieldDecisions[key] === "APPROVE";
            const isRejected = fieldDecisions[key] === "REJECT";

            return (
              <div
                key={key}
                className={`rounded-xl border p-3 transition-colors ${
                  isApproved
                    ? "border-present/40 bg-present/5"
                    : "border-absent/40 bg-absent/5"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-text">
                      {PROFILE_FIELD_LABELS[key] || key}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <span className="text-muted line-through">
                        {currentVal || "Not set"}
                      </span>
                      <ArrowRight size={11} className="text-muted" />
                      <span className="font-semibold text-text">{requestedVal}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setFieldDecisions((prev) => ({ ...prev, [key]: "APPROVE" }))
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all ${
                        isApproved
                          ? "bg-present text-white shadow-xs"
                          : "border border-line bg-card text-muted hover:text-text"
                      }`}
                    >
                      <Check size={12} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFieldDecisions((prev) => ({ ...prev, [key]: "REJECT" }))
                      }
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all ${
                        isRejected
                          ? "bg-absent text-white shadow-xs"
                          : "border border-line bg-card text-muted hover:text-text"
                      }`}
                    >
                      <X size={12} /> Reject
                    </button>
                  </div>
                </div>

                {isRejected && (
                  <div className="mt-2.5 border-t border-absent/20 pt-2">
                    <input
                      type="text"
                      placeholder="Rejection note for this field (e.g. Document mismatch, invalid format)"
                      value={fieldRemarks[key] || ""}
                      onChange={(e) =>
                        setFieldRemarks((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-text placeholder:text-muted focus:border-absent focus:outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Field
          label="Overall Decision Remarks (Optional)"
          htmlFor="decisionRemarks"
          helper="Add any general guidance or notes that will be displayed to the employee."
        >
          <Textarea
            id="decisionRemarks"
            rows={2}
            placeholder="e.g. Approved banking details. Please re-submit PAN with supporting identity document."
            value={decisionRemarks}
            onChange={(e) => setDecisionRemarks(e.target.value)}
          />
        </Field>

        <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3">
          <span className="text-xs text-muted">
            {approvedCount === totalCount
              ? "All fields will be approved and updated"
              : rejectedCount === totalCount
              ? "All fields will be rejected"
              : `${approvedCount} approved fields will update the profile; ${rejectedCount} will be rejected`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant={
                approvedCount === 0 ? "danger" : approvedCount === totalCount ? "primary" : "primary"
              }
              onClick={handleSubmitDecision}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Processing..."
                : approvedCount === totalCount
                ? "Approve All Changes"
                : approvedCount === 0
                ? "Reject All Changes"
                : `Confirm Decision (${approvedCount} Approved, ${rejectedCount} Rejected)`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
