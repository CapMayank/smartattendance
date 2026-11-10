"use client";

import { useEffect, useState, useId } from "react";
import { toast } from "sonner";
import { AlertCircle, Clock, Calendar as CalendarIcon } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export type PunchType = "IN" | "OUT" | "BOTH";

export const PUNCH_REASONS = [
  { value: "FORGOT_SWIPE", label: "Forgot to mark attendance / Missed terminal check" },
  { value: "DUTY_OUTSIDE", label: "Official on-duty assignment / Off-campus school duty" },
  { value: "DEVICE_OFFLINE", label: "Attendance terminal offline / Recognition error" },
  { value: "POWER_FAILURE", label: "Campus power outage / Terminal unavailable" },
  { value: "OTHER", label: "Other reason (specify details below)" },
] as const;

export interface RequestPunchModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefillDate?: string;
  prefillPunchType?: PunchType;
  prefillTime?: string;
  staffId?: string;
}

export function RequestPunchModal({
  open,
  onClose,
  onSuccess,
  prefillDate,
  prefillPunchType,
  prefillTime,
  staffId,
}: RequestPunchModalProps) {
  const initialType = prefillPunchType || "BOTH";
  const [date, setDate] = useState(prefillDate || "");
  const [punchType, setPunchType] = useState<PunchType>(initialType);
  const [requestedTime, setRequestedTime] = useState(
    prefillTime || (initialType === "OUT" ? "16:30" : "09:00")
  );
  const [requestedInTime, setRequestedInTime] = useState(
    initialType === "IN" && prefillTime ? prefillTime : "09:00"
  );
  const [requestedOutTime, setRequestedOutTime] = useState(
    initialType === "OUT" && prefillTime ? prefillTime : "16:30"
  );
  const [reason, setReason] = useState<string>("FORGOT_SWIPE");
  const [explanation, setExplanation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dateId = useId();
  const typeId = useId();
  const timeId = useId();
  const inTimeId = useId();
  const outTimeId = useId();
  const reasonId = useId();
  const explanationId = useId();

  useEffect(() => {
    if (open) {
      setDate(prefillDate || "");
      const resolvedType = prefillPunchType || "BOTH";
      setPunchType(resolvedType);
      setRequestedTime(prefillTime || (resolvedType === "OUT" ? "16:30" : "09:00"));
      setRequestedInTime(resolvedType === "IN" && prefillTime ? prefillTime : "09:00");
      setRequestedOutTime(resolvedType === "OUT" && prefillTime ? prefillTime : "16:30");
      setReason("FORGOT_SWIPE");
      setExplanation("");
      setErrorMessage(null);
    }
  }, [open, prefillDate, prefillPunchType, prefillTime]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!date) {
      setErrorMessage("Please select a date.");
      return;
    }

    if (reason === "OTHER" && !explanation.trim()) {
      setErrorMessage("Explanation is required when 'Other reason' is selected.");
      return;
    }

    if (punchType === "IN" || punchType === "OUT") {
      if (!requestedTime) {
        setErrorMessage("Requested time is required.");
        return;
      }
    } else if (punchType === "BOTH") {
      if (!requestedInTime || !requestedOutTime) {
        setErrorMessage("Both check-in and check-out times are required.");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        date,
        punchType,
        requestedTime: punchType === "BOTH" ? undefined : requestedTime,
        requestedInTime: punchType === "BOTH" ? requestedInTime : undefined,
        requestedOutTime: punchType === "BOTH" ? requestedOutTime : undefined,
        reason,
        explanation: explanation.trim() || undefined,
      };

      if (staffId) {
        payload.staffId = staffId;
      }

      const res = await fetch("/api/punch-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorText = data.error || "Failed to submit punch request";
        setErrorMessage(errorText);
        toast.error(errorText);
        return;
      }

      toast.success("Missed punch request submitted successfully.");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error("Failed to submit punch request:", err);
      const msg = "Network error. Please try again later.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request Missed Punch"
      subtitle="Submit biometric attendance regularization for administrative review"
      size="lg"
      footer={
        <div className="flex w-full items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="request-punch-form"
            variant="primary"
            loading={isSubmitting}
          >
            Submit Request
          </Button>
        </div>
      }
    >
      <form id="request-punch-form" onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-absent/30 bg-absent/10 p-3 text-xs text-absent"
          >
            <AlertCircle size={16} className="shrink-0 text-absent" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div>
          <label htmlFor={dateId} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarIcon size={14} className="text-subtle" aria-hidden="true" />
            Date <span className="text-absent">*</span>
          </label>
          <input
            id={dateId}
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-text transition-colors placeholder:text-subtle focus:border-acc-1 focus:outline-none focus:ring-1 focus:ring-acc-1"
          />
        </div>

        <div>
          <label htmlFor={typeId} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
            <Clock size={14} className="text-subtle" aria-hidden="true" />
            Punch Type <span className="text-absent">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "IN", label: "Check-In" },
              { value: "OUT", label: "Check-Out" },
              { value: "BOTH", label: "Both In & Out" },
            ].map((option) => {
              const selected = punchType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPunchType(option.value as PunchType)}
                  className={`flex h-9 items-center justify-center rounded-[10px] border text-xs font-medium transition-colors ${
                    selected
                      ? "border-acc-1 bg-acc-1/10 text-acc-1"
                      : "border-line bg-canvas text-muted hover:border-subtle hover:text-text"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {punchType === "BOTH" ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={inTimeId} className="mb-1.5 block text-xs font-medium text-muted">
                Requested Check-In <span className="text-absent">*</span>
              </label>
              <input
                id={inTimeId}
                type="time"
                required
                value={requestedInTime}
                onChange={(e) => setRequestedInTime(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-text transition-colors placeholder:text-subtle focus:border-acc-1 focus:outline-none focus:ring-1 focus:ring-acc-1"
              />
            </div>
            <div>
              <label htmlFor={outTimeId} className="mb-1.5 block text-xs font-medium text-muted">
                Requested Check-Out <span className="text-absent">*</span>
              </label>
              <input
                id={outTimeId}
                type="time"
                required
                value={requestedOutTime}
                onChange={(e) => setRequestedOutTime(e.target.value)}
                className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-text transition-colors placeholder:text-subtle focus:border-acc-1 focus:outline-none focus:ring-1 focus:ring-acc-1"
              />
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor={timeId} className="mb-1.5 block text-xs font-medium text-muted">
              Requested Time ({punchType === "IN" ? "Check-In" : "Check-Out"}) <span className="text-absent">*</span>
            </label>
            <input
              id={timeId}
              type="time"
              required
              value={requestedTime}
              onChange={(e) => setRequestedTime(e.target.value)}
              className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-text transition-colors placeholder:text-subtle focus:border-acc-1 focus:outline-none focus:ring-1 focus:ring-acc-1"
            />
          </div>
        )}

        <div>
          <label htmlFor={reasonId} className="mb-1.5 block text-xs font-medium text-muted">
            Reason <span className="text-absent">*</span>
          </label>
          <select
            id={reasonId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-text transition-colors focus:border-acc-1 focus:outline-none focus:ring-1 focus:ring-acc-1"
          >
            {PUNCH_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={explanationId} className="mb-1.5 block text-xs font-medium text-muted">
            Explanation {reason === "OTHER" ? <span className="text-absent">*</span> : <span className="text-subtle">(optional)</span>}
          </label>
          <textarea
            id={explanationId}
            rows={3}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder={
              reason === "OTHER"
                ? "Please describe the circumstances for this missed punch..."
                : "Additional context for your approver (optional)..."
            }
            className="w-full resize-none rounded-[10px] border border-line bg-canvas px-3 py-2 text-sm text-text transition-colors placeholder:text-subtle focus:border-acc-1 focus:outline-none focus:ring-1 focus:ring-acc-1"
          />
        </div>
      </form>
    </Modal>
  );
}
