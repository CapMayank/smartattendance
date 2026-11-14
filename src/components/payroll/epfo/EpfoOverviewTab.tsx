'use client';

import React, { useEffect, useState } from 'react';
import { Clock, FileText, LogOut, ShieldCheck, UserPlus, CheckCircle2, Download } from 'lucide-react';
import { Button, Card, EmptyState, KpiTile, ProgressTrack, Skeleton } from '@/components/ui';
import type { EcrMonthSummary, EpfoCounts, NeedsAttentionItem } from '@/lib/epfo/summary';

export interface SummaryResponse {
  counts: EpfoCounts;
  compliancePercent: number;
  needsAttention: NeedsAttentionItem[];
  latestEcr: EcrMonthSummary | null;
  recentActivity: Array<{ id: string; at: string; text: string }>;
}

export type EpfoTabId = 'registration' | 'kyc' | 'exit' | 'ecr' | 'all';

interface Props {
  data?: SummaryResponse;
  refreshTrigger?: number;
  onOpenTab: (tab: EpfoTabId) => void;
  onFixMember: (staffId: string, tab: 'statutory' | 'kyc', fields: string[]) => void;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Ring({ counts, percent }: { counts: EpfoCounts; percent: number }) {
  const r = 15.9;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="104" height="104" viewBox="0 0 42 42" role="img" aria-label={`${percent}% of members up to date`}>
      <circle cx="21" cy="21" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-card-hi" />
      <circle
        cx="21" cy="21" r={r} fill="none" strokeWidth="5" strokeLinecap="round"
        stroke="var(--color-present)"
        strokeDasharray={`${(percent / 100) * circ} ${circ}`}
        transform="rotate(-90 21 21)"
      />
      <text x="21" y="23.5" textAnchor="middle" fontSize="8" fontWeight="600" fill="currentColor" className="text-text">
        {percent}%
      </text>
    </svg>
  );
}

