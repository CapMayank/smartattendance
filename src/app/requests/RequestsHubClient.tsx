"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  UserCheck,
  Inbox,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { PageHeader, Card, Button, Tabs } from "@/components/ui";
import {
  PunchRequestsAdminClient,
  type AdminPunchRequestItem,
} from "../punches/requests/PunchRequestsAdminClient";
import {
  ProfileRequestsTab,
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

  const pendingPunches = initialPunchRequests.filter((r) => r.status === "PENDING").length;
  const pendingProfile = initialProfileRequests.filter((r) => r.status === "PENDING").length;
  const totalPending = pendingPunches + pendingProfile;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Requests & Approvals"
        subtitle="Unified institutional center for attendance punch regularizations, profile modifications, and statutory KYC updates."
      />

      {/* Canonical Design System Tab Navigation Bar */}
      <Tabs
        tabs={[
          { id: "all", label: "All Requests", count: totalPending },
          { id: "punches", label: "Punch Regularizations", count: pendingPunches },
          { id: "profile", label: "Profile & KYC Updates", count: pendingProfile },
        ]}
        value={activeTab}
        onChange={(id) => handleTabChange(id as "all" | "punches" | "profile")}
      />

      {/* Tab Contents */}
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
                  {initialPunchRequests.length} total requests registered
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
                  {initialProfileRequests.length} total profile edit requests
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

          {/* Pending Profile Requests Highlights (if any) */}
          {pendingProfile > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-text">
                  <UserCheck size={18} className="text-acc-1" />
                  <span>Pending Profile &amp; KYC Changes</span>
                  <span className="rounded-full bg-late/15 px-2 py-0.5 text-xs font-semibold text-late">
                    {pendingProfile}
                  </span>
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTabChange("profile")}
                >
                  <span>View All</span>
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>

              <ProfileRequestsTab
                initialRequests={initialProfileRequests}
                departments={departments}
                userRole={userRole}
              />
            </div>
          )}

          {/* Punch Requests Inbox View */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-text">
                <Clock size={18} className="text-acc-1" />
                <span>Punch Regularization Requests</span>
                {pendingPunches > 0 && (
                  <span className="rounded-full bg-late/15 px-2 py-0.5 text-xs font-semibold text-late">
                    {pendingPunches}
                  </span>
                )}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleTabChange("punches")}
              >
                <span>Full View</span>
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>

            <PunchRequestsAdminClient
              initialRequests={initialPunchRequests}
              departments={departments}
              userRole={userRole}
              currentCutoffDays={cutoffDays}
              showHeader={false}
            />
          </div>
        </div>
      )}

      {activeTab === "punches" && (
        <PunchRequestsAdminClient
          initialRequests={initialPunchRequests}
          departments={departments}
          userRole={userRole}
          currentCutoffDays={cutoffDays}
          showHeader={false}
        />
      )}

      {activeTab === "profile" && (
        <ProfileRequestsTab
          initialRequests={initialProfileRequests}
          departments={departments}
          userRole={userRole}
        />
      )}
    </div>
  );
}
