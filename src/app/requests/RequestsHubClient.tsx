"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  Clock,
  UserCheck,
  Inbox,
  ArrowRight,
  ShieldCheck,
  Search,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  Tabs,
  Chip,
  ChipGroup,
  Select,
  Input,
  EmptyState,
} from "@/components/ui";
import {
  PunchRequestsAdminClient,
  PunchRequestCard,
  PunchRejectModal,
  type AdminPunchRequestItem,
  type BiometricState,
} from "../punches/requests/PunchRequestsAdminClient";
import {
  ProfileRequestsTab,
  ProfileRequestCard,
  ProfileDecisionModal,
  type AdminProfileRequestItem,
} from "./ProfileRequestsTab";

export interface RequestsHubClientProps {
  userRole: "ADMIN" | "APPROVER";
  initialPunchRequests: AdminPunchRequestItem[];
  initialProfileRequests: AdminProfileRequestItem[];
  departments: { id: string; name: string }[];
  cutoffDays: number;
  initialTab?: "all" | "punches" | "profile";
}

export function RequestsHubClient({
  userRole,
  initialPunchRequests,
  initialProfileRequests,
  departments,
  cutoffDays,
  initialTab = "all",
}: RequestsHubClientProps) {
  const [activeTab, setActiveTab] = useState<"all" | "punches" | "profile">(initialTab);

  // Live request state across categories
  const [punchRequests, setPunchRequests] = useState<AdminPunchRequestItem[]>(initialPunchRequests);
  const [profileRequests, setProfileRequests] = useState<AdminProfileRequestItem[]>(initialProfileRequests);

  // Filters for "All Requests" tab
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PUNCHES" | "PROFILE">("ALL");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Punch actions state
  const [punchActionInProgressId, setPunchActionInProgressId] = useState<string | null>(null);
  const [punchRejectModalReq, setPunchRejectModalReq] = useState<AdminPunchRequestItem | null>(null);
  const [isRejectingPunch, setIsRejectingPunch] = useState<boolean>(false);
  const [biometricLogs, setBiometricLogs] = useState<Record<string, BiometricState>>({});

  // Profile actions modal state
  const [activeProfileModalReq, setActiveProfileModalReq] = useState<AdminProfileRequestItem | null>(null);
  const [activeProfileModalAction, setActiveProfileModalAction] = useState<"APPROVE" | "REJECT">("APPROVE");

  // Sync tab with URL query param on mount or popstate if in browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "punches" || tabParam === "profile" || tabParam === "all") {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const handleTabChange = (tab: "all" | "punches" | "profile") => {
    setActiveTab(tab);
    if (typeof window !== "undefined" && window.history) {
      const url = new URL(window.location.href);
      if (tab === "all") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  const pendingPunches = punchRequests.filter((r) => r.status === "PENDING").length;
  const pendingProfile = profileRequests.filter((r) => r.status === "PENDING").length;
  const totalPending = pendingPunches + pendingProfile;

  // Unified status counters for "All Requests" tab
  const unifiedCounters = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const p of punchRequests) {
      if (p.status === "PENDING") pending++;
      else if (p.status === "APPROVED") approved++;
      else if (p.status === "REJECTED") rejected++;
    }

    for (const pr of profileRequests) {
      if (pr.status === "PENDING") pending++;
      else if (pr.status === "APPROVED" || pr.status === "PARTIALLY_APPROVED") approved++;
      else if (pr.status === "REJECTED") rejected++;
    }

    return {
      pending,
      approved,
      rejected,
      all: punchRequests.length + profileRequests.length,
    };
  }, [punchRequests, profileRequests]);

  // Unified filtered requests feed for "All Requests" tab
  const unifiedFilteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matchesStatus = (status: string) => {
      if (statusFilter === "ALL") return true;
      if (statusFilter === "PENDING") return status === "PENDING";
      if (statusFilter === "APPROVED") return status === "APPROVED" || status === "PARTIALLY_APPROVED";
      if (statusFilter === "REJECTED") return status === "REJECTED";
      return true;
    };

    const matchesDept = (deptId?: string | null) => {
      if (selectedDepartment === "ALL") return true;
      return deptId === selectedDepartment;
    };

    const filteredP =
      typeFilter === "PROFILE"
        ? []
        : punchRequests.filter((p) => {
            if (!matchesStatus(p.status)) return false;
            if (!matchesDept(p.staff.departmentId)) return false;
            if (q) {
              const nameMatch = p.staff.name.toLowerCase().includes(q);
              const codeMatch = p.staff.employeeCode?.toLowerCase().includes(q) ?? false;
              const reasonMatch = p.reason.toLowerCase().includes(q);
              if (!nameMatch && !codeMatch && !reasonMatch) return false;
            }
            return true;
          });

    const filteredPr =
      typeFilter === "PUNCHES"
        ? []
        : profileRequests.filter((pr) => {
            if (!matchesStatus(pr.status)) return false;
            if (!matchesDept(pr.staff.departmentId)) return false;
            if (q) {
              const nameMatch = pr.staff.name.toLowerCase().includes(q);
              const codeMatch = pr.staff.employeeCode?.toLowerCase().includes(q) ?? false;
              const reasonMatch = pr.reason?.toLowerCase().includes(q) ?? false;
              if (!nameMatch && !codeMatch && !reasonMatch) return false;
            }
            return true;
          });

    const combined: (
      | ({ kind: "PUNCH" } & AdminPunchRequestItem)
      | ({ kind: "PROFILE" } & AdminProfileRequestItem)
    )[] = [
      ...filteredP.map((p) => ({ ...p, kind: "PUNCH" as const })),
      ...filteredPr.map((pr) => ({ ...pr, kind: "PROFILE" as const })),
    ];

    // Sort by createdAt descending
    combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return combined;
  }, [punchRequests, profileRequests, statusFilter, typeFilter, selectedDepartment, searchQuery]);

  // Punch actions
  const handleApprovePunch = useCallback(async (req: AdminPunchRequestItem) => {
    setPunchActionInProgressId(req.id);
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

      setPunchRequests((prev) =>
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
      setPunchActionInProgressId(null);
    }
  }, []);

  const handleConfirmRejectPunch = async () => {
    if (!punchRejectModalReq) return;
    setIsRejectingPunch(true);
    try {
      const res = await fetch(`/api/punch-requests/${punchRejectModalReq.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REJECT",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reject punch request");
      }

      setPunchRequests((prev) =>
        prev.map((item) =>
          item.id === punchRejectModalReq.id
            ? {
                ...item,
                status: "REJECTED",
                decidedAt: new Date().toISOString(),
              }
            : item
        )
      );
      toast.success("Punch request rejected");
      setPunchRejectModalReq(null);
    } catch (err: unknown) {
      console.error("Reject error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to reject punch request");
    } finally {
      setIsRejectingPunch(false);
    }
  };

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

    setBiometricLogs((prev) => ({
      ...prev,
      [req.id]: { loading: true, expanded: true, punches: null, error: null },
    }));

    try {
      const res = await fetch(
        `/api/employee/punches?staffId=${encodeURIComponent(req.staffId)}&from=${encodeURIComponent(
          req.date
        )}&to=${encodeURIComponent(req.date)}`
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

  // Profile actions
  const handleOpenProfileModal = (
    req: AdminProfileRequestItem,
    defaultAction: "APPROVE" | "REJECT" = "APPROVE"
  ) => {
    setActiveProfileModalReq(req);
    setActiveProfileModalAction(defaultAction);
  };

  const handleProfileSuccess = (updated: AdminProfileRequestItem) => {
    setProfileRequests((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r))
    );
    setActiveProfileModalReq(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests & Approvals"
        subtitle="Unified institutional center for attendance punch regularizations, profile modifications, and statutory KYC updates."
      />

      {/* Canonical Tab Navigation Bar: Never show 'all' number badge; only show pending counts when > 0 */}
      <Tabs
        tabs={[
          { id: "all", label: "All Requests" },
          {
            id: "punches",
            label: "Punch Regularizations",
            count: pendingPunches > 0 ? pendingPunches : undefined,
          },
          {
            id: "profile",
            label: "Profile & KYC Updates",
            count: pendingProfile > 0 ? pendingProfile : undefined,
          },
        ]}
        value={activeTab}
        onChange={(id) => handleTabChange(id as "all" | "punches" | "profile")}
      />

      {/* Tab 1: All Requests (Unified Overview + Live Feed) */}
      {activeTab === "all" && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                  <span>Attendance Punches</span>
                  <Clock size={16} className="text-muted" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-text">
                    {pendingPunches}
                  </span>
                  <span className="text-xs text-muted">pending review</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {punchRequests.length} total requests registered
                </p>
              </div>
              <div className="mt-4 border-t border-line-soft pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => handleTabChange("punches")}
                >
                  <span>Review Punch Inboxes</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                  <span>Profile &amp; Statutory KYC</span>
                  <UserCheck size={16} className="text-muted" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-text">
                    {pendingProfile}
                  </span>
                  <span className="text-xs text-muted">pending verification</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {profileRequests.length} total profile edit requests
                </p>
              </div>
              <div className="mt-4 border-t border-line-soft pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => handleTabChange("profile")}
                >
                  <span>Review Profile Requests</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                  <span>Pending Action Required</span>
                  <Inbox size={16} className="text-muted" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-late">
                    {totalPending}
                  </span>
                  <span className="text-xs text-muted">total in need of review</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Keep turnaround times fast to ensure accurate payroll.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1.5 border-t border-line-soft pt-3 text-xs text-muted">
                <ShieldCheck size={14} className="text-present" />
                <span>Institutional compliance active</span>
              </div>
            </Card>
          </div>

          {/* Unified Requests Filter Toolbar */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <ChipGroup label="Filter requests by review status">
              <Chip
                pressed={statusFilter === "PENDING"}
                onClick={() => setStatusFilter("PENDING")}
                dot="late"
                count={unifiedCounters.pending > 0 ? unifiedCounters.pending : undefined}
              >
                Pending
              </Chip>
              <Chip
                pressed={statusFilter === "APPROVED"}
                onClick={() => setStatusFilter("APPROVED")}
                dot="present"
                count={unifiedCounters.approved > 0 ? unifiedCounters.approved : undefined}
              >
                Approved
              </Chip>
              <Chip
                pressed={statusFilter === "REJECTED"}
                onClick={() => setStatusFilter("REJECTED")}
                dot="absent"
                count={unifiedCounters.rejected > 0 ? unifiedCounters.rejected : undefined}
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

            <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center md:max-w-xl md:justify-end">
              {/* Type Filter */}
              <div className="w-full sm:w-44">
                <Select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as "ALL" | "PUNCHES" | "PROFILE")}
                  aria-label="Filter by request category"
                >
                  <option value="ALL">All Categories</option>
                  <option value="PUNCHES">Punches Only</option>
                  <option value="PROFILE">Profile &amp; KYC Only</option>
                </Select>
              </div>

              {/* Department Filter for Admins */}
              {userRole === "ADMIN" && departments.length > 0 && (
                <div className="w-full sm:w-44">
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

              {/* Search Input */}
              <div className="relative w-full sm:w-56">
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

          {/* Unified Requests Feed */}
          {unifiedFilteredItems.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No requests found"
              hint={
                searchQuery || selectedDepartment !== "ALL" || statusFilter !== "ALL" || typeFilter !== "ALL"
                  ? "No requests match your current filters. Try resetting the search or filter options."
                  : "There are currently no punch regularization or profile update requests in this inbox."
              }
            />
          ) : (
            <div className="space-y-4">
              {unifiedFilteredItems.map((item) => {
                if (item.kind === "PUNCH") {
                  return (
                    <PunchRequestCard
                      key={`punch-${item.id}`}
                      request={item}
                      userRole={userRole}
                      showTypeBadge={true}
                      onApprove={handleApprovePunch}
                      onReject={(req) => setPunchRejectModalReq(req)}
                      actionInProgressId={punchActionInProgressId}
                      biometricState={biometricLogs[item.id]}
                      onToggleBiometric={toggleBiometricLogs}
                    />
                  );
                } else {
                  return (
                    <ProfileRequestCard
                      key={`profile-${item.id}`}
                      request={item}
                      userRole={userRole}
                      showTypeBadge={true}
                      onOpenAction={handleOpenProfileModal}
                    />
                  );
                }
              })}
            </div>
          )}

          {/* Shared Modals for Unified Tab */}
          <PunchRejectModal
            request={punchRejectModalReq}
            onClose={() => setPunchRejectModalReq(null)}
            onConfirm={handleConfirmRejectPunch}
            isRejecting={isRejectingPunch}
          />

          <ProfileDecisionModal
            request={activeProfileModalReq}
            initialAction={activeProfileModalAction}
            onClose={() => setActiveProfileModalReq(null)}
            onSuccess={handleProfileSuccess}
          />
        </div>
      )}

      {/* Tab 2: Punch Regularizations Only */}
      {activeTab === "punches" && (
        <PunchRequestsAdminClient
          initialRequests={punchRequests}
          departments={departments}
          userRole={userRole}
          currentCutoffDays={cutoffDays}
          showHeader={false}
        />
      )}

      {/* Tab 3: Profile & KYC Updates Only */}
      {activeTab === "profile" && (
        <ProfileRequestsTab
          initialRequests={profileRequests}
          departments={departments}
          userRole={userRole}
        />
      )}
    </div>
  );
}
