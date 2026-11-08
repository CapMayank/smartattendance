"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Clock,
  Calendar as CalendarIcon,
  PlusCircle,
  RefreshCw,
  LogIn,
  LogOut,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Ban,
  FileText,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestPunchModal, PUNCH_REASONS } from "@/components/punches/RequestPunchModal";
import { formatDate, formatHHmm } from "@/lib/format";

export interface PunchItem {
  id: string;
  timestamp: string;
  type: "IN" | "OUT";
  dateKey: string;
  timeStr: string;
}

export interface PunchRequestItem {
  id: string;
  staffId: string;
  date: string;
  punchType: "IN" | "OUT" | "BOTH";
  requestedTime?: string | null;
  requestedInTime?: string | null;
  requestedOutTime?: string | null;
  reason: string;
  explanation?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  decisionRemarks?: string | null;
  decidedAt?: string | null;
  createdAt: string;
}

interface PunchRequestsClientProps {
  userRole: string;
  staffId?: string | null;
}

const REASON_MAP: Record<string, string> = {
  FORGOT_SWIPE: "Forgot to swipe card",
  DUTY_OUTSIDE: "Official outdoor school duty / sports event",
  DEVICE_OFFLINE: "Biometric device offline / card read error",
  POWER_FAILURE: "Campus power failure",
  OTHER: "Other reason",
};

