import type {
  EpfoDocType,
  EpfoExitReasonCode,
  EpfoMemberInput,
} from './types';

export function sanitizeEpfoText(val: string | null | undefined, maxLen?: number): string {
  if (!val) return '';
  const cleaned = val
    .replace(/#~#/g, '')
    .replace(/[#~]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return typeof maxLen === 'number' && maxLen > 0 ? cleaned.slice(0, maxLen) : cleaned;
}

export function sanitizeEpfoName(val: string | null | undefined, maxLen = 100): string {
  if (!val) return '';
  const cleaned = val
    .replace(/#~#/g, '')
    .replace(/[#~]/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutTitles = cleaned.replace(/^(?:(?:MR|MRS|MS|MISS|DR|SHRI|SMT|KUMARI)\.?\s+)+/i, '');
  const result = withoutTitles.replace(/\s+/g, ' ').trim().toUpperCase();
  return result.slice(0, maxLen);
}

export function parseIsoDateKey(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.slice(0, 10);
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function formatEpfoDate(val: Date | string | null | undefined): string {
  if (!val) return '';
  let d: Date;
  if (val instanceof Date) {
    d = val;
  } else {
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, day] = s.split('-').map(Number);
      d = new Date(Date.UTC(y, m - 1, day));
    } else {
      d = new Date(s);
    }
  }
  if (isNaN(d.getTime())) return '';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function mapGender(gender: string | null | undefined): 'M' | 'F' | 'T' | '' {
  if (!gender) return '';
  const g = gender.trim().toUpperCase();
  if (g === 'M' || g === 'MALE') return 'M';
  if (g === 'F' || g === 'FEMALE') return 'F';
  if (g === 'T' || g === 'OTHER' || g === 'TRANSGENDER') return 'T';
  return '';
}

export function mapRelationship(rel: string | null | undefined): 'F' | 'H' | null {
  if (!rel) return null;
  const r = rel.trim().toUpperCase();
  if (r === 'F' || r === 'FATHER') return 'F';
  if (r === 'H' || r === 'HUSBAND') return 'H';
  return null;
}

export function mapMaritalStatus(ms: string | null | undefined): 'M' | 'U' | 'W' | 'D' | '' {
  if (!ms) return '';
  const m = ms.trim().toUpperCase();
  if (m === 'M' || m === 'MARRIED') return 'M';
  if (m === 'U' || m === 'UNMARRIED' || m === 'SINGLE') return 'U';
  if (m === 'W' || m === 'WIDOWED' || m === 'WIDOW') return 'W';
  if (m === 'D' || m === 'DIVORCED') return 'D';
  return '';
}

export function computeEpfJoiningDate(member: EpfoMemberInput): string | null {
  const periods = (member.employmentPeriods || []).slice().sort((a, b) => b.startDate.localeCompare(a.startDate));
  const latestPeriod = periods[0];
  const baseDate = latestPeriod?.startDate || parseIsoDateKey(member.payrollInfo?.doj) || parseIsoDateKey(member.joiningDate);
  if (!baseDate) return null;

  const changes = (member.payrollInfo?.payGroupChanges || [])
    .filter((c) => c.payGroup === 'BANK_EPF')
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth));

  if (changes.length > 0) {
    const epfStart = `${changes[0].effectiveFromMonth}-01`;
    if (epfStart > baseDate) {
      return epfStart;
    }
  }

  return baseDate;
}

export function defaultExitReasonCode(
  exitReason: string | null | undefined,
  dob: Date | string | null | undefined,
  exitDate: string | null | undefined
): EpfoExitReasonCode {
  const r = (exitReason || '').trim().toUpperCase();
  if (r === 'RETIREMENT' || r === 'RETIRED') {
    const dobIso = parseIsoDateKey(dob);
    const exitIso = parseIsoDateKey(exitDate);
    if (dobIso && exitIso) {
      const [dobY, dobM, dobD] = dobIso.split('-').map(Number);
      const [exitY, exitM, exitD] = exitIso.split('-').map(Number);
      let age = exitY - dobY;
      if (exitM < dobM || (exitM === dobM && exitD < dobD)) {
        age--;
      }
      return age >= 58 ? 'S' : 'R';
    }
    return 'S';
  }

  if (r === 'DEATH' || r === 'DEATH_IN_SERVICE') return 'D';
  if (r === 'DEATH_AWAY') return 'A';
  if (r === 'PERMANENT_DISABLEMENT') return 'P';

  return 'C';
}
