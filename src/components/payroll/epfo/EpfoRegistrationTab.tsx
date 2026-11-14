'use client';

import React, { useMemo, useState } from 'react';
import { Download, RotateCcw, Search, ShieldCheck, Wrench } from 'lucide-react';
import { Button, Chip, ChipGroup, EmptyState, Input, Modal } from '@/components/ui';
import { ExportSummaryDialog } from './ExportSummaryDialog';
import { MemberChecklist } from './MemberChecklist';
import { MemberIdentity, Note, ReadyBadge, SelectionBar, useSelection, type EpfoTabProps } from './epfo-shared';
import { isValidUan, splitReadiness } from './use-epfo-members';

type Filter = 'NEEDS_REGISTRATION' | 'AWAITING_UAN';

export function EpfoRegistrationTab({
  epfo,
  onFixMember,
  initialSelectedIds = [],
  initialFilter = 'NEEDS_REGISTRATION',
}: EpfoTabProps & { initialFilter?: Filter }) {
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState('');
  const [uanDrafts, setUanDrafts] = useState<Record<string, string>>({});
  const [exportOpen, setExportOpen] = useState(false);
  const [filedOpen, setFiledOpen] = useState(false);
  const sel = useSelection(initialSelectedIds);

  const toRegister = epfo.members.filter((m) => m.nextAction === 'NEEDS_REGISTRATION');
  const awaiting = epfo.members.filter((m) => m.nextAction === 'AWAITING_UAN');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (filter === 'NEEDS_REGISTRATION' ? toRegister : awaiting).filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.machineId.toLowerCase().includes(q) ||
        (m.employeeCode || '').toLowerCase().includes(q) ||
        (m.payrollInfo?.uan || '').includes(q)
    );
  }, [filter, search, toRegister, awaiting]);

  const selected = epfo.members.filter((m) => sel.has(m.id));
  const { ready, skipped } = splitReadiness(selected);

  const switchFilter = (f: Filter) => {
    setFilter(f);
    sel.clear();
  };

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line-soft px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <ChipGroup label="Registration steps">
          <Chip pressed={filter === 'NEEDS_REGISTRATION'} onClick={() => switchFilter('NEEDS_REGISTRATION')} dot="accent" count={toRegister.length}>
            To register
          </Chip>
          <Chip pressed={filter === 'AWAITING_UAN'} onClick={() => switchFilter('AWAITING_UAN')} count={awaiting.length}>
            Awaiting UAN
          </Chip>
        </ChipGroup>
        <div className="flex items-center gap-2">
          <div className="relative w-full lg:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
            <Input aria-label="Search joinees" placeholder="Search name, code, UAN" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button size="sm" variant="secondary" disabled={sel.ids.length === 0} onClick={() => setFiledOpen(true)}>
            Mark as already filed
          </Button>
        </div>
      </div>

      {filter === 'NEEDS_REGISTRATION' ? (
        <Note>
          <b>Step 1.</b> Tick the people who are ready, download the registration file and upload it on the EPFO bulk
          registration page. They then move to <b>Awaiting UAN</b>.
        </Note>
      ) : (
        <Note>
          <b>Step 2.</b> Once EPFO issues the UAN, enter the 12-digit number here. The person then moves to KYC.
        </Note>
      )}

      {visible.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={ShieldCheck}
            title={epfo.loading ? 'Loading…' : filter === 'NEEDS_REGISTRATION' ? 'No one is waiting to be registered' : 'No one is waiting for a UAN'}
            hint="New joinees appear here automatically."
          />
        </div>
      ) : (
        <ul className="px-4 py-2">
          {visible.map((m) => {
            const draft = uanDrafts[m.id] ?? m.payrollInfo?.uan ?? '';
            return (
              <li key={m.id} className="grid grid-cols-1 items-center gap-3 border-b border-line-soft py-3.5 last:border-0 md:grid-cols-[24px_1.2fr_2fr_auto]">
                {filter === 'NEEDS_REGISTRATION' ? (
                  <input
                    type="checkbox"
                    aria-label={`Select ${m.name}`}
                    checked={sel.has(m.id)}
                    onChange={() => sel.toggle(m.id)}
                    className="size-4 rounded border-line accent-accent"
                  />
                ) : (
                  <span />
                )}
                <MemberIdentity member={m} />
                {filter === 'NEEDS_REGISTRATION' ? (
                  <MemberChecklist errors={m.readiness.errors} />
                ) : (
                  <div className="flex max-w-sm items-center gap-2">
                    <Input
                      value={draft}
                      inputMode="numeric"
                      placeholder="12-digit UAN"
                      aria-label={`UAN for ${m.name}`}
                      onChange={(e) => setUanDrafts({ ...uanDrafts, [m.id]: e.target.value })}
                      className="h-8 font-mono text-xs"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      data-testid="save-uan"
                      loading={epfo.savingUanId === m.id}
                      disabled={!isValidUan(draft)}
                      onClick={async () => {
                        if (await epfo.saveUan(m.id, draft)) setUanDrafts((p) => ({ ...p, [m.id]: '' }));
                      }}
                    >
                      Save UAN
                    </Button>
                  </div>
                )}
                <div className="flex items-center justify-end gap-2">
                  {filter === 'NEEDS_REGISTRATION' &&
                    (m.readiness.ready ? (
                      <ReadyBadge member={m} />
                    ) : (
                      <Button size="sm" variant="secondary" icon={Wrench} onClick={() => onFixMember(m.id, 'statutory', m.readiness.errors.map((e) => e.field))}>
                        Fix details
                      </Button>
                    ))}
                  {filter === 'AWAITING_UAN' && (
                    <Button size="sm" variant="ghost" icon={RotateCcw} loading={epfo.resettingId === m.id} onClick={() => epfo.resetToPending(m)}>
                      Reset to pending
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SelectionBar selected={sel.ids.length} ready={ready.length} skipped={skipped.length}>
        <Button icon={Download} disabled={ready.length === 0} onClick={() => setExportOpen(true)}>
          Download registration file
        </Button>
      </SelectionBar>

      <ExportSummaryDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onConfirm={async () => {
          if (await epfo.exportFile('reg', ready.map((m) => m.id))) {
            setExportOpen(false);
            sel.clear();
          }
        }}
        exportType="reg"
        readyMembers={ready.map((m) => ({ id: m.id, name: m.name, uan: m.payrollInfo?.uan }))}
        skippedMembers={skipped}
        loading={epfo.busy}
      />

      <Modal
        open={filedOpen}
        onClose={() => setFiledOpen(false)}
        title="Mark selected as already filed on EPFO"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setFiledOpen(false)} disabled={epfo.busy}>Cancel</Button>
            <Button
              loading={epfo.busy}
              onClick={async () => {
                if (await epfo.markFiled(sel.ids, 'REG')) {
                  setFiledOpen(false);
                  sel.clear();
                }
              }}
            >
              Confirm
            </Button>
          </div>
        }
      >
        <p className="text-xs text-text">
          Records that the selected {sel.ids.length} people were already submitted on the EPFO portal outside this app.
          They leave the pending list without a file being generated.
        </p>
      </Modal>
    </div>
  );
}
