'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, Info } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

export type ExportType = 'reg' | 'exit' | 'kyc';

export interface ReadyMemberItem {
  id: string;
  name: string;
  uan?: string | null;
}

export interface SkippedMemberItem {
  id: string;
  name: string;
  reasons: string[];
}

interface ExportSummaryDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  exportType: ExportType;
  readyMembers: ReadyMemberItem[];
  skippedMembers: SkippedMemberItem[];
  loading?: boolean;
}

export function ExportSummaryDialog({
  open,
  onClose,
  onConfirm,
  exportType,
  readyMembers,
  skippedMembers,
  loading = false,
}: ExportSummaryDialogProps) {
  const titles: Record<ExportType, string> = {
    reg: 'Export New Member Registration Bulk File',
    exit: 'Export Mark Exit Bulk File',
    kyc: 'Export KYC Seed Bulk File',
  };

  const fileLabels: Record<ExportType, string> = {
    reg: '30-column registration (#~#)',
    exit: '3-column exit (#~#)',
    kyc: '5-column KYC seed (#~#)',
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titles[exportType]}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={Download}
            onClick={onConfirm}
            loading={loading}
            disabled={readyMembers.length === 0}
          >
            Download {readyMembers.length} {readyMembers.length === 1 ? 'Record' : 'Records'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Summary Badges */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-canvas p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text">
                {readyMembers.length} ready for export
              </p>
              <p className="text-xs text-subtle">
                Will be included in the {fileLabels[exportType]} file
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-canvas p-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-text">
                {skippedMembers.length} skipped
              </p>
              <p className="text-xs text-subtle">
                Missing required fields; will not be written
              </p>
            </div>
          </div>
        </div>

        {/* EPFO Portal Pre-upload Verification Notice */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-text">
          <Info size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-300">
              EPFO Portal Verification Notice
            </p>
            <p className="text-subtle leading-relaxed">
              EPFO periodically updates its bulk upload templates on the Unified Employer Portal. Before submitting your first upload, compare this generated file against the active sample template on the portal to verify column headers and delimiters.
            </p>
          </div>
        </div>

        {/* Skipped Details List if any */}
        {skippedMembers.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Skipped Members &amp; Missing Fields
            </h4>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-line-soft bg-canvas p-3">
              {skippedMembers.map((m) => (
                <div key={m.id} className="flex flex-col gap-1 border-b border-line-soft pb-2 last:border-b-0 last:pb-0">
                  <span className="text-[12.5px] font-medium text-text">{m.name}</span>
                  <div className="flex flex-wrap gap-1">
                    {m.reasons.map((r, idx) => (
                      <span
                        key={idx}
                        className="rounded px-1.5 py-0.5 text-[10.5px] font-medium bg-absent/10 text-absent"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
