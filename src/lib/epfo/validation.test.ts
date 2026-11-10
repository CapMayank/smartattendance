import { describe, it, expect } from 'vitest';
import { getEpfoNextAction } from './next-action';
import { validateForRegistration, validateForExit, validateForKyc, validateForNextAction } from './validation';
import { computeKycHash } from './kyc-hash';
import type { EpfoMemberInput } from './types';

const baseReadyMember: EpfoMemberInput = {
  id: 's1',
  machineId: '101',
  name: 'Ramesh Kumar',
  joiningDate: '2026-01-10',
  employmentPeriods: [
    { id: 'p1', startDate: '2026-01-10', endDate: null, exitReason: null, epfoJoinExportedAt: null, epfoExitExportedAt: null, epfoExitCode: null },
  ],
  payrollInfo: {
    payGroup: 'BANK_EPF',
    monthlyCtc: 22400,
    dob: '1992-05-15',
    gender: 'Male',
    fatherHusbandName: 'Suresh Kumar',
    relationship: 'Father',
    mobileNumber: '9876543210',
    maritalStatus: 'Married',
    bankAccount: '123456789012',
    ifsc: 'SBIN0001234',
    nameAsPerBank: 'RAMESH KUMAR',
    pan: 'ABCDE1234F',
    nameOnPan: 'RAMESH KUMAR',
    aadhaar: '234567890123',
    nameOnAadhaar: 'RAMESH KUMAR',
  },
};

describe('getEpfoNextAction & action-scoped validation', () => {
  it('places active BANK_EPF member with existing UAN in NEEDS_REGISTRATION when epfoJoinExportedAt is null', () => {
    const m: EpfoMemberInput = {
      ...baseReadyMember,
      payrollInfo: { ...baseReadyMember.payrollInfo, uan: '100234567890' },
    };
    expect(getEpfoNextAction(m)).toBe('NEEDS_REGISTRATION');
    expect(validateForNextAction(m).ready).toBe(true);
  });

  it('transitions to AWAITING_UAN -> NEEDS_KYC -> UP_TO_DATE -> NEEDS_KYC on KYC edit', () => {
    const awaitingUan: EpfoMemberInput = {
      ...baseReadyMember,
      employmentPeriods: [{ ...baseReadyMember.employmentPeriods![0], epfoJoinExportedAt: new Date() }],
    };
    expect(getEpfoNextAction(awaitingUan)).toBe('AWAITING_UAN');

    const withUan: EpfoMemberInput = {
      ...awaitingUan,
      payrollInfo: { ...baseReadyMember.payrollInfo, uan: '100234567890' },
    };
    expect(getEpfoNextAction(withUan)).toBe('NEEDS_KYC');

    const hash = computeKycHash(withUan.payrollInfo);
    const upToDate: EpfoMemberInput = {
      ...withUan,
      payrollInfo: { ...withUan.payrollInfo, epfoKycExportedAt: new Date(), epfoKycExportedHash: hash },
    };
    expect(getEpfoNextAction(upToDate)).toBe('UP_TO_DATE');

    const editedBank: EpfoMemberInput = {
      ...upToDate,
      payrollInfo: { ...upToDate.payrollInfo, bankAccount: '999999999999' },
    };
    expect(getEpfoNextAction(editedBank)).toBe('NEEDS_KYC');
  });

  it('evaluates rejoined staff member to NEEDS_REGISTRATION for the new period (Review Focus #3)', () => {
    const rejoined: EpfoMemberInput = {
      ...baseReadyMember,
      employmentPeriods: [
        { id: 'p2', startDate: '2026-10-01', endDate: null, exitReason: null, epfoJoinExportedAt: null, epfoExitExportedAt: null, epfoExitCode: null },
        { id: 'p1', startDate: '2024-01-01', endDate: '2025-12-31', exitReason: 'RESIGNATION', epfoJoinExportedAt: new Date('2024-02-01'), epfoExitExportedAt: new Date('2026-01-05'), epfoExitCode: 'C' },
      ],
    };
    expect(getEpfoNextAction(rejoined)).toBe('NEEDS_REGISTRATION');
  });

  it('rejects Aadhaar starting with 0/1, IFSC without 0 at 5th char, and Mother relationship (Review Focus #2)', () => {
    const bad: EpfoMemberInput = {
      ...baseReadyMember,
      payrollInfo: {
        ...baseReadyMember.payrollInfo,
        relationship: 'Mother',
        aadhaar: '123456789012',
        ifsc: 'SBINO001234', // letter O instead of digit 0
      },
    };
    const res = validateForRegistration(bad);
    expect(res.ready).toBe(false);
    expect(res.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(['relationship', 'aadhaar', 'ifsc'])
    );
  });

  it('rejects exit when exitDate is earlier than EPF joining date after CASH->BANK_EPF switch (Review Focus #4)', () => {
    const exitedBeforeSwitch: EpfoMemberInput = {
      ...baseReadyMember,
      employmentPeriods: [
        { id: 'p1', startDate: '2024-01-01', endDate: '2026-08-15', exitReason: 'RESIGNATION', epfoJoinExportedAt: new Date(), epfoExitExportedAt: null, epfoExitCode: null },
      ],
      payrollInfo: {
        ...baseReadyMember.payrollInfo,
        uan: '100234567890',
        payGroupChanges: [{ payGroup: 'BANK_EPF', effectiveFromMonth: '2026-09' }],
      },
    };
    const res = validateForExit(exitedBeforeSwitch);
    expect(res.ready).toBe(false);
    expect(res.errors.some((e) => e.field === 'endDate')).toBe(true);
  });
});
