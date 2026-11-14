'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, X } from 'lucide-react';
import { Avatar, Button, Modal } from '@/components/ui';
import type { EpfoMemberRow, EpfoMembersApi } from './use-epfo-members';

export interface EpfoTabProps {
  epfo: EpfoMembersApi;
  onFixMember: (staffId: string, tab: 'statutory' | 'kyc', fields: string[]) => void;
  initialSelectedIds?: string[];
}

/** "Mark as already filed" button + confirmation, shared by the registration, KYC and exit tabs. */
export function MarkFiledControl({
  epfo,
  selectedIds,
  target,
  onDone,
}: {
  epfo: EpfoMembersApi;
  selectedIds: string[];
  target: 'REG' | 'EXIT' | 'KYC';
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" disabled={selectedIds.length === 0} onClick={() => setOpen(true)}>
        Mark as already filed
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Mark selected as already filed on EPFO"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={epfo.busy}>Cancel</Button>
            <Button
              loading={epfo.busy}
              onClick={async () => {
                if (await epfo.markFiled(selectedIds, target)) {
                  setOpen(false);
                  onDone();
                }
              }}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-xs text-text">
          Records that the selected {selectedIds.length} people were already submitted on the EPFO portal outside this
          app. They leave the pending list without a file being generated.
        </p>
      </Modal>
    </>
  );
}

export const STATUS_LABEL: Record<string, string> = {
  NEEDS_REGISTRATION: 'To register',
  AWAITING_UAN: 'Awaiting UAN',
  NEEDS_EXIT: 'Exit due',
  NEEDS_KYC: 'KYC pending',
  UP_TO_DATE: 'Up to date',
  HIDDEN: 'Hidden',
};

export function useSelection(initial: string[] = []) {
  const [ids, setIds] = useState<string[]>(initial);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id])),
    setAll: (all: string[]) => setIds(all),
    clear: () => setIds([]),
  };
}

export function MemberIdentity({ member }: { member: EpfoMemberRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={member.name} size={28} />
      <div className="min-w-0">
        <div className="truncate font-medium text-text">{member.name}</div>
        <div className="truncate text-xs text-subtle">
          {member.employeeCode || `Machine #${member.machineId}`}
          {member.designation?.name ? ` · ${member.designation.name}` : ''}
        </div>
      </div>
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-4 mt-4 rounded-xl border border-accent/25 bg-accent/10 px-3.5 py-2.5 text-[13px] text-text">
      {children}
    </div>
  );
}

export function SelectionBar({
  selected,
  ready,
  skipped,
  children,
}: {
  selected: number;
  ready: number;
  skipped: number;
  children: React.ReactNode;
}) {
  if (selected === 0) return null;
  return (
    <div className="sticky bottom-3 mx-4 mb-4 mt-2 flex flex-col items-center justify-between gap-3 rounded-2xl border border-line bg-card-hi px-4 py-3 shadow-lg sm:flex-row">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="font-medium text-text">{selected} selected</span>
        <span className="text-subtle">·</span>
        <span className="font-medium text-present">{ready} ready</span>
        {skipped > 0 && (
          <>
            <span className="text-subtle">·</span>
            <span className="font-medium text-late">{skipped} skipped</span>
          </>
        )}
      </div>
      {children}
    </div>
  );
}

export function ReadyBadge({ member }: { member: EpfoMemberRow }) {
  return member.readiness.ready ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-present">
      <CheckCircle2 size={14} aria-hidden="true" /> Ready
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-late">
      <AlertTriangle size={14} aria-hidden="true" /> {member.readiness.errors.length} missing
    </span>
  );
}

/** Export result (undo) and error banners, shown once at the top of the page. */
export function EpfoFeedback({ epfo }: { epfo: EpfoMembersApi }) {
  const label = epfo.undo?.type === 'REG' ? 'registration' : epfo.undo?.type === 'EXIT' ? 'exit' : 'KYC';
  return (
    <>
      {epfo.error && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-absent/30 bg-absent/10 px-3.5 py-2.5 text-[13px] text-absent">
          <span>{epfo.error}</span>
          <button type="button" aria-label="Dismiss error" onClick={epfo.clearError}>
            <X size={14} />
          </button>
        </div>
      )}
      {epfo.undo && (
        <div className="flex items-center justify-between rounded-xl border border-present/30 bg-present/10 px-3.5 py-2.5 text-[13px] text-present">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} aria-hidden="true" />
            Exported {epfo.undo.count} {label} records. Timestamps recorded on the staff profile.
          </span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={epfo.runUndo} loading={epfo.busy}>
              Undo
            </Button>
            <button type="button" aria-label="Dismiss" onClick={epfo.dismissUndo}>
              <X size={14} />
            </button>
          </span>
        </div>
      )}
    </>
  );
}