export function EpfoOverviewTab({ data: initial, refreshTrigger = 0, onOpenTab, onFixMember }: Props) {
  const [data, setData] = useState<SummaryResponse | undefined>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/payroll/epfo/summary');
        if (!res.ok) throw new Error('Could not load the overview');
        const json = (await res.json()) as SummaryResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the overview');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial, refreshTrigger]);

  if (!data) {
    return error ? (
      <div role="alert" className="rounded-xl border border-absent/30 bg-absent/10 px-4 py-3 text-sm text-absent">
        {error}
      </div>
    ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-busy="true">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    );
  }

  const c = data.counts;
  const pending = [
    { label: 'New registration', n: c.NEEDS_REGISTRATION, tab: 'registration' as const },
    { label: 'Awaiting UAN', n: c.AWAITING_UAN, tab: 'registration' as const },
    { label: 'KYC seeding', n: c.NEEDS_KYC, tab: 'kyc' as const },
    { label: 'Exit marking', n: c.NEEDS_EXIT, tab: 'exit' as const },
  ];
  const maxPending = Math.max(1, ...pending.map((p) => p.n));
  const members = c.NEEDS_REGISTRATION + c.AWAITING_UAN + c.NEEDS_EXIT + c.NEEDS_KYC + c.UP_TO_DATE;
  const ecr = data.latestEcr;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile tone="accent" icon={UserPlus} label="Pending registration" value={c.NEEDS_REGISTRATION} foot="New joinees to register" />
        <KpiTile tone="late" icon={Clock} label="Awaiting UAN" value={c.AWAITING_UAN} foot="Filed, UAN not entered" />
        <KpiTile tone="accent" icon={ShieldCheck} label="KYC pending" value={c.NEEDS_KYC} foot="Aadhaar / PAN not seeded" />
        <KpiTile tone="absent" icon={LogOut} label="Exits due" value={c.NEEDS_EXIT} foot="Leavers to mark" />
        <KpiTile tone="present" icon={CheckCircle2} label="Compliance" value={`${data.compliancePercent}%`} foot={`${c.UP_TO_DATE} of ${members} up to date`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <div className="space-y-3">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-text">Pending work by task</h3>
            <ul className="space-y-3">
              {pending.map((p) => (
                <li key={p.label}>
                  <button type="button" onClick={() => onOpenTab(p.tab)} className="grid w-full grid-cols-[120px_1fr_28px] items-center gap-3 text-left text-[13px]">
                    <span className="text-muted">{p.label}</span>
                    <ProgressTrack value={p.n} max={maxPending} />
                    <b className="num text-right text-text">{p.n}</b>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h3 className="mb-1 flex items-center justify-between text-sm font-semibold text-text">
              Needs attention <span className="text-xs font-normal text-subtle">blocking an export</span>
            </h3>
            {data.needsAttention.length === 0 ? (
              <p className="py-4 text-sm text-subtle">Nothing is blocked right now.</p>
            ) : (
              <ul>
                {data.needsAttention.map((a) => (
                  <li key={`${a.kind}-${a.staffId}`} className="flex items-center justify-between gap-3 border-t border-line-soft py-2.5 first:border-0">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-text">{a.name}</div>
                      <div className="truncate text-xs text-muted">{a.reason}</div>
                    </div>
                    {a.kind === 'ENTER_UAN' ? (
                      <Button size="sm" variant="secondary" onClick={() => onOpenTab('registration')}>Enter UAN</Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => onFixMember(a.staffId, 'statutory', [])}>Fix details</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-text">Member status</h3>
            <div className="flex items-center gap-4">
              <Ring counts={c} percent={data.compliancePercent} />
              <ul className="space-y-1 text-[12.5px] text-muted">
                <li><span className="num text-text">{c.UP_TO_DATE}</span> up to date</li>
                <li><span className="num text-text">{c.NEEDS_REGISTRATION}</span> to register</li>
                <li><span className="num text-text">{c.AWAITING_UAN}</span> awaiting UAN</li>
                <li><span className="num text-text">{c.NEEDS_KYC}</span> KYC · <span className="num text-text">{c.NEEDS_EXIT}</span> exit</li>
              </ul>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-text">
              Latest ECR
              <button type="button" onClick={() => onOpenTab('ecr')} className="text-xs font-normal text-acc-1 hover:underline">History</button>
            </h3>
            {ecr ? (
              <>
                <div className="flex items-baseline justify-between">
                  <b className="text-lg font-semibold text-text">{ecr.label}</b>
                  <span className={`text-xs ${ecr.locked ? 'text-present' : 'text-late'}`}>{ecr.locked ? 'Locked' : 'Draft'}</span>
                </div>
                <div className="mb-3 text-[12.5px] text-muted">{ecr.members} members · due {ecr.dueDate.split('-').reverse().join('/')}</div>
                <div className="num text-xl text-text">{inr(ecr.total)}</div>
                <div className="mb-3 text-xs text-subtle">total payable (employee + employer)</div>
                <a
                  href={`/api/payroll/export/ecr-text?month=${ecr.month}&year=${ecr.year}`}
                  className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-[10px] border border-line text-[13px] font-medium text-muted hover:border-subtle hover:text-text"
                >
                  <Download size={15} aria-hidden="true" /> Download ECR text file
                </a>
              </>
            ) : (
              <EmptyState icon={FileText} title="No ECR filed yet" hint="Lock a month's payroll to generate its ECR." />
            )}
          </Card>

          <Card>
            <h3 className="mb-2 text-sm font-semibold text-text">Recent activity</h3>
            {data.recentActivity.length === 0 ? (
              <p className="py-2 text-sm text-subtle">No EPFO activity yet.</p>
            ) : (
              <ul>
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="border-t border-line-soft py-2 text-[12.5px] first:border-0">
                    <div className="text-text">{a.text}</div>
                    <div className="text-subtle">{formatWhen(a.at)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
