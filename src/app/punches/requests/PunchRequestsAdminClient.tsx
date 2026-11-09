"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Clock,
  Calendar as CalendarIcon,
  Check,
  CheckCircle2,
  X,
  XCircle,
  Ban,
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  Chip,
  ChipGroup,
  Field,
  Input,
  Select,
  Textarea,
  Modal,
  Avatar,
  PageHeader,
  EmptyState,
} from "@/components/ui";
import { formatHHmm, formatTime } from "@/lib/format";

export interface AdminPunchRequestItem {
  id: string;
  staffId: string;
  date: string;
  punchType: string; // "IN" | "OUT" | "BOTH"
  requestedTime?: string | null;
  requestedInTime?: string | null;
  requestedOutTime?: string | null;
  reason: string;
  explanation?: string | null;
  status: string; // "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"
  decidedByUserId?: string | null;
  decidedAt?: string | null;
  decisionRemarks?: string | null;
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

export interface PunchRequestsAdminClientProps {
  initialRequests: AdminPunchRequestItem[];
  departments: { id: string; name: string }[];
  userRole: "ADMIN" | "APPROVER";
  currentCutoffDays: number;
  showHeader?: boolean;
}

const REASON_LABELS: Record<string, string> = {
  FORGOT_SWIPE: "Forgot to mark attendance / Missed terminal check",
  DUTY_OUTSIDE: "Official on-duty assignment / Off-campus school duty",
  DEVICE_OFFLINE: "Attendance terminal offline / Recognition error",
  POWER_FAILURE: "Campus power outage / Terminal unavailable",
  OTHER: "Other reason (specify details below)",
};

interface BiometricPunchLog {
  id: string;
  timestamp: string;
  type: "IN" | "OUT";
}

interface BiometricState {
  loading: boolean;
  expanded: boolean;
  punches: BiometricPunchLog[] | null;
  error?: string | null;
}

export function PunchRequestsAdminClient({
  initialRequests,
  departments,
  userRole,
  currentCutoffDays,
  showHeader = true,
}: PunchRequestsAdminClientProps) {
  const [requests, setRequests] = useState<AdminPunchRequestItem[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Cutoff Window Configuration (Admin only)
  const [cutoffDays, setCutoffDays] = useState<number>(currentCutoffDays);
  const [isSavingCutoff, setIsSavingCutoff] = useState(false);

  // Decision Actions State
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [rejectModalRequest, setRejectModalRequest] = useState<AdminPunchRequestItem | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState<string>("");
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Biometric Logs Context State (per request)
  const [biometricLogs, setBiometricLogs] = useState<Record<string, BiometricState>>({});

  // Live Status Counters
  const counters = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const req of requests) {
      if (req.status === "PENDING") pending++;
      else if (req.status === "APPROVED") approved++;
      else if (req.status === "REJECTED") rejected++;
    }
    return {
      pending,
      approved,
      rejected,
      all: requests.length,
    };
  }, [requests]);

  // Filtered Requests
  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((req) => {
      // Status filter
      if (statusFilter !== "ALL" && req.status !== statusFilter) {
        return false;
      }
      // Department filter (Admin only)
      if (userRole === "ADMIN" && selectedDepartment !== "ALL") {
        if (req.staff.departmentId !== selectedDepartment) {
          return false;
        }
      }
      // Search query
      if (q) {
        const nameMatch = req.staff.name.toLowerCase().includes(q);
        const codeMatch = req.staff.employeeCode?.toLowerCase().includes(q) ?? false;
        const machineMatch = req.staff.machineId.toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !machineMatch) {
          return false;
        }
      }
      return true;
    });
  }, [requests, statusFilter, selectedDepartment, userRole, searchQuery]);

  // Handle Approve Action
  const handleApprove = useCallback(async (req: AdminPunchRequestItem) => {
    setActionInProgressId(req.id);
    try {
      const res = await fetch(`/api/punch-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to approve punch request");
      }

      setRequests((prev) =>
        prev.map((item) =>
          item.id === req.id
            ? {
                ...item,
                status: "APPROVED",
                decidedAt: new Date().toISOString(),
              }
            : item
        )
      );
      toast.success("Punch request approved and attendance recalculated");
    } catch (err: unknown) {
      console.error("Approve error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to approve punch request");
    } finally {
      setActionInProgressId(null);
    }
  }, []);

  // Open Rejection Modal
  const openRejectModal = (req: AdminPunchRequestItem) => {
    setRejectModalRequest(req);
    setRejectRemarks("");
  };

  // Confirm Rejection
  const handleConfirmReject = async () => {
    if (!rejectModalRequest) return;
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/punch-requests/${rejectModalRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
          decisionRemarks: rejectRemarks.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject punch request");
      }

      setRequests((prev) =>
        prev.map((item) =>
          item.id === rejectModalRequest.id
            ? {
                ...item,
                status: "REJECTED",
                decisionRemarks: rejectRemarks.trim() || null,
                decidedAt: new Date().toISOString(),
              }
            : item
        )
      );
      toast.success("Punch request rejected");
      setRejectModalRequest(null);
    } catch (err: unknown) {
      console.error("Reject error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to reject punch request");
    } finally {
      setIsRejecting(false);
    }
  };

  // Toggle Biometric Logs Context
  const toggleBiometricLogs = async (req: AdminPunchRequestItem) => {
    const current = biometricLogs[req.id];
    if (current?.expanded) {
      setBiometricLogs((prev) => ({
        ...prev,
        [req.id]: { ...current, expanded: false },
      }));
      return;
    }

    if (current?.punches !== null && current?.punches !== undefined) {
      setBiometricLogs((prev) => ({
        ...prev,
        [req.id]: { ...current, expanded: true },
      }));
      return;
    }

    // Fetch biometric logs for that date
    setBiometricLogs((prev) => ({
      ...prev,
      [req.id]: { loading: true, expanded: true, punches: null, error: null },
    }));

    try {
      const res = await fetch(
        `/api/employee/punches?staffId=${encodeURIComponent(req.staffId)}&from=${encodeURIComponent(req.date)}&to=${encodeURIComponent(req.date)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load biometric logs");
      }
      setBiometricLogs((prev) => ({
        ...prev,
        [req.id]: {
          loading: false,
          expanded: true,
          punches: data.punches || [],
          error: null,
        },
      }));
    } catch (err: unknown) {
      setBiometricLogs((prev) => ({
        ...prev,
        [req.id]: {
          loading: false,
          expanded: true,
          punches: null,
          error: err instanceof Error ? err.message : "Failed to load biometric logs",
        },
      }));
    }
  };

  // Update Submission Window Cutoff
  const handleSaveCutoff = async () => {
    setIsSavingCutoff(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "PUNCH_REQUEST_MAX_DAYS",
          value: String(cutoffDays),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save submission window setting");
      }
      toast.success(
        cutoffDays === 0
          ? "Submission window cutoff set to Unlimited"
          : `Submission window cutoff updated to ${cutoffDays} days`
      );
    } catch (err: unknown) {
      console.error("Save cutoff error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update cutoff setting");
    } finally {
      setIsSavingCutoff(false);
    }
  };

  return (
    <div className="space-y-6">
      {showHeader && (
        <PageHeader
          title="Punch Requests Review Inbox"
          subtitle="Review, verify, and resolve missed punch regularization requests submitted by staff."
        />
      )}

      {/* Admin Policy Configuration Card */}
      {userRole === "ADMIN" && (
        <Card>
          <CardHeader
            title="Submission window cutoff"
            caption="Set the cutoff window for past missed punch submissions across the institution."
          />
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="w-full max-w-sm">
              <Field
                label="Maximum allowed submission age"
                htmlFor="punchRequestMaxDaysSelect"
                helper="Employees cannot request punches older than this cutoff. Set to Unlimited to allow past dates without restriction."
              >
                <Select
                  id="punchRequestMaxDaysSelect"
                  value={String(cutoffDays)}
                  onChange={(e) => setCutoffDays(parseInt(e.target.value, 10))}
                >
                  <option value="0">Unlimited (No cutoff window)</option>
                  <option value="3">3 days</option>
                  <option value="7">7 days</option>
                  <option value="14">14 days</option>
                  <option value="30">30 days</option>
                </Select>
              </Field>
            </div>
            <div>
              <Button
                variant="primary"
                onClick={handleSaveCutoff}
                disabled={isSavingCutoff}
              >
                {isSavingCutoff ? "Saving..." : "Save Window"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filters Bar: Status Chips, Department Dropdown, Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <ChipGroup label="Filter punch requests by review status">
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
          {/* Department Filter for Admins */}
          {userRole === "ADMIN" && (
            <div className="w-full sm:w-48">
              <Select
                aria-label="Filter by department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
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

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Search by staff name or employee code..."
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
          icon={Clock}
          title="No punch requests"
          hint={
            searchQuery || selectedDepartment !== "ALL" || statusFilter !== "ALL"
              ? "No requests match your current filters. Try resetting the search or filter options."
              : "There are currently no punch regularization requests in this inbox."
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const bioState = biometricLogs[req.id];
            const isPending = req.status === "PENDING";
            const punchTypeBadge =
              req.punchType === "IN"
                ? "Check-In"
                : req.punchType === "OUT"
                ? "Check-Out"
                : "Both (Check-In & Check-Out)";

            const formattedTime =
              req.punchType === "IN"
                ? formatHHmm(req.requestedTime || req.requestedInTime || "")
                : req.punchType === "OUT"
                ? formatHHmm(req.requestedTime || req.requestedOutTime || "")
                : `In: ${formatHHmm(req.requestedInTime || "")} | Out: ${formatHHmm(req.requestedOutTime || "")}`;

            const reasonLabel = REASON_LABELS[req.reason] || req.reason;

            return (
              <Card key={req.id} className="p-5 transition-shadow hover:shadow-sm">
                <div className="flex flex-col gap-4">
                  {/* Top Bar: Staff Info & Status */}
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
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      {req.status === "PENDING" && (
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
                      {req.status === "REJECTED" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-absent/30 bg-absent/10 px-2.5 py-1 text-xs font-medium text-absent">
                          <XCircle size={12} aria-hidden="true" />
                          Rejected
                        </span>
                      )}
                      {req.status === "CANCELLED" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card-hi px-2.5 py-1 text-xs font-medium text-muted">
                          <Ban size={12} aria-hidden="true" />
                          Cancelled by Staff
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Request Specifics Grid */}
                  <div className="grid grid-cols-1 gap-3 rounded-xl border border-line/60 bg-canvas/60 p-3.5 sm:grid-cols-2 md:grid-cols-3">
                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                        Requested Date
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-text">
                        <CalendarIcon size={14} className="text-muted" />
                        {req.date}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                        Punch Type & Time
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-sm text-text">
                        <span className="font-semibold text-acc-1">{punchTypeBadge}</span>
                        <span className="font-medium text-muted">({formattedTime})</span>
                      </div>
                    </div>

                    <div className="sm:col-span-2 md:col-span-1">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                        Reason Category
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-text">
                        {reasonLabel}
                      </div>
                    </div>
                  </div>

                  {/* Narrative Explanation */}
                  {req.explanation && (
                    <div className="rounded-lg border-l-2 border-acc-1 bg-card-hi/50 px-3.5 py-2 text-sm text-text">
                      <span className="font-medium text-muted">Explanation: </span>
                      {req.explanation}
                    </div>
                  )}

                  {/* Decision Remarks (if resolved) */}
                  {req.decisionRemarks && (
                    <div className="rounded-lg border border-line bg-canvas/40 px-3.5 py-2 text-xs text-muted">
                      <span className="font-semibold text-text">Reviewer remarks: </span>
                      {req.decisionRemarks}
                    </div>
                  )}

                  {/* Existing Biometric Swipes Context Section */}
                  <div className="border-t border-line/50 pt-2">
                    <button
                      type="button"
                      onClick={() => toggleBiometricLogs(req)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-acc-2 hover:underline"
                    >
                      <Eye size={13} aria-hidden="true" />
                      <span>Check Biometric Logs for {req.date}</span>
                      {bioState?.expanded ? (
                        <ChevronUp size={13} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={13} aria-hidden="true" />
                      )}
                    </button>

                    {bioState?.expanded && (
                      <div className="mt-2.5 rounded-lg border border-line bg-card-hi p-3 text-xs">
                        {bioState.loading ? (
                          <div className="text-muted">Loading recorded biometric punches...</div>
                        ) : bioState.error ? (
                          <div className="text-absent">{bioState.error}</div>
                        ) : !bioState.punches || bioState.punches.length === 0 ? (
                          <div className="text-muted">
                            No biometric punches recorded for this staff on {req.date}.
                          </div>
                        ) : (
                          <div>
                            <div className="mb-1.5 font-medium text-text">
                              Recorded Biometric Logs ({bioState.punches.length}):
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {bioState.punches.map((p) => (
                                <span
                                  key={p.id}
                                  className="inline-flex items-center gap-1 rounded border border-line bg-canvas px-2 py-1 font-mono text-[11px]"
                                >
                                  <span
                                    className={
                                      p.type === "IN"
                                        ? "font-bold text-present"
                                        : "font-bold text-late"
                                    }
                                  >
                                    [{p.type}]
                                  </span>
                                  <span>{formatTime(new Date(p.timestamp))}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons for Pending Requests */}
                  {isPending && (
                    <div className="flex items-center justify-end gap-3 border-t border-line/70 pt-3">
                      <Button
                        variant="danger"
                        icon={X}
                        disabled={actionInProgressId === req.id}
                        onClick={() => openRejectModal(req)}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="primary"
                        icon={Check}
                        disabled={actionInProgressId === req.id}
                        onClick={() => handleApprove(req)}
                      >
                        {actionInProgressId === req.id ? "Approving..." : "Approve"}
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rejection Remarks Modal */}
      {rejectModalRequest && (
        <Modal
          open={Boolean(rejectModalRequest)}
          onClose={() => setRejectModalRequest(null)}
          title="Reject Punch Request"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted">
              You are rejecting the punch regularization request for{" "}
              <strong className="text-text">{rejectModalRequest.staff.name}</strong> on{" "}
              <strong className="text-text">{rejectModalRequest.date}</strong>.
            </p>

            <Field
              label="Rejection remarks / Reason (optional)"
              htmlFor="rejectionRemarksInput"
              helper="Provide feedback explaining why the regularization request is being rejected."
            >
              <Textarea
                id="rejectionRemarksInput"
                rows={3}
                placeholder="e.g. No official duty approved; please submit leave application instead."
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
              />
            </Field>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={() => setRejectModalRequest(null)}
                disabled={isRejecting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmReject}
                disabled={isRejecting}
              >
                {isRejecting ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
