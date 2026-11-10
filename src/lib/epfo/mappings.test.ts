import { describe, it, expect } from 'vitest';
import {
  sanitizeEpfoText,
  sanitizeEpfoName,
  formatEpfoDate,
  mapGender,
  mapRelationship,
  mapMaritalStatus,
  computeEpfJoiningDate,
  defaultExitReasonCode,
} from './mappings';
import { computeKycHash } from './kyc-hash';

describe('EPFO mappings & sanitisation', () => {
  it('strips #~# delimiters, newlines, and honorific titles from names (Review Focus #1)', () => {
    expect(sanitizeEpfoName('Dr. Ramesh#~# Kumar\r\n')).toBe('RAMESH KUMAR');
    expect(sanitizeEpfoName('Smt. Priya   Sharma')).toBe('PRIYA SHARMA');
    expect(sanitizeEpfoName('Mr Anil~Verma#')).toBe('ANIL VERMA');
    expect(sanitizeEpfoText('ABC#~#123\n456')).toBe('ABC123 456');
  });

  it('formats ISO dates and Date objects to DD/MM/YYYY', () => {
    expect(formatEpfoDate('2026-09-17')).toBe('17/09/2026');
    expect(formatEpfoDate(new Date('2000-01-05T00:00:00.000Z'))).toBe('05/01/2000');
    expect(formatEpfoDate(null)).toBe('');
  });

  it('maps stored gender, relationship, and marital status to EPFO single-char codes', () => {
    expect(mapGender('Male')).toBe('M');
    expect(mapGender('Female')).toBe('F');
    expect(mapGender('Other')).toBe('T');
    expect(mapRelationship('Father')).toBe('F');
    expect(mapRelationship('Husband')).toBe('H');
    expect(mapRelationship('Mother')).toBeNull();
    expect(mapRelationship('Other')).toBeNull();
    expect(mapMaritalStatus('Married')).toBe('M');
    expect(mapMaritalStatus('Unmarried')).toBe('U');
    expect(mapMaritalStatus('Single')).toBe('U');
    expect(mapMaritalStatus('Widowed')).toBe('W');
    expect(mapMaritalStatus('Divorced')).toBe('D');
  });

  it('computes EPF joining date as later of period startDate and latest BANK_EPF PayGroupChange (Review Focus #4)', () => {
    const switchedMember = {
      id: 's1',
      machineId: '1',
      name: 'Test',
      joiningDate: '2024-06-15',
      employmentPeriods: [
        { id: 'p1', startDate: '2024-06-15', endDate: null, exitReason: null, epfoJoinExportedAt: null, epfoExitExportedAt: null, epfoExitCode: null },
      ],
      payrollInfo: {
        payGroup: 'BANK_EPF',
        payGroupChanges: [
          { payGroup: 'CASH', effectiveFromMonth: '2024-06' },
          { payGroup: 'BANK_EPF', effectiveFromMonth: '2026-09' },
        ],
      },
    };
    expect(computeEpfJoiningDate(switchedMember)).toBe('2026-09-01');
  });

  it('maps retirement exit reason to S when age >= 58 on exit date, else R, and others to C', () => {
    expect(defaultExitReasonCode('RETIREMENT', '1965-03-10', '2026-03-31')).toBe('S'); // age 61
    expect(defaultExitReasonCode('RETIRED', '1975-03-10', '2026-03-31')).toBe('R');    // age 51
    expect(defaultExitReasonCode('RESIGNATION', '1990-01-01', '2026-03-31')).toBe('C');
    expect(defaultExitReasonCode('RESIGNED', '1990-01-01', '2026-03-31')).toBe('C');
    expect(defaultExitReasonCode('TERMINATION', '1990-01-01', '2026-03-31')).toBe('C');
  });

  it('computes deterministic KYC hash that changes when any KYC field changes', () => {
    const h1 = computeKycHash({
      bankAccount: ' 12345678901 ',
      ifsc: 'sbin0001234',
      nameAsPerBank: 'Ramesh Kumar',
      pan: 'abcde1234f',
      nameOnPan: 'Ramesh Kumar',
      aadhaar: '234567890123',
      nameOnAadhaar: 'Ramesh Kumar',
    });
    const h2 = computeKycHash({
      bankAccount: '12345678901',
      ifsc: 'SBIN0001234',
      nameAsPerBank: 'RAMESH KUMAR',
      pan: 'ABCDE1234F',
      nameOnPan: 'RAMESH KUMAR',
      aadhaar: '234567890123',
      nameOnAadhaar: 'RAMESH KUMAR',
    });
    const h3 = computeKycHash({
      bankAccount: '99999999999',
      ifsc: 'SBIN0001234',
      nameAsPerBank: 'RAMESH KUMAR',
    });
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
    expect(computeKycHash({})).toBe('');
  });
});
