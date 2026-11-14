'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, FileText } from 'lucide-react';
import { Chip, ChipGroup, EmptyState, Skeleton } from '@/components/ui';
import type { EcrMonthSummary } from '@/lib/epfo/summary';

interface MonthDetail {
  month: EcrMonthSummary;
  members: Array<{ staffId: string; name: string; uan: string; epfWages: number; employeeEpf: number; ncpDays: number }>;
}

const n = (v: number) => v.toLocaleString('en-IN');
const key = (m: { month: number; year: number }) => `${m.year}-${m.month}`;

function DetailPanel({ month }: { month: EcrMonthSummary }) {
  const [detail, setDetail] = useState<MonthDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/payroll/epfo/ecr?month=${month.month}&year=${month.year}`);
        if (!res.ok) throw new Error('Could not load member details');
        const json = (await res.json()) as MonthDetail;
        if (!cancelled) setDetail(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load member details');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month.month, month.year]);

  return (
    <div className="space-y-3 bg-card px-4 py-4">
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          ['EPS (8.33%)', n(month.employerEps)],
          ['EPF A/c 01 (3.67%)', n(month.employerEpf)],
          ['EDLI wages', n(month.edliWages)],
          ['NCP days', n(month.ncpDays)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line-soft bg-canvas px-3 py-2">
            <dt className="text-[11.5px] text-subtle">{k}</dt>
            <dd className="num font-medium text-text">{v}</dd>
          </div>
        ))}
      </dl>
      {error ? (
        <p role="alert" className="text-sm text-absent">{error}</p>
      ) : !detail ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Member</th><th>UAN</th>
                <th className="text-right">EPF wages</th><th className="text-right">Employee</th><th className="text-right">NCP</th>
              </tr>
            </thead>
            <tbody>
              {detail.members.map((m) => (
                <tr key={m.staffId}>
                  <td>{m.name}</td>
                  <td className="font-mono text-xs">{m.uan || '—'}</td>
                  <td className="num text-right">{n(m.epfWages)}</td>
                  <td className="num text-right">{n(m.employeeEpf)}</td>
                  <td className="num text-right">{m.ncpDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function EpfoEcrHistoryTab({ data: initial }: { data?: { months: EcrMonthSummary[] } }) {
  const [months, setMonths] = useState<EcrMonthSummary[] | null>(initial?.months ?? null);
  const [error, setError] = useState<string | null>(null);
  const [fy, setFy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/payroll/epfo/ecr');
        if (!res.ok) throw new Error('Could not load ECR history');
        const json = await res.json();
        if (!cancelled) setMonths(json.months || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load ECR history');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial]);

  const years = useMemo(() => Array.from(new Set((months ?? []).map((m) => m.financialYear))), [months]);
  const activeFy = fy ?? years[0] ?? null;
  const shown = (months ?? []).filter((m) => !activeFy || m.financialYear === activeFy);

  if (error) {
    return <p role="alert" className="m-4 rounded-xl border border-absent/30 bg-absent/10 px-4 py-3 text-sm text-absent">{error}</p>;
  }
  if (!months) {
    return <div className="p-4" aria-busy="true"><Skeleton className="h-40 rounded-xl" /></div>;
  }
  if (months.length === 0) {
    return (
      <div className="py-12">
        <EmptyState icon={FileText} title="No ECR history yet" hint="Months appear here once payroll is generated for EPF staff." />
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-line-soft px-4 py-3">
        <ChipGroup label="Financial year">
          {years.map((y) => (
            <Chip key={y} pressed={activeFy === y} onClick={() => setFy(y)}>FY {y}</Chip>
          ))}
        </ChipGroup>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Month</th>
              <th className="text-right">Members</th>
              <th className="text-right">EPF wages</th>
              <th className="text-right">Employee 12%</th>
              <th className="text-right">Employer</th>
              <th className="text-right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => {
              const k = key(m);
              const isOpen = open === k;
              return (
                <React.Fragment key={k}>
                  <tr className="cursor-pointer" onClick={() => setOpen(isOpen ? null : k)}>
                    <td>
                      <button type="button" aria-expanded={isOpen} className="inline-flex items-center gap-2 font-medium text-text">
                        {isOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
                        {m.label}
                      </button>{' '}
                      <span className={`tint-badge ${m.locked ? 'tone-present' : 'tone-late'}`}>{m.locked ? 'Locked' : 'Draft'}</span>
                    </td>
                    <td className="num text-right">{m.members}</td>
                    <td className="num text-right">{n(m.epfWages)}</td>
                    <td className="num text-right">{n(m.employeeShare)}</td>
                    <td className="num text-right">{n(m.employerShare)}</td>
                    <td className="num text-right font-medium text-text">{n(m.total)}</td>
                    <td className="text-right">
                      <a
                        href={`/api/payroll/export/ecr-text?month=${m.month}&year=${m.year}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-3 text-[13px] font-medium text-muted hover:border-subtle hover:text-text"
                      >
                        <Download size={14} aria-hidden="true" /> Download ECR
                      </a>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} className="!p-0"><DetailPanel month={m} /></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
