"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Link as LinkIcon,
  Search,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
} from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";

type UnmatchedPunch = {
  id: string;
  machineId: string;
  timestamp: string;
  type: string;
  receivedAt: string;
  reason: string;
  resolvedAt: string | null;
  resolvedByUserId: string | null;
  resolution: string | null;
  attachedStaffId: string | null;
};

type StaffMember = {
  id: string;
  name: string;
  machineId: string;
  employeeCode?: string | null;
};

export default function UnmatchedPunchesPage() {
  const [punches, setPunches] = useState<UnmatchedPunch[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "RESOLVED" | "ALL">("PENDING");

  // Attach dialog state
  const [attachPunch, setAttachPunch] = useState<UnmatchedPunch | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [staffSearch, setStaffSearch] = useState<string>("");
  const [isAttaching, setIsAttaching] = useState(false);

  // Dismiss dialog state
  const [dismissPunch, setDismissPunch] = useState<UnmatchedPunch | null>(null);
  const [isDismissing, setIsDismissing] = useState(false);

  const fetchStaff = async () => {
    try {
      const res = await fetch("/api/staff");
      if (res.ok) {
        const data = await res.json();
        setStaffList(data);
      }
    } catch (e) {
      console.error("Failed to load staff list:", e);
    }
  };

  const fetchPunches = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/punches/unmatched?status=${statusFilter}`);
      if (!res.ok) throw new Error("Failed to load unmatched punches");
      const data = await res.json();
      setPunches(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to load punches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    fetchPunches();
  }, [statusFilter]);

  const staffById = useMemo(() => {
    const map = new Map<string, StaffMember>();
    for (const s of staffList) {
      map.set(s.id, s);
    }
    return map;
  }, [staffList]);

  const pendingCount = useMemo(() => {
    if (statusFilter === "PENDING") return punches.length;
    return punches.filter((p) => !p.resolvedAt).length;
  }, [punches, statusFilter]);

  const filteredStaff = useMemo(() => {
    if (!staffSearch.trim()) return staffList;
    const q = staffSearch.toLowerCase();
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.machineId.toLowerCase().includes(q) ||
        (s.employeeCode && s.employeeCode.toLowerCase().includes(q))
    );
  }, [staffList, staffSearch]);

  const openAttachDialog = (punch: UnmatchedPunch) => {
    setAttachPunch(punch);
    setSelectedStaffId(punch.attachedStaffId || "");
    setStaffSearch("");
  };

  const handleAttachSubmit = async () => {
    if (!attachPunch) return;
    if (!selectedStaffId) {
      toast.error("Please select a staff member to attach the punch to");
      return;
    }

    setIsAttaching(true);
    try {
      const res = await fetch(`/api/punches/unmatched/${attachPunch.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ATTACH",
          staffId: selectedStaffId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to attach punch");
      }

      toast.success("Punch attached successfully and attendance recalculated");
      setAttachPunch(null);
      fetchPunches();
    } catch (e: any) {
      toast.error(e.message || "Failed to attach punch");
    } finally {
      setIsAttaching(false);
    }
  };

  const handleDismissSubmit = async () => {
    if (!dismissPunch) return;

    setIsDismissing(true);
    try {
      const res = await fetch(`/api/punches/unmatched/${dismissPunch.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DISMISS" }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to dismiss punch");
      }

      toast.success("Punch dismissed");
      setDismissPunch(null);
      fetchPunches();
    } catch (e: any) {
      toast.error(e.message || "Failed to dismiss punch");
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader
            title="Unmatched Punches"
            subtitle="Review and resolve biometric punches with unknown IDs or outside employment periods"
          />
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-late/30 bg-late/10 px-3 py-1 text-xs font-medium text-late">
              <AlertCircle size={13} aria-hidden="true" />
              {pendingCount} pending review
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-present/30 bg-present/10 px-3 py-1 text-xs font-medium text-present">
              <CheckCircle2 size={13} aria-hidden="true" />
              All punches resolved
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <ChipGroup>
          <Chip
            pressed={statusFilter === "PENDING"}
            onClick={() => setStatusFilter("PENDING")}
          >
            Pending
          </Chip>
          <Chip
            pressed={statusFilter === "RESOLVED"}
            onClick={() => setStatusFilter("RESOLVED")}
          >
            Resolved
          </Chip>
          <Chip
            pressed={statusFilter === "ALL"}
            onClick={() => setStatusFilter("ALL")}
          >
            All
          </Chip>
        </ChipGroup>
      </div>

      <Card className="overflow-hidden !p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : punches.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={CheckCircle2}
              title={
                statusFilter === "PENDING"
                  ? "No pending unmatched punches"
                  : "No unmatched punches found"
              }
              hint={
                statusFilter === "PENDING"
                  ? "Great job! All biometric device punches have been matched to valid employees."
                  : "There are no unmatched punches matching the current filter."
              }
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Punch Time</th>
                  <th>Machine ID</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Received At</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {punches.map((p) => {
                  const punchDate = new Date(p.timestamp);
                  const receivedDate = new Date(p.receivedAt);
                  const isPending = !p.resolvedAt;
                  const attachedStaff = p.attachedStaffId
                    ? staffById.get(p.attachedStaffId)
                    : null;

                  return (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap font-medium text-text">
                        <div>{formatDate(punchDate)}</div>
                        <div className="text-xs text-subtle">{formatTime(punchDate)}</div>
                      </td>
                      <td className="whitespace-nowrap font-mono text-sm">
                        {p.machineId}
                      </td>
                      <td className="whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                            p.type === "IN"
                              ? "border border-present/30 bg-present/15 text-present"
                              : "border border-line bg-card-hi text-muted"
                          }`}
                        >
                          {p.type}
                        </span>
                      </td>
                      <td>
                        {p.reason === "UNKNOWN_ID" ? (
                          <div className="flex items-center gap-1.5 text-xs text-late">
                            <UserX size={14} className="flex-none" />
                            <span>Unknown Machine ID</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="flex items-center gap-1.5 text-absent font-medium">
                              <UserX size={14} className="flex-none" />
                              Not Employed on Date
                            </span>
                            {attachedStaff ? (
                              <span className="text-muted">
                                Staff: {attachedStaff.name} ({attachedStaff.machineId})
                              </span>
                            ) : p.attachedStaffId ? (
                              <span className="text-subtle font-mono">
                                Staff ID: {p.attachedStaffId}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-xs text-muted">
                        <div>{formatDate(receivedDate)}</div>
                        <div className="text-subtle">{formatTime(receivedDate)}</div>
                      </td>
                      <td className="whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center rounded-full border border-late/30 bg-late/10 px-2.5 py-0.5 text-xs font-medium text-late">
                            Pending
                          </span>
                        ) : p.resolution === "ATTACHED" ? (
                          <span className="inline-flex items-center rounded-full border border-present/30 bg-present/10 px-2.5 py-0.5 text-xs font-medium text-present">
                            Attached
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-line bg-card px-2.5 py-0.5 text-xs font-medium text-subtle">
                            Dismissed
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        {isPending ? (
                          <div className="inline-flex items-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={LinkIcon}
                              onClick={() => openAttachDialog(p)}
                            >
                              Attach
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                              className="text-muted hover:text-absent"
                              onClick={() => setDismissPunch(p)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-subtle">
                            {p.resolution === "ATTACHED" && attachedStaff
                              ? `Linked to ${attachedStaff.name}`
                              : p.resolution === "DISMISSED"
                              ? "Ignored"
                              : "Resolved"}
                          </span>
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

      {/* Attach to Staff Dialog */}
      <Modal
        open={attachPunch !== null}
        onClose={() => {
          if (!isAttaching) setAttachPunch(null);
        }}
        title="Attach Punch to Staff"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAttachPunch(null)}
              disabled={isAttaching}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={UserCheck}
              loading={isAttaching}
              onClick={handleAttachSubmit}
            >
              Attach Punch
            </Button>
          </div>
        }
      >
        {attachPunch ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-card p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted">Machine ID:</span>
                <span className="font-mono text-text font-medium">
                  {attachPunch.machineId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Punch Time:</span>
                <span className="text-text">
                  {formatDate(new Date(attachPunch.timestamp))} at{" "}
                  {formatTime(new Date(attachPunch.timestamp))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Punch Type:</span>
                <span className="font-semibold text-text">{attachPunch.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Reason:</span>
                <span className="text-late font-medium">{attachPunch.reason}</span>
              </div>
            </div>

            <div className="space-y-3">
              <Field label="Filter Staff" htmlFor="staff-filter">
                <Input
                  id="staff-filter"
                  placeholder="Search by name, employee code or machine ID..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                />
              </Field>

              <Field label="Select Staff Member" htmlFor="staff-select">
                <Select
                  id="staff-select"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                >
                  <option value="">-- Choose a staff member --</option>
                  {filteredStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Machine ID: {s.machineId}
                      {s.employeeCode ? `, Code: ${s.employeeCode}` : ""})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <p className="text-xs text-subtle">
              Attaching this punch will create an official Attendance Log for the chosen staff
              member and automatically recalculate their attendance records for the day.
            </p>
          </div>
        ) : null}
      </Modal>

      {/* Dismiss Confirmation Dialog */}
      <Modal
        open={dismissPunch !== null}
        onClose={() => {
          if (!isDismissing) setDismissPunch(null);
        }}
        title="Dismiss Punch"
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissPunch(null)}
              disabled={isDismissing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={isDismissing}
              onClick={handleDismissSubmit}
            >
              Dismiss
            </Button>
          </div>
        }
      >
        {dismissPunch ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              Are you sure you want to dismiss the punch for Machine ID{" "}
              <span className="font-mono text-text font-semibold">
                {dismissPunch.machineId}
              </span>{" "}
              recorded on {formatDate(new Date(dismissPunch.timestamp))} at{" "}
              {formatTime(new Date(dismissPunch.timestamp))}?
            </p>
            <p className="text-xs text-subtle">
              Dismissed punches are retained in the review queue history for audit purposes but
              will not generate attendance records.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
