import { describe, it, expect } from 'vitest';
import {
  buildRegistrationLine,
  buildRegistrationFile,
  buildExitFile,
  buildKycFile,
} from './formats';
import type { EpfoMemberInput } from './types';

const sampleMember: EpfoMemberInput = {
  id: 's1',
  machineId: '101',
  name: 'Mr. Ramesh Kumar',
  joiningDate: '2026-09-01',
  employmentPeriods: [
    { id: 'p1', startDate: '2026-09-01', endDate: '2026-10-31', exitReason: 'RESIGNATION', epfoJoinExportedAt: new Date(), epfoExitExportedAt: null, epfoExitCode: null },
  ],
  payrollInfo: {
    payGroup: 'BANK_EPF',
    monthlyCtc: 16800, // 16800 / 1.12 = 15000 epfWages
    uan: '100248330106',
    nameOnUan: 'RAMESH KUMAR',
    dob: '1990-04-15',
    gender: 'Male',
    fatherHusbandName: 'Shri Suresh Kumar',
    relationship: 'Father',
    mobileNumber: '9876543210',
    email: 'ramesh@example.com',
    nationality: 'INDIAN',
    qualification: 'GRADUATE',
    maritalStatus: 'Married',
    bankAccount: '123456789012',
    ifsc: 'HDFC0001234',
    nameAsPerBank: 'RAMESH KUMAR',
    pan: 'ABCDE1234F',
    nameOnPan: 'RAMESH KUMAR',
    aadhaar: '234567890123',
    nameOnAadhaar: 'RAMESH KUMAR',
  },
};

describe('EPFO bulk file builders', () => {
  it('builds a 30-column #~# registration line using calculateStaffPayroll epfWages and mapped codes', () => {
    const line = buildRegistrationLine(sampleMember);
    const cols = line.split('#~#');
    expect(cols).toHaveLength(30);
    expect(cols[0]).toBe('100248330106'); // UAN
    expect(cols[2]).toBe('RAMESH KUMAR'); // Name
    expect(cols[3]).toBe('15/04/1990');   // DOB
    expect(cols[4]).toBe('01/09/2026');   // DOJ
    expect(cols[5]).toBe('M');            // Gender mapped
    expect(cols[6]).toBe('SURESH KUMAR'); // Father name with 'Shri' stripped
    expect(cols[7]).toBe('F');            // Relationship mapped
    expect(cols[11]).toBe('15000');       // Column 12: epfWages from calculateStaffPayroll
    expect(cols[13]).toBe('M');           // Marital status mapped
    expect(cols[23]).toBe('123456789012');
    expect(cols[24]).toBe('HDFC0001234');
    expect(cols[28]).toBe('234567890123');
    expect(buildRegistrationFile([sampleMember]).endsWith('\n')).toBe(false);
  });

  it('builds a 3-column Mark Exit file without trailing newline', () => {
    const txt = buildExitFile([{ member: sampleMember }]);
    expect(txt).toBe('100248330106#~#31/10/2026#~#C');
  });

  it('builds 5-column KYC lines for valid docs only and tracks exportedStaffIds accurately (Review Focus #5)', () => {
    const partialMember: EpfoMemberInput = {
      ...sampleMember,
      id: 's-partial',
      payrollInfo: { ...sampleMember.payrollInfo, pan: null }, // Bank + Aadhaar valid, PAN missing
    };
    const noValidDocsMember: EpfoMemberInput = {
      ...sampleMember,
      id: 's-empty',
      payrollInfo: { ...sampleMember.payrollInfo, bankAccount: null, pan: null, aadhaar: '012345678901' }, // invalid aadhaar
    };
    const invalidUanMember: EpfoMemberInput = {
      ...sampleMember,
      id: 's-bad-uan',
      payrollInfo: { ...sampleMember.payrollInfo, uan: '12345' }, // malformed 5-digit UAN
    };

    const res = buildKycFile([partialMember, noValidDocsMember, invalidUanMember], ['B', 'P', 'A']);
    const lines = res.content.split('\n');
    expect(lines).toEqual([
      '100248330106#~#B#~#123456789012#~#RAMESH KUMAR#~#HDFC0001234',
      '100248330106#~#A#~#234567890123#~#RAMESH KUMAR#~#',
    ]);
    expect(res.exportedStaffIds).toEqual(['s-partial']);
    expect(res.skipped.some((s) => s.staffId === 's-partial' && s.docType === 'P')).toBe(true);
    expect(res.skipped.some((s) => s.staffId === 's-empty' && s.docType === 'A')).toBe(true);
    expect(res.skipped.some((s) => s.staffId === 's-bad-uan')).toBe(true);
  });
});
