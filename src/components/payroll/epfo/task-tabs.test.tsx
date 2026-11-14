import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { EpfoMemberRow, EpfoMembersApi } from './use-epfo-members';
import { EMPTY_COUNTS } from './use-epfo-members';
import { EpfoRegistrationTab } from './EpfoRegistrationTab';
import { EpfoKycTab } from './EpfoKycTab';
import { EpfoExitTab } from './EpfoExitTab';
import { EpfoAllMembersTab } from './EpfoAllMembersTab';

const row = (o: Partial<EpfoMemberRow>): EpfoMemberRow => ({
  id: 'x', machineId: '1', name: 'Member', nextAction: 'NEEDS_REGISTRATION',
  readiness: { ready: true, errors: [] }, payrollInfo: {}, employmentPeriods: [], ...o,
});

const api = (members: EpfoMemberRow[]): EpfoMembersApi => ({
  members, counts: { ...EMPTY_COUNTS }, loading: false, error: null, clearError: vi.fn(),
  refresh: vi.fn(), saveUan: vi.fn(), exportFile: vi.fn(), markFiled: vi.fn(), resetToPending: vi.fn(),
  undo: null, runUndo: vi.fn(), dismissUndo: vi.fn(), busy: false, savingUanId: null, resettingId: null,
}) as unknown as EpfoMembersApi;

const noop = vi.fn();

describe('EpfoRegistrationTab', () => {
  const members = [
    row({ id: 'ok', name: 'Dayawati Golhani' }),
    row({ id: 'bad', name: 'Ravi Verma', readiness: { ready: false, errors: [{ field: 'qualification', message: 'Qualification must be one of the EPFO options' }] } }),
    row({ id: 'wait', name: 'Meena Rao', nextAction: 'AWAITING_UAN', payrollInfo: { uan: '' } }),
  ];

  it('shows ready and not-ready members with per-field chips and a skipped count after selection', () => {
    const html = renderToStaticMarkup(
      <EpfoRegistrationTab epfo={api(members)} onFixMember={noop} initialSelectedIds={['ok', 'bad']} />
    );
    expect(html).toContain('Dayawati Golhani');
    expect(html).toContain('Ravi Verma');
    expect(html).toMatch(/data-field="qualification"[^>]*data-state="missing"/);
    expect(html).toMatch(/data-field="aadhaar"[^>]*data-state="ok"/);
    expect(html).toContain('1 skipped');
    expect(html).toContain('Download registration file');
  });

  it('shows the awaiting-UAN list and keeps Save disabled until 12 digits are typed', () => {
    const html = renderToStaticMarkup(
      <EpfoRegistrationTab epfo={api(members)} onFixMember={noop} initialFilter="AWAITING_UAN" />
    );
    expect(html).toContain('Meena Rao');
    expect(html).toMatch(/disabled[^>]*data-testid="save-uan"/);
  });

  it('renders a member with no payroll info without crashing', () => {
    expect(() =>
      renderToStaticMarkup(
        <EpfoRegistrationTab epfo={api([row({ id: 'n', name: 'No Info', payrollInfo: null })])} onFixMember={noop} />
      )
    ).not.toThrow();
  });
});

describe('EpfoKycTab', () => {
  it('explains bank KYC is not accepted and lists Aadhaar/PAN per member', () => {
    const html = renderToStaticMarkup(
      <EpfoKycTab
        epfo={api([row({ id: 'k', name: 'Amit Jain', nextAction: 'NEEDS_KYC', payrollInfo: { uan: '100248330199', aadhaar: '234567890123', pan: 'ABCDE1234F', payGroup: 'BANK_EPF' } })])}
        onFixMember={noop}
      />
    );
    expect(html).toContain('Bank KYC is not accepted');
    expect(html).toContain('Amit Jain');
    expect(html).toContain('Aadhaar');
    expect(html).toContain('PAN');
  });
});

describe('EpfoExitTab', () => {
  it('shows UAN and last working day as dd/mm/yyyy', () => {
    const html = renderToStaticMarkup(
      <EpfoExitTab
        epfo={api([row({ id: 'e', name: 'Suresh Patel', nextAction: 'NEEDS_EXIT', payrollInfo: { uan: '100248330106' }, employmentPeriods: [{ id: 'p', startDate: '2026-01-01', endDate: '2026-10-31' }] })])}
        onFixMember={noop}
      />
    );
    expect(html).toContain('Suresh Patel');
    expect(html).toContain('100248330106');
    expect(html).toContain('31/10/2026');
  });
});

describe('EpfoAllMembersTab', () => {
  it('lists every member with a status label', () => {
    const html = renderToStaticMarkup(
      <EpfoAllMembersTab epfo={api([row({ id: 'u', name: 'Done Person', nextAction: 'UP_TO_DATE' })])} onFixMember={noop} />
    );
    expect(html).toContain('Done Person');
    expect(html).toContain('Up to date');
  });
});

describe('Mark as already filed on KYC and Exit tabs', () => {
  it('is offered on the KYC tab', () => {
    const html = renderToStaticMarkup(
      <EpfoKycTab epfo={api([row({ id: 'k', nextAction: 'NEEDS_KYC' })])} onFixMember={noop} />
    );
    expect(html).toContain('Mark as already filed');
  });
  it('is offered on the Exit tab', () => {
    const html = renderToStaticMarkup(
      <EpfoExitTab epfo={api([row({ id: 'e', nextAction: 'NEEDS_EXIT' })])} onFixMember={noop} />
    );
    expect(html).toContain('Mark as already filed');
  });
});
