'use client';

import React, { useMemo, useState } from 'react';
import { RotateCcw, Search, ShieldCheck } from 'lucide-react';
import { Button, EmptyState, Input } from '@/components/ui';
import { MemberIdentity, STATUS_LABEL, type EpfoTabProps } from './epfo-shared';
import { formatEpfoDate } from '@/lib/epfo/mappings';

export function EpfoAllMembersTab({ epfo, onFixMember }: EpfoTabProps) {
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return epfo.members.filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.machineId.toLowerCase().includes(q) ||
        (m.employeeCode || '').toLowerCase().includes(q) ||
        (m.payrollInfo?.uan || '').includes(q)
    );
  }, [epfo.members, search]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div className="relative w-full sm:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
          <Input aria-label="Search members" placeholder="Search name, code, UAN" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <span className="text-xs text-subtle">{list.length} members</span>
      </div>

      {list.length === 0 ? (
        <div className="py-12">
          <EmptyState icon={ShieldCheck} title={epfo.loading ? 'Loading…' : 'No members found'} hint="Try a different search." />
        </div>
      ) : (
        <ul className="px-4 py-2">
          {list.map((m) => {
            const period = m.employmentPeriods?.[0];
            const filedOn = period?.epfoJoinExportedAt ? formatEpfoDate(period.epfoJoinExportedAt) : '—';
            const canReset = Boolean(
              period?.epfoJoinExportedAt || period?.epfoExitExportedAt || m.payrollInfo?.epfoKycExportedAt
            );
            return (
              <li key={m.id} className="grid grid-cols-1 items-center gap-3 border-b border-line-soft py-3.5 last:border-0 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
                <MemberIdentity member={m} />
                <span className="font-mono text-xs text-text">{m.payrollInfo?.uan || '—'}</span>
                <span className="text-sm text-text">{STATUS_LABEL[m.nextAction]}</span>
                <span className="text-xs text-subtle">Registered {filedOn}</span>
                <div className="flex items-center justify-end gap-1">
                  {canReset && (
                    <Button size="sm" variant="ghost" icon={RotateCcw} loading={epfo.resettingId === m.id} onClick={() => epfo.resetToPending(m)}>
                      Reset
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onFixMember(m.id, 'statutory', m.readiness.errors.map((e) => e.field))}>
                    Edit profile
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
