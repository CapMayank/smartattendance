"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  UserCheck,
  CheckCircle2,
  Inbox,
  ArrowRight,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { PageHeader, Card, Button } from "@/components/ui";
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

      {/* Segmented Apple-style Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/80 bg-muted/20 p-1.5 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => handleTabChange("all")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "all"
              ? "bg-card text-foreground shadow-sm font-semibold"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Inbox size={16} />
          <span>All Requests</span>
          {totalPending > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              {totalPending}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("punches")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "punches"
              ? "bg-card text-foreground shadow-sm font-semibold"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Clock size={16} />
          <span>Punch Regularizations</span>
          {pendingPunches > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              {pendingPunches}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange("profile")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
            activeTab === "profile"
              ? "bg-card text-foreground shadow-sm font-semibold"
              : "text-muted hover:text-foreground"
          }`}
        >
          <UserCheck size={16} />
          <span>Profile &amp; KYC Updates</span>
          {pendingProfile > 0 && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              {pendingProfile}
            </span>
          )}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "all" && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
                  <span>Attendance Punches</span>
                  <Clock size={16} className="text-muted" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {pendingPunches}
                  </span>
                  <span className="text-xs text-muted">pending review</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {initialPunchRequests.length} total requests registered
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => handleTabChange("punches")}
                >
                  <span>Review Punch Inboxes</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
                  <span>Profile &amp; Statutory KYC</span>
                  <UserCheck size={16} className="text-muted" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {pendingProfile}
                  </span>
                  <span className="text-xs text-muted">pending verification</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {initialProfileRequests.length} total profile edit requests
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => handleTabChange("profile")}
                >
                  <span>Review Profile Requests</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-muted text-xs font-semibold uppercase tracking-wider">
                  <span>Pending Action Required</span>
                  <Inbox size={16} className="text-muted" />
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                    {totalPending}
                  </span>
                  <span className="text-xs text-muted">total in need of review</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Keep turnaround times fast to ensure accurate payroll.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs text-muted">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Institutional compliance active</span>
              </div>
            </Card>
          </div>

          {/* Pending Profile Requests Highlights (if any) */}
          {pendingProfile > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <UserCheck size={18} className="text-primary" />
                  <span>Pending Profile &amp; KYC Changes</span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
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
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clock size={18} className="text-primary" />
                <span>Punch Regularization Requests</span>
                {pendingPunches > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
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
