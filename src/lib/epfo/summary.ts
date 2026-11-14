import type { EpfoNextAction, EpfoPeriodRecord } from './types';

export type EpfoCounts = Record<EpfoNextAction, number>;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function computeCompliancePercent(counts: EpfoCounts): number {
  const total =
    (counts.NEEDS_REGISTRATION || 0) +
    (counts.AWAITING_UAN || 0) +
    (counts.NEEDS_EXIT || 0) +
    (counts.NEEDS_KYC || 0) +
    (counts.UP_TO_DATE || 0);
  if (total <= 0) return 0;
  return Math.round(((counts.UP_TO_DATE || 0) / total) * 100);
}

export interface NeedsAttentionItem {
  staffId: string;
  name: string;
  reason: string;
  kind: 'FIX' | 'ENTER_UAN';
}

export interface AttentionInput {
  id: string;
  name: string;
  nextAction: EpfoNextAction;
  readiness: { ready: boolean; errors: { field: string; message: string }[] };
  employmentPeriods?: EpfoPeriodRecord[];
}

const UAN_OVERDUE_DAYS = 7;

export function buildNeedsAttention(
  members: AttentionInput[],
  now: Date,
  limit = 5
): NeedsAttentionItem[] {
  const uan: NeedsAttentionItem[] = [];
  const fix: NeedsAttentionItem[] = [];

  for (const m of members) {
    if (m.nextAction === 'AWAITING_UAN') {
      const filed = m.employmentPeriods?.[0]?.epfoJoinExportedAt;
      const filedMs = filed ? new Date(filed).getTime() : NaN;
      if (!isNaN(filedMs)) {
        const days = Math.floor((now.getTime() - filedMs) / DAY_MS);
        if (days >= UAN_OVERDUE_DAYS) {
          uan.push({
            staffId: m.id,
            name: m.name,
            reason: `UAN not entered ${days} days after filing`,
            kind: 'ENTER_UAN',
          });
        }
      }
    } else if (!m.readiness.ready && m.readiness.errors.length > 0) {
      fix.push({
        staffId: m.id,
        name: m.name,
        reason: `Missing: ${m.readiness.errors.map((e) => e.message).join(', ')}`,
        kind: 'FIX',
      });
    }
  }

  return [...uan, ...fix].slice(0, limit);
}

export function financialYearOf(month: number, year: number): string {
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export function ecrDueDate(month: number, year: number): string {
  const y = month === 12 ? year + 1 : year;
  const m = month === 12 ? 1 : month + 1;
  return `${y}-${String(m).padStart(2, '0')}-15`;
}

export interface EcrPayrollRow {
  month: number;
  year: number;
  isLocked: boolean;
  payGroup: string;
  staffPayGroup?: string | null;
  grossWage: number;
  epfWages: number;
  epsWages: number;
  edliWages: number;
  employeeEpf: number;
  employerEps: number;
  employerEpf: number;
  ncpDays: number;
}

export interface EcrMonthSummary {
  month: number;
  year: number;
  label: string;
  financialYear: string;
  members: number;
  epfWages: number;
  epsWages: number;
  edliWages: number;
  employeeShare: number;
  employerEps: number;
  employerEpf: number;
  employerShare: number;
  total: number;
  ncpDays: number;
  locked: boolean;
  dueDate: string;
}

/** Same inclusion rule as the ECR export: non-cash staff with wages earned. */
export function isEcrRow(r: Pick<EcrPayrollRow, 'payGroup' | 'staffPayGroup' | 'grossWage'>): boolean {
  return r.payGroup !== 'CASH' && r.staffPayGroup !== 'CASH' && r.grossWage > 0;
}

export function summarizeEcrMonths(rows: EcrPayrollRow[]): EcrMonthSummary[] {
  const byMonth = new Map<string, EcrMonthSummary>();

  for (const r of rows) {
    if (!isEcrRow(r)) continue;
    const key = `${r.year}-${r.month}`;
    let s = byMonth.get(key);
    if (!s) {
      s = {
        month: r.month,
        year: r.year,
        label: `${MONTH_NAMES[r.month - 1]} ${r.year}`,
        financialYear: financialYearOf(r.month, r.year),
        members: 0,
        epfWages: 0,
        epsWages: 0,
        edliWages: 0,
        employeeShare: 0,
        employerEps: 0,
        employerEpf: 0,
        employerShare: 0,
        total: 0,
        ncpDays: 0,
        locked: true,
        dueDate: ecrDueDate(r.month, r.year),
      };
      byMonth.set(key, s);
    }
    s.members += 1;
    s.epfWages += Math.round(r.epfWages);
    s.epsWages += Math.round(r.epsWages);
    s.edliWages += Math.round(r.edliWages);
    s.employeeShare += Math.round(r.employeeEpf);
    s.employerEps += Math.round(r.employerEps);
    s.employerEpf += Math.round(r.employerEpf);
    s.ncpDays += r.ncpDays;
    if (!r.isLocked) s.locked = false;
  }

  const list = Array.from(byMonth.values());
  for (const s of list) {
    s.employerShare = s.employerEps + s.employerEpf;
    s.total = s.employeeShare + s.employerShare;
  }
  return list.sort((a, b) => b.year - a.year || b.month - a.month);
}

const ACTION_LABELS: Record<string, { text: string; counted: boolean }> = {
  EPFO_EXPORT_REG: { text: 'Registration file exported', counted: true },
  EPFO_EXPORT_EXIT: { text: 'Exit file exported', counted: true },
  EPFO_EXPORT_KYC: { text: 'KYC file exported', counted: true },
  EPFO_MARK_FILED: { text: 'Marked as already filed', counted: true },
  EPFO_RESET_PENDING: { text: 'Reset to pending', counted: true },
  EPFO_ECR_DOWNLOAD: { text: 'ECR downloaded', counted: false },
};

export function describeEpfoAction(action: string, details: string | null): string {
  let parsed: any = null;
  if (details) {
    try {
      parsed = JSON.parse(details);
    } catch {
      parsed = null;
    }
  }

  const known = ACTION_LABELS[action];
  if (!known) {
    return `EPFO: ${action.replace(/^EPFO_/, '').toLowerCase().replace(/_/g, ' ')}`;
  }

  if (action === 'EPFO_ECR_DOWNLOAD' && parsed && typeof parsed.month === 'number' && typeof parsed.year === 'number') {
    return `${known.text} · ${MONTH_NAMES[parsed.month - 1] ?? parsed.month} ${parsed.year}`;
  }

  if (known.counted && parsed) {
    const ids = Array.isArray(parsed.exportedStaffIds)
      ? parsed.exportedStaffIds
      : Array.isArray(parsed.staffIds)
      ? parsed.staffIds
      : null;
    if (ids) return `${known.text} · ${ids.length} member${ids.length === 1 ? '' : 's'}`;
  }
  return known.text;
}
