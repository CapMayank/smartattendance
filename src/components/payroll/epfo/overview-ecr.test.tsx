import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EpfoOverviewTab, type SummaryResponse } from './EpfoOverviewTab';
import { EpfoEcrHistoryTab } from './EpfoEcrHistoryTab';
import type { EcrMonthSummary } from '@/lib/epfo/summary';

const zero = { NEEDS_REGISTRATION: 0, AWAITING_UAN: 0, NEEDS_EXIT: 0, NEEDS_KYC: 0, UP_TO_DATE: 0, HIDDEN: 0 };

const month = (o: Partial<EcrMonthSummary>): EcrMonthSummary => ({
  month: 10, year: 2026, label: 'October 2026', financialYear: '2026-27', members: 42,
  epfWages: 630000, epsWages: 630000, edliWages: 630000, employeeShare: 75600,
  employerEps: 52479, employerEpf: 23121, employerShare: 75600, total: 151200,
  ncpDays: 9, locked: true, dueDate: '2026-11-15', ...o,
});

describe('EpfoOverviewTab', () => {
  it('shows 0% and no NaN when there are no EPF members', () => {
    const data: SummaryResponse = { counts: zero, compliancePercent: 0, needsAttention: [], latestEcr: null, recentActivity: [] };
    const html = renderToStaticMarkup(<EpfoOverviewTab data={data} onOpenTab={vi.fn()} onFixMember={vi.fn()} />);
    expect(html).toContain('0%');
    expect(html).not.toContain('NaN');
    expect(html).toContain('No ECR filed yet');
  });

  it('renders KPIs, a needs-attention item with its reason and action, latest ECR and activity', () => {
    const data: SummaryResponse = {
      counts: { ...zero, NEEDS_REGISTRATION: 3, AWAITING_UAN: 1, NEEDS_KYC: 2, NEEDS_EXIT: 1, UP_TO_DATE: 38 },
      compliancePercent: 84,
      needsAttention: [{ staffId: 's1', name: 'Ravi Verma', reason: 'Missing: Qualification, Mobile', kind: 'FIX' }],
      latestEcr: month({}),
      recentActivity: [{ id: 'a', at: '2026-11-14T10:00:00.000Z', text: 'Registration file exported · 2 members' }],
    };
    const html = renderToStaticMarkup(<EpfoOverviewTab data={data} onOpenTab={vi.fn()} onFixMember={vi.fn()} />);
    expect(html).toContain('84%');
    expect(html).toContain('Ravi Verma');
    expect(html).toContain('Missing: Qualification, Mobile');
    expect(html).toContain('Fix details');
    expect(html).toContain('October 2026');
    expect(html).toContain('Registration file exported · 2 members');
  });
});

describe('EpfoEcrHistoryTab', () => {
  it('lists months newest first with Locked/Draft badges and a download action', () => {
    const html = renderToStaticMarkup(
      <EpfoEcrHistoryTab data={{ months: [month({}), month({ month: 9, label: 'September 2026', locked: false })] }} />
    );
    expect(html.indexOf('October 2026')).toBeGreaterThan(-1);
    expect(html.indexOf('October 2026')).toBeLessThan(html.indexOf('September 2026'));
    expect(html).toContain('Locked');
    expect(html).toContain('Draft');
    expect(html).toContain('Download ECR');
  });

  it('shows an empty state when no month has been filed', () => {
    const html = renderToStaticMarkup(<EpfoEcrHistoryTab data={{ months: [] }} />);
    expect(html).toContain('No ECR history yet');
  });
});