export function PunchRequestsClient({ userRole, staffId }: PunchRequestsClientProps) {
  const [activeTab, setActiveTab] = useState<string>("history");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Punch history state
  const [punches, setPunches] = useState<PunchItem[]>([]);
  const [isLoadingPunches, setIsLoadingPunches] = useState(true);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Regularization requests state
  const [requests, setRequests] = useState<PunchRequestItem[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchPunches = useCallback(async () => {
    setIsLoadingPunches(true);
    try {
      const params = new URLSearchParams();
      if (staffId) params.set("staffId", staffId);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const url = `/api/employee/punches${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch punches");
      }

      setPunches(data.punches || []);
    } catch (err: unknown) {
      console.error("Error fetching punches:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load biometric punches");
    } finally {
      setIsLoadingPunches(false);
    }
  }, [staffId, fromDate, toDate]);

  const fetchRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    try {
      const params = new URLSearchParams();
      if (staffId) params.set("staffId", staffId);

      const url = `/api/punch-requests${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch punch requests");
      }

      setRequests(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.error("Error fetching punch requests:", err);
      toast.error(err instanceof Error ? err.message : "Failed to load regularization requests");
    } finally {
      setIsLoadingRequests(false);
    }
  }, [staffId]);

  useEffect(() => {
    fetchPunches();
  }, [fetchPunches]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleCancelRequest(requestId: string) {
    if (!confirm("Are you sure you want to cancel this punch regularization request?")) {
      return;
    }

    setCancellingId(requestId);
    try {
      const res = await fetch(`/api/punch-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel request");
      }

      toast.success("Request cancelled successfully.");
      await fetchRequests();
    } catch (err: unknown) {
      console.error("Error cancelling request:", err);
      toast.error(err instanceof Error ? err.message : "Failed to cancel request");
    } finally {
      setCancellingId(null);
    }
  }

  const tabs: TabItem[] = [
    { id: "history", label: "Punch History", count: punches.length },
    { id: "requests", label: "My Regularization Requests", count: requests.length },
  ];

  function renderStatusBadge(status: PunchRequestItem["status"]) {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-late/30 bg-late/10 px-2.5 py-0.5 text-xs font-medium text-late">
            <Clock size={12} aria-hidden="true" />
            Pending
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-present/30 bg-present/10 px-2.5 py-0.5 text-xs font-medium text-present">
            <CheckCircle2 size={12} aria-hidden="true" />
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-absent/30 bg-absent/10 px-2.5 py-0.5 text-xs font-medium text-absent">
            <XCircle size={12} aria-hidden="true" />
            Rejected
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card-hi px-2.5 py-0.5 text-xs font-medium text-muted">
            <Ban size={12} aria-hidden="true" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <PageHeader
        title="My Punches & Requests"
        subtitle="View your biometric attendance punch logs and request missed punch regularizations."
        actions={
          <Button
            variant="primary"
            icon={PlusCircle}
            onClick={() => setIsModalOpen(true)}
          >
            Request Missed Punch
          </Button>
        }
      />

      <Tabs tabs={tabs} value={activeTab} onChange={setActiveTab} />

      {activeTab === "history" && (
        <Card className="space-y-4">
          <CardHeader
            title="Biometric Punch Logs"
            caption="Sorted by newest timestamp. Raw records captured from school attendance devices."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                onClick={fetchPunches}
                loading={isLoadingPunches}
              >
                Refresh
              </Button>
            }
          />

          {/* Date range filter */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft bg-canvas p-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-subtle">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-lg border border-line bg-card px-2.5 py-1 text-xs text-text focus:border-acc-1 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-subtle">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-lg border border-line bg-card px-2.5 py-1 text-xs text-text focus:border-acc-1 focus:outline-none"
              />
            </div>
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                icon={RotateCcw}
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
              >
                Reset
              </Button>
            )}
            <span className="num ml-auto text-subtle">
              Showing {punches.length} {punches.length === 1 ? "record" : "records"}
            </span>
          </div>

          {isLoadingPunches ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="size-6 animate-spin text-subtle" />
            </div>
          ) : punches.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No biometric punches found"
              hint={
                fromDate || toDate
                  ? "No attendance punches found for the selected date range. Try clearing your date filter."
                  : "No attendance punches recorded yet for your account."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[12px] font-medium text-subtle">
                    <th className="py-2.5 pr-4">Date</th>
                    <th className="py-2.5 pr-4">Time</th>
                    <th className="py-2.5 pr-4">Type</th>
                    <th className="py-2.5 pr-4">Full Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft font-normal">
                  {punches.map((punch) => {
                    const isOut = punch.type === "OUT";
                    return (
                      <tr key={punch.id} className="transition-colors hover:bg-card-hi/40">
                        <td className="py-3 pr-4 font-medium text-text">
                          {formatDate(new Date(`${punch.dateKey}T12:00:00Z`))}
                        </td>
                        <td className="num py-3 pr-4 font-medium text-text">
                          {punch.timeStr}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              isOut
                                ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                                : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {isOut ? (
                              <LogOut size={11} aria-hidden="true" />
                            ) : (
                              <LogIn size={11} aria-hidden="true" />
                            )}
                            {isOut ? "Check-Out" : "Check-In"}
                          </span>
                        </td>
                        <td className="num py-3 pr-4 text-xs text-subtle">
                          {punch.timestamp}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === "requests" && (
        <Card className="space-y-4">
          <CardHeader
            title="My Regularization Requests"
            caption="Track the status of your missed punch requests and submit regularizations."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                onClick={fetchRequests}
                loading={isLoadingRequests}
              >
                Refresh
              </Button>
            }
          />

          {isLoadingRequests ? (
            <div className="flex h-48 items-center justify-center">
              <RefreshCw className="size-6 animate-spin text-subtle" />
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No regularization requests"
              hint="You have not submitted any missed punch regularization requests. Click '+ Request Missed Punch' above to submit one."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[12px] font-medium text-subtle">
                    <th className="py-2.5 pr-4">Date</th>
                    <th className="py-2.5 pr-4">Type</th>
                    <th className="py-2.5 pr-4">Requested Time(s)</th>
                    <th className="py-2.5 pr-4">Reason & Explanation</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4">Approver Remarks</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft font-normal">
                  {requests.map((req) => {
                    const isPending = req.status === "PENDING";
                    const isBoth = req.punchType === "BOTH";
                    const isIn = req.punchType === "IN";
                    const isOut = req.punchType === "OUT";

                    const requestedTimesDisplay = isBoth
                      ? `In: ${formatHHmm(req.requestedInTime || "")} · Out: ${formatHHmm(req.requestedOutTime || "")}`
                      : isIn
                      ? `In: ${formatHHmm(req.requestedTime || req.requestedInTime || "")}`
                      : `Out: ${formatHHmm(req.requestedTime || req.requestedOutTime || "")}`;

                    return (
                      <tr key={req.id} className="transition-colors hover:bg-card-hi/40">
                        <td className="py-3 pr-4 font-medium text-text">
                          {formatDate(new Date(`${req.date}T12:00:00Z`))}
                        </td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-md border border-line bg-card-hi px-2 py-0.5 text-xs text-text">
                            {isBoth ? "Both In & Out" : isIn ? "Check-In" : "Check-Out"}
                          </span>
                        </td>
                        <td className="num py-3 pr-4 text-xs font-medium text-text">
                          {requestedTimesDisplay}
                        </td>
                        <td className="max-w-xs py-3 pr-4">
                          <div className="text-xs font-medium text-text">
                            {REASON_MAP[req.reason] || req.reason}
                          </div>
                          {req.explanation && (
                            <p className="mt-0.5 line-clamp-2 text-[11px] text-subtle">
                              {req.explanation}
                            </p>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          {renderStatusBadge(req.status)}
                        </td>
                        <td className="max-w-xs py-3 pr-4 text-xs text-subtle">
                          {req.decisionRemarks ? (
                            <span className="italic text-text/80">{req.decisionRemarks}</span>
                          ) : (
                            <span className="text-muted/60">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          {isPending ? (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleCancelRequest(req.id)}
                              loading={cancellingId === req.id}
                            >
                              Cancel
                            </Button>
                          ) : (
                            <span className="text-xs text-muted/50">—</span>
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
      )}

      <RequestPunchModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchRequests();
          fetchPunches();
        }}
      />
    </div>
  );
}
