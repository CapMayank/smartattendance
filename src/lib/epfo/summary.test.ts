import { describe, it, expect } from 'vitest';
import {
  buildNeedsAttention,
  computeCompliancePercent,
  describeEpfoAction,
  ecrDueDate,
  financialYearOf,
  summarizeEcrMonths,
  type EcrPayrollRow,
} from './summary';

const zero = { NEEDS_REGISTRATION: 0, AWAITING_UAN: 0, NEEDS_EXIT: 0, NEEDS_KYC: 0, UP_TO_DATE: 0, HIDDEN: 0 };

describe('computeCompliancePercent', () => {
  it('is up-to-date over all non-hidden members, rounded', () => {
    expect(
      computeCompliancePercent({ NEEDS_REGISTRATION: 3, AWAITING_UAN: 1, NEEDS_EXIT: 1, NEEDS_KYC: 2, UP_TO_DATE: 38, HIDDEN: 9 })
    ).toBe(84);
  });
  it('is 0, not NaN, when there are no EPF members', () => {
    expect(computeCompliancePercent({ ...zero, HIDDEN: 5 })).toBe(0);
  });
});

describe('financialYearOf / ecrDueDate', () => {
  it('runs April to March', () => {
    expect(financialYearOf(3, 2026)).toBe('2025-26');
    expect(financialYearOf(4, 2026)).toBe('2026-27');
  });
  it('is the 15th of the following month, rolling the year', () => {
    expect(ecrDueDate(10, 2026)).toBe('2026-11-15');
    expect(ecrDueDate(12, 2026)).toBe('2027-01-15');
  });
});

const row = (o: Partial<EcrPayrollRow>): EcrPayrollRow => ({
  month: 10, year: 2026, isLocked: true, payGroup: 'BANK_EPF', staffPayGroup: 'BANK_EPF',
  grossWage: 16800, epfWages: 15000, epsWages: 15000, edliWages: 15000,
  employeeEpf: 1800, employerEps: 1250, employerEpf: 550, ncpDays: 1, ...o,
});

describe('summarizeEcrMonths', () => {
  it('sums counted rows per month, newest first', () => {
    const res = summarizeEcrMonths([row({}), row({}), row({ month: 9 })]);
    expect(res.map((m) => `${m.month}/${m.year}`)).toEqual(['10/2026', '9/2026']);
    const oct = res[0];
    expect(oct.label).toBe('October 2026');
    expect(oct.financialYear).toBe('2026-27');
    expect(oct.members).toBe(2);
    expect(oct.epfWages).toBe(30000);
    expect(oct.employeeShare).toBe(3600);
    expect(oct.employerShare).toBe(3600);
    expect(oct.total).toBe(7200);
    expect(oct.ncpDays).toBe(2);
    expect(oct.dueDate).toBe('2026-11-15');
    expect(oct.locked).toBe(true);
  });
  it('is locked only when every counted row is locked', () => {
    expect(summarizeEcrMonths([row({}), row({ isLocked: false })])[0].locked).toBe(false);
  });
  it('ignores cash and zero-wage rows so empty months never appear', () => {
    const res = summarizeEcrMonths([
      row({ payGroup: 'CASH' }),
      row({ staffPayGroup: 'CASH' }),
      row({ grossWage: 0 }),
      row({ month: 8 }),
    ]);
    expect(res.map((m) => m.month)).toEqual([8]);
  });
});

describe('buildNeedsAttention', () => {
  const now = new Date('2026-11-15T00:00:00Z');
  const period = (joinAt: string) => [
    { id: 'p', startDate: '2026-10-01', endDate: null, exitReason: null, epfoJoinExportedAt: joinAt, epfoExitExportedAt: null, epfoExitCode: null },
  ];
  it('lists overdue UAN entries before missing-field fixes and respects the limit', () => {
    const items = buildNeedsAttention(
      [
        { id: 'a', name: 'Ravi', nextAction: 'NEEDS_REGISTRATION', readiness: { ready: false, errors: [{ field: 'q', message: 'Qualification' }, { field: 'm', message: 'Mobile' }] } },
        { id: 'b', name: 'Meena', nextAction: 'AWAITING_UAN', readiness: { ready: true, errors: [] }, employmentPeriods: period('2026-11-08T00:00:00Z') },
        { id: 'c', name: 'New', nextAction: 'AWAITING_UAN', readiness: { ready: true, errors: [] }, employmentPeriods: period('2026-11-14T00:00:00Z') },
      ],
      now
    );
    expect(items.map((i) => [i.staffId, i.kind])).toEqual([['b', 'ENTER_UAN'], ['a', 'FIX']]);
    expect(items[0].reason).toContain('7 days');
    expect(items[1].reason).toBe('Missing: Qualification, Mobile');
    expect(buildNeedsAttention([
      { id: 'a', name: 'A', nextAction: 'NEEDS_KYC', readiness: { ready: false, errors: [{ field: 'x', message: 'X' }] } },
      { id: 'b', name: 'B', nextAction: 'NEEDS_KYC', readiness: { ready: false, errors: [{ field: 'x', message: 'X' }] } },
    ], now, 1)).toHaveLength(1);
  });
});

describe('describeEpfoAction', () => {
  it('describes known actions with counts', () => {
    expect(describeEpfoAction('EPFO_EXPORT_REG', '{"exportedStaffIds":["a","b"]}')).toBe('Registration file exported · 2 members');
    expect(describeEpfoAction('EPFO_EXPORT_KYC', '{"exportedStaffIds":["a"]}')).toBe('KYC file exported · 1 member');
  });
  it('never throws on null, malformed JSON or unknown actions', () => {
    expect(describeEpfoAction('EPFO_EXPORT_EXIT', null)).toBe('Exit file exported');
    expect(describeEpfoAction('EPFO_EXPORT_REG', '{bad')).toBe('Registration file exported');
    expect(describeEpfoAction('EPFO_SOMETHING_NEW', null)).toBe('EPFO: something new');
  });
});
