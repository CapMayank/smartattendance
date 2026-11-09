"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Check,
  X,
  Search,
  UserCheck,
  AlertCircle,
  FileText,
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

export interface AdminProfileRequestItem {
  id: string;
  staffId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
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
  bankAccount: "Bank Account Number",
  bankIfsc: "Bank IFSC Code",
  ifsc: "Bank IFSC Code",
  bankName: "Bank Name",
  pan: "PAN Number",
  aadhaar: "Aadhaar Number",
  uan: "Universal Account Number (UAN)",
  pfNumber: "PF / EPF Number",
  esiNumber: "ESI Number",
};

export function ProfileRequestsTab({
  initialRequests,
  departments,
  userRole,
}: ProfileRequestsTabProps) {
  const [requests, setRequests] = useState<AdminProfileRequestItem[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal State for Action
  const [activeModalRequest, setActiveModalRequest] = useState<AdminProfileRequestItem | null>(null);
  const [modalAction, setModalAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [decisionRemarks, setDecisionRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Counters
  const counters = useMemo(() => {
    return {
      all: requests.length,
      pending: requests.filter((r) => r.status === "PENDING").length,
      approved: requests.filter((r) => r.status === "APPROVED").length,
      rejected: requests.filter((r) => r.status === "REJECTED").length,
    };
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      if (statusFilter !== "ALL" && req.status !== statusFilter) return false;
      if (selectedDepartment !== "ALL") {
        if (req.staff.department?.id !== selectedDepartment && req.staff.departmentId !== selectedDepartment) {
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

  const handleOpenAction = (req: AdminProfileRequestItem, action: "APPROVE" | "REJECT") => {
    setActiveModalRequest(req);
    setModalAction(action);
    setDecisionRemarks("");
  };

  const handleCloseModal = () => {
    setActiveModalRequest(null);
    setModalAction(null);
    setDecisionRemarks("");
    setIsSubmitting(false);
  };

  const handleSubmitDecision = async () => {
    if (!activeModalRequest || !modalAction) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/profile-requests/${activeModalRequest.id}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: modalAction,
          decisionRemarks: decisionRemarks.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${modalAction.toLowerCase()} request`);
      }

      toast.success(
        modalAction === "APPROVE"
          ? `Request for ${activeModalRequest.staff.name} approved & profile updated`
          : `Request for ${activeModalRequest.staff.name} rejected`
      );

      // Update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === activeModalRequest.id
            ? {
                ...r,
                status: modalAction === "APPROVE" ? "APPROVED" : "REJECTED",
                decisionRemarks: decisionRemarks.trim() || null,
                decidedAt: new Date().toISOString(),
              }
            : r
        )
      );

      handleCloseModal();
    } catch (err: unknown) {
      console.error("Profile decision error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to record decision");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Approver role advisory banner */}
      {userRole === "APPROVER" && (
        <Card className="border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 text-amber-600 dark:text-amber-400" size={18} />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Administrative Authorization Notice
              </p>
              <p className="text-amber-800 dark:text-amber-300">
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
            count={counters.pending}
          >
            Pending
          </Chip>
          <Chip
            pressed={statusFilter === "APPROVED"}
            onClick={() => setStatusFilter("APPROVED")}
            dot="present"
            count={counters.approved}
          >
            Approved
          </Chip>
          <Chip
            pressed={statusFilter === "REJECTED"}
            onClick={() => setStatusFilter("REJECTED")}
            dot="absent"
            count={counters.rejected}
          >
            Rejected
          </Chip>
          <Chip
            pressed={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
            count={counters.all}
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
          {filteredRequests.map((req) => {
            const isPending = req.status === "PENDING";
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

            return (
              <Card key={req.id} className="p-5 transition-shadow hover:shadow-sm">
                <div className="flex flex-col gap-4">
                  {/* Staff Header & Status */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={req.staff.name} size={38} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{req.staff.name}</span>
                          {req.staff.employeeCode && (
                            <span className="rounded bg-muted/20 px-1.5 py-0.5 font-mono text-xs text-muted">
                              {req.staff.employeeCode}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                          {req.staff.department && <span>{req.staff.department.name}</span>}
                          {req.staff.department && req.staff.designation && <span>•</span>}
                          {req.staff.designation && <span>{req.staff.designation.name}</span>}
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {new Date(req.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          req.status === "PENDING"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                            : req.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                        }`}
                      >
                        {req.status === "PENDING" && <Clock size={12} />}
                        {req.status === "APPROVED" && <Check size={12} />}
                        {req.status === "REJECTED" && <X size={12} />}
                        {req.status}
                      </span>
                    </div>
                  </div>

                  {/* Reason Callout */}
                  {req.reason && (
                    <div className="rounded-lg border border-border/50 bg-muted/10 p-3 text-sm">
                      <div className="flex items-start gap-2">
                        <FileText size={15} className="mt-0.5 text-muted shrink-0" />
                        <div>
                          <span className="font-medium text-foreground">Employee Reason: </span>
                          <span className="text-muted-foreground">{req.reason}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Changes Side-by-Side Diff Table */}
                  <div className="rounded-xl border border-border/80 overflow-hidden bg-card">
                    <div className="border-b border-border/60 bg-muted/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted">
                      Requested Modifications &amp; Diff Comparison
                    </div>
                    <div className="divide-y divide-border/40">
                      {changedKeys.map((key) => {
                        const label = PROFILE_FIELD_LABELS[key] || key;
                        const currentVal = currentParsed[key];
                        const requestedVal = requestedParsed[key];

                        return (
                          <div
                            key={key}
                            className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-4 py-3 text-sm items-center"
                          >
                            <div className="font-medium text-foreground text-xs sm:text-sm">
                              {label}
                            </div>
                            <div className="text-xs sm:text-sm">
                              <span className="text-muted text-xs block sm:hidden">Current: </span>
                              <span className="font-mono text-muted line-through">
                                {currentVal || "— Not Set —"}
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm flex items-center gap-1.5">
                              <span className="text-muted text-xs block sm:hidden">Requested: </span>
                              <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-0.5 font-mono font-medium text-accent">
                                <ArrowRight size={12} className="hidden sm:inline" />
                                {requestedVal || "—"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Decision Remarks if Decided */}
                  {req.status !== "PENDING" && req.decisionRemarks && (
                    <div className="text-xs text-muted rounded-lg bg-muted/20 p-2.5">
                      <span className="font-medium text-foreground">Admin remarks: </span>
                      {req.decisionRemarks}
                    </div>
                  )}

                  {/* Admin Action Bar for Pending Requests */}
                  {isPending && userRole === "ADMIN" && (
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/40">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleOpenAction(req, "REJECT")}
                      >
                        <X size={14} className="mr-1" />
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleOpenAction(req, "APPROVE")}
                      >
                        <Check size={14} className="mr-1" />
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Decision Modal */}
      {activeModalRequest && modalAction && (
        <Modal
          open={true}
          onClose={handleCloseModal}
          title={
            modalAction === "APPROVE"
              ? "Approve Profile & KYC Changes"
              : "Reject Profile Change Request"
          }
          subtitle={`Request submitted by ${activeModalRequest.staff.name} (${activeModalRequest.staff.employeeCode || activeModalRequest.staff.machineId})`}
          size="md"
        >
          <div className="space-y-4 pt-2">
            {modalAction === "APPROVE" ? (
              <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                Approving this request will immediately update the staff profile, banking and statutory KYC records, and linked login credentials in the system.
              </div>
            ) : (
              <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                Rejecting this request will keep the staff member&apos;s current profile unchanged. Please state the reason below so the employee understands why it was rejected.
              </div>
            )}

            <Field
              label={
                modalAction === "APPROVE"
                  ? "Decision Remarks (Optional)"
                  : "Reason for Rejection (Optional)"
              }
              htmlFor="decisionRemarks"
              helper={
                modalAction === "APPROVE"
                  ? "Add any verification reference or notes."
                  : "E.g. IFSC code mismatch, invalid document, or typo."
              }
            >
              <Textarea
                id="decisionRemarks"
                rows={3}
                placeholder={
                  modalAction === "APPROVE"
                    ? "Verified against physical bank passbook / documents..."
                    : "Please provide a valid IFSC code corresponding to your branch..."
                }
                value={decisionRemarks}
                onChange={(e) => setDecisionRemarks(e.target.value)}
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-3">
              <Button variant="secondary" onClick={handleCloseModal} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant={modalAction === "APPROVE" ? "primary" : "danger"}
                onClick={handleSubmitDecision}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? "Processing..."
                  : modalAction === "APPROVE"
                  ? "Confirm & Apply Updates"
                  : "Reject Request"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
