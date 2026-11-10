'use client';

import React, { useState } from 'react';
import { AlertTriangle, Download, Lock } from 'lucide-react';
import { Button, Field, Modal, Select } from '@/components/ui';
import { formatEpfoDate, parseIsoDateKey } from '@/lib/epfo/mappings';
import type { EpfoExitReasonCode } from '@/lib/epfo/types';

export interface ExitMemberItem {
  id: string;
  name: string;
  uan?: string | null;
  lastWorkingDay: string;
  defaultExitCode: EpfoExitReasonCode;
  exitMonthPayrollLocked: boolean;
}

interface MarkExitDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (exitCodes: Record<string, EpfoExitReasonCode>) => void;
  members: ExitMemberItem[];
  loading?: boolean;
}

export function MarkExitDialog({
  open,
  onClose,
  onConfirm,
  members,
  loading = false,
}: MarkExitDialogProps) {
  const [exitCodes, setExitCodes] = useState<Record<string, EpfoExitReasonCode>>(() => {
    const initial: Record<string, EpfoExitReasonCode> = {};
    for (const m of members) {
      initial[m.id] = m.defaultExitCode || 'C';
    }
    return initial;
  });

  const handleCodeChange = (staffId: string, code: EpfoExitReasonCode) => {
    setExitCodes((prev) => ({ ...prev, [staffId]: code }));
  };

  const handleConfirm = () => {
    onConfirm(exitCodes);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark Exit for EPF Leavers"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Download}
            onClick={handleConfirm}
            loading={loading}
            disabled={members.length === 0}
          >
            Confirm &amp; Export Exit File
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-subtle">
          Verify EPFO exit reason codes for each departing staff member before generating the bulk 3-column `#~#` file. Last working day cannot be edited here (use Staff Profile &rarr; Record Exit if dates need adjustment).
        </p>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {members.map((member) => {
            const formattedDate = formatEpfoDate(member.lastWorkingDay);
            const dateIso = parseIsoDateKey(member.lastWorkingDay);
            const exitMonthYear = dateIso
              ? `${dateIso.slice(5, 7)}/${dateIso.slice(0, 4)}`
              : '';

            return (
              <div
                key={member.id}
                className="rounded-xl border border-line-soft bg-canvas p-3.5 space-y-3"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-sm font-semibold text-text">{member.name}</span>
                    <span className="ml-2 text-xs text-subtle">
                      UAN: {member.uan || 'Missing'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-subtle">
                    <span className="font-medium text-text">Last Working Day:</span>
                    <span className="font-mono text-text">{formattedDate}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-end">
                  <Field label="EPFO Exit Reason Code" htmlFor={`exit-code-${member.id}`}>
                    <Select
                      id={`exit-code-${member.id}`}
                      value={exitCodes[member.id] || member.defaultExitCode || 'C'}
                      onChange={(e) =>
                        handleCodeChange(member.id, e.target.value as EpfoExitReasonCode)
                      }
                    >
                      <option value="C">Cessation (Short service)</option>
                      <option value="S">Superannuation (Age &gt;= 58)</option>
                      <option value="R">Retirement (Age &lt; 58)</option>
                      <option value="D">Death in service</option>
                      <option value="A">Death away from service</option>
                      <option value="P">Permanent disablement</option>
                    </Select>
                  </Field>

                  {!member.exitMonthPayrollLocked && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-400">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <span>
                        Warning: Payroll for exit month ({exitMonthYear}) is not yet locked. EPFO requires final ECR to be processed before exit mark.
                      </span>
                    </div>
                  )}

                  {member.exitMonthPayrollLocked && (
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <Lock size={12} />
                      <span>Exit month payroll locked (ECR ready)</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
