'use client';

import React, { useState } from 'react';
import { Download, Lock, ShieldCheck } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { MarkExitDialog } from './MarkExitDialog';
import { MemberIdentity, Note, ReadyBadge, SelectionBar, useSelection, type EpfoTabProps } from './epfo-shared';
import { splitReadiness } from './use-epfo-members';
import { formatEpfoDate } from '@/lib/epfo/mappings';

const lastDay = (m: { employmentPeriods?: any[]; joiningDate?: string | null }) =>
  m.employmentPeriods?.find((p) => p.endDate)?.endDate || m.joiningDate || '';

export function EpfoExitTab({ epfo, onFixMember, initialSelectedIds = [] }: EpfoTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const sel = useSelection(initialSelectedIds);
  const list = epfo.members.filter((m) => m.nextAction === 'NEEDS_EXIT');
  const { ready, skipped } = splitReadiness(list.filter((m) => sel.has(m.id)));

  return (
    <div>
      <Note>
        <b>Exit (bulk).</b> Confirm the exit reason for each leaver, then upload the file on the EPFO exit page. The
        exit date cannot be earlier than the EPF joining date, and a 12-digit UAN is required.
      </Note>

      {list.length === 0 ? (
        <div className="py-12">
          <EmptyState icon={ShieldCheck} title={epfo.loading ? 'Loading…' : 'No exits are due'} hint="Staff whose last working day is set appear here." />
        </div>
      ) : (
        <ul className="px-4 py-2">
          {list.map((m) => (
            <li key={m.id} className="grid grid-cols-1 items-center gap-3 border-b border-line-soft py-3.5 last:border-0 md:grid-cols-[24px_1.2fr_1fr_1fr_auto]">
              <input
                type="checkbox"
                aria-label={`Select ${m.name}`}
                checked={sel.has(m.id)}
                onChange={() => sel.toggle(m.id)}
                className="size-4 rounded border-line accent-accent"
              />
              <MemberIdentity member={m} />
              <span className="font-mono text-xs text-text">{m.payrollInfo?.uan || '—'}</span>
              <div>
                <div className="text-[11px] text-subtle">Last working day</div>
                <div className="text-sm text-text">{formatEpfoDate(lastDay(m)) || '—'}</div>
                {m.exitMonthPayrollLocked && (
                  <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-late">
                    <Lock size={11} aria-hidden="true" /> Payroll locked for this month
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                {m.readiness.ready ? (
                  <ReadyBadge member={m} />
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => onFixMember(m.id, 'statutory', m.readiness.errors.map((e) => e.field))}>
                    Fix details
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <SelectionBar selected={sel.ids.length} ready={ready.length} skipped={skipped.length}>
        <Button icon={Download} disabled={ready.length === 0} onClick={() => setDialogOpen(true)}>
          Mark exit &amp; download file
        </Button>
      </SelectionBar>

      <MarkExitDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={async (codes) => {
          if (await epfo.exportFile('exit', ready.map((m) => m.id), codes)) {
            setDialogOpen(false);
            sel.clear();
          }
        }}
        onOpenProfile={(id) => onFixMember(id, 'statutory', [])}
        members={ready.map((m) => ({
          id: m.id,
          name: m.name,
          uan: m.payrollInfo?.uan,
          lastWorkingDay: lastDay(m),
          defaultExitCode: m.defaultExitCode || 'C',
          exitMonthPayrollLocked: Boolean(m.exitMonthPayrollLocked),
        }))}
        loading={epfo.busy}
      />
    </div>
  );
}
