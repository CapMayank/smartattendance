'use client';

import React, { useState } from 'react';
import { Check, Download, ShieldCheck, Wrench, X } from 'lucide-react';
import { Button, EmptyState } from '@/components/ui';
import { ExportSummaryDialog } from './ExportSummaryDialog';
import { MarkFiledControl, MemberIdentity, Note, SelectionBar, useSelection, type EpfoTabProps } from './epfo-shared';
import { splitReadiness } from './use-epfo-members';
import { validateForKyc } from '@/lib/epfo/validation';

const DOC_LABEL: Record<string, string> = { P: 'PAN', A: 'Aadhaar' };

export function EpfoKycTab({ epfo, onFixMember, initialSelectedIds = [] }: EpfoTabProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const sel = useSelection(initialSelectedIds);
  const list = epfo.members.filter((m) => m.nextAction === 'NEEDS_KYC');
  const selected = list.filter((m) => sel.has(m.id));
  const { ready, skipped } = splitReadiness(selected);

  const docsFor = (m: (typeof list)[number]) => validateForKyc(m as any, ['P', 'A']);
  const lineCount = ready.reduce((n, m) => n + docsFor(m).validDocs.length, 0);

  return (
    <div>
      <div className="flex justify-end border-b border-line-soft px-4 py-3">
        <MarkFiledControl epfo={epfo} selectedIds={sel.ids} target="KYC" onDone={sel.clear} />
      </div>
      <Note>
        <b>KYC seeding.</b> Aadhaar and PAN only. Bank KYC is not accepted from employers; ask the member to seed it on
        the EPFO member portal. Each person needs a UAN first.
      </Note>

      {list.length === 0 ? (
        <div className="py-12">
          <EmptyState icon={ShieldCheck} title={epfo.loading ? 'Loading…' : 'No KYC is pending'} hint="People appear here once their UAN is saved." />
        </div>
      ) : (
        <ul className="px-4 py-2">
          {list.map((m) => {
            const kyc = docsFor(m);
            return (
              <li key={m.id} className="grid grid-cols-1 items-center gap-3 border-b border-line-soft py-3.5 last:border-0 md:grid-cols-[24px_1.2fr_1fr_1.4fr_auto]">
                <input
                  type="checkbox"
                  aria-label={`Select ${m.name}`}
                  checked={sel.has(m.id)}
                  onChange={() => sel.toggle(m.id)}
                  className="size-4 rounded border-line accent-accent"
                />
                <MemberIdentity member={m} />
                <span className="font-mono text-xs text-text">{m.payrollInfo?.uan || '—'}</span>
                <div className="flex flex-wrap gap-1.5">
                  {(['A', 'P'] as const).map((d) => {
                    const ok = kyc.validDocs.includes(d);
                    const reason = kyc.skippedDocs.find((s) => s.docType === d)?.reason;
                    return (
                      <span
                        key={d}
                        title={reason}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] ${
                          ok ? 'border-present/30 bg-present/10 text-present' : 'border-absent/30 bg-absent/10 text-absent'
                        }`}
                      >
                        {ok ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />}
                        {DOC_LABEL[d]}
                      </span>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  {kyc.ready ? (
                    <span className="text-xs font-medium text-present">Ready ({kyc.validDocs.length} doc{kyc.validDocs.length === 1 ? '' : 's'})</span>
                  ) : (
                    <Button size="sm" variant="secondary" icon={Wrench} onClick={() => onFixMember(m.id, 'kyc', m.readiness.errors.map((e) => e.field))}>
                      Fix details
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SelectionBar selected={sel.ids.length} ready={ready.length} skipped={skipped.length}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-subtle">{lineCount} KYC lines will be generated</span>
          <Button icon={Download} disabled={ready.length === 0} onClick={() => setExportOpen(true)}>
            Download KYC file
          </Button>
        </div>
      </SelectionBar>

      <ExportSummaryDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onConfirm={async () => {
          if (await epfo.exportFile('kyc', ready.map((m) => m.id))) {
            setExportOpen(false);
            sel.clear();
          }
        }}
        exportType="kyc"
        readyMembers={ready.map((m) => ({ id: m.id, name: m.name, uan: m.payrollInfo?.uan }))}
        skippedMembers={skipped}
        loading={epfo.busy}
      />
    </div>
  );
}
