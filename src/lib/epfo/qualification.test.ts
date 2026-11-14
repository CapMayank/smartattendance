import { describe, it, expect } from 'vitest';
import { mapQualification, EPFO_QUALIFICATION_OPTIONS, epfoFileName } from './mappings';
import { buildRegistrationLine } from './formats';
import { validateForRegistration } from './validation';
import type { EpfoMemberInput } from './types';

const member = (qualification: string | null): EpfoMemberInput => ({
  id: 's1',
  machineId: '1',
  name: 'DAYAWATI GOLHANI',
  joiningDate: '2026-11-01',
  employmentPeriods: [
    { id: 'p1', startDate: '2026-11-01', endDate: null, exitReason: null, epfoJoinExportedAt: null, epfoExitExportedAt: null, epfoExitCode: null },
  ],
  payrollInfo: {
    payGroup: 'BANK_EPF',
    monthlyCtc: 16800,
    dob: '2004-06-14',
    gender: 'Female',
    fatherHusbandName: 'DHANRAJ GOLHANI',
    relationship: 'Father',
    mobileNumber: '9575046942',
    nationality: 'INDIAN',
    qualification,
    maritalStatus: 'Unmarried',
    aadhaar: '375421991941',
  },
} as EpfoMemberInput);

describe('mapQualification', () => {
  it('accepts EPFO codes and labels', () => {
    expect(mapQualification('G')).toBe('G');
    expect(mapQualification('graduate')).toBe('G');
    expect(mapQualification('Post Graduate')).toBe('P');
    expect(mapQualification('POST-GRADUATE')).toBe('P');
    expect(mapQualification('Senior-Secondary')).toBe('S');
    expect(mapQualification('Technical (Professional)')).toBe('T');
  });
  it('maps common degree names from legacy free text', () => {
    expect(mapQualification('BSC')).toBe('G');
    expect(mapQualification('B.Ed')).toBe('G');
    expect(mapQualification('M.Sc')).toBe('P');
    expect(mapQualification('PhD')).toBe('D');
    expect(mapQualification('D.El.Ed')).toBe('T');
  });
  it('returns empty for blank or unknown text', () => {
    expect(mapQualification('')).toBe('');
    expect(mapQualification(null)).toBe('');
    expect(mapQualification('xyz')).toBe('');
  });
  it('exposes the 9 EPFO options', () => {
    expect(EPFO_QUALIFICATION_OPTIONS.map((o) => o.code)).toEqual(['I', 'L', 'N', 'M', 'S', 'G', 'P', 'D', 'T']);
  });
});

describe('registration export qualification', () => {
  it('writes the single-letter code in column 13 even for legacy text', () => {
    const cols = buildRegistrationLine(member('BSC')).split('#~#');
    expect(cols[12]).toBe('G');
  });
  it('leaves country of origin and passport columns empty for non-international workers', () => {
    const cols = buildRegistrationLine(member('BSC')).split('#~#');
    expect(cols[14]).toBe('N');
    expect(cols.slice(15, 19)).toEqual(['', '', '', '']);
  });
  it('requires a recognised qualification', () => {
    const res = validateForRegistration(member('xyz'));
    expect(res.errors.map((e) => e.field)).toContain('qualification');
    expect(validateForRegistration(member('BSC')).errors.map((e) => e.field)).not.toContain('qualification');
  });
});

describe('epfoFileName', () => {
  it('is alphanumeric only', () => {
    const n = epfoFileName('REG', new Date(2026, 10, 14, 15, 30));
    expect(n).toBe('EPFOREG202611141530.txt');
    expect(n.replace(/\.txt$/, '')).toMatch(/^[A-Za-z0-9]+$/);
  });
});
