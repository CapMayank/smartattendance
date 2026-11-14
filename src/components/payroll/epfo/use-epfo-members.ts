'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EpfoExitReasonCode, EpfoNextAction } from '@/lib/epfo/types';
import type { EpfoCounts } from '@/lib/epfo/summary';

export type { EpfoCounts };

export interface EpfoMemberRow {
  id: string;
  machineId: string;
  employeeCode?: string | null;
  name: string;
  department?: { name: string } | null;
  designation?: { name: string } | null;
  joiningDate?: string | null;
  payrollInfo?: any;
  employmentPeriods?: any[];
  nextAction: EpfoNextAction;
  readiness: {
    ready: boolean;
    errors: Array<{ field: string; message: string }>;
  };
  defaultExitCode?: EpfoExitReasonCode | null;
  exitMonthPayrollLocked?: boolean;
}

export type QueueFilter = EpfoNextAction | 'ALL';
export type EpfoFileType = 'reg' | 'exit' | 'kyc';

export interface UndoState {
  type: 'REG' | 'EXIT' | 'KYC';
  staffIds: string[];
  count: number;
}

export const EMPTY_COUNTS: EpfoCounts = {
  NEEDS_REGISTRATION: 0,
  AWAITING_UAN: 0,
  NEEDS_EXIT: 0,
  NEEDS_KYC: 0,
  UP_TO_DATE: 0,
  HIDDEN: 0,
};

export function isValidUan(value: string): boolean {
  return /^\d{12}$/.test(value.trim());
}

export function splitReadiness(members: EpfoMemberRow[]): {
  ready: EpfoMemberRow[];
  skipped: Array<{ id: string; name: string; reasons: string[] }>;
} {
  return {
    ready: members.filter((m) => m.readiness.ready),
    skipped: members
      .filter((m) => !m.readiness.ready)
      .map((m) => ({ id: m.id, name: m.name, reasons: m.readiness.errors.map((e) => e.message) })),
  };
}

const UNDO_TYPE: Record<EpfoFileType, UndoState['type']> = { reg: 'REG', exit: 'EXIT', kyc: 'KYC' };

async function downloadFromResponse(res: Response, fallbackName: string) {
  const text = await res.text();
  const disposition = res.headers.get('Content-Disposition');
  let filename = fallbackName;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  if (match?.[1]) filename = match[1];
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

async function postMark(body: object): Promise<boolean> {
  const res = await fetch('/api/payroll/epfo/mark', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function useEpfoMembers(opts: { refreshTrigger?: number } = {}) {
  const { refreshTrigger = 0 } = opts;
  const [members, setMembers] = useState<EpfoMemberRow[]>([]);
  const [counts, setCounts] = useState<EpfoCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingUanId, setSavingUanId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payroll/epfo/members');
      if (!res.ok) throw new Error('Could not load EPFO members');
      const data = await res.json();
      setMembers(data.members || []);
      setCounts(data.counts || EMPTY_COUNTS);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load EPFO members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, refreshTrigger]);

  const saveUan = async (staffId: string, uan: string): Promise<boolean> => {
    if (!isValidUan(uan)) {
      setError('Please enter a valid 12-digit UAN');
      return false;
    }
    setSavingUanId(staffId);
    try {
      const res = await fetch('/api/payroll/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, payrollInfo: { uan: uan.trim() } }),
      });
      if (!res.ok) {
        setError('Failed to save UAN');
        return false;
      }
      await refresh();
      return true;
    } catch {
      setError('Network error while saving UAN');
      return false;
    } finally {
      setSavingUanId(null);
    }
  };

  const exportFile = async (
    type: EpfoFileType,
    staffIds: string[],
    exitCodes?: Record<string, EpfoExitReasonCode>
  ): Promise<boolean> => {
    setBusy(true);
    try {
      const res = await fetch(`/api/payroll/epfo/export/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffIds, exitCodes, docTypes: ['P', 'A'] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        setError(err.error || 'Export failed');
        return false;
      }
      await downloadFromResponse(res, `EPFO${type.toUpperCase()}.txt`);

      let count = staffIds.length;
      try {
        const parsed = JSON.parse(res.headers.get('X-Epfo-Summary') || '');
        if (typeof parsed.exportedCount === 'number') count = parsed.exportedCount;
      } catch {
        // header missing or malformed: keep the selected count
      }
      setUndo({ type: UNDO_TYPE[type], staffIds, count });
      setError(null);
      await refresh();
      return true;
    } catch {
      setError('Network error during export');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const markFiled = async (staffIds: string[], target: UndoState['type']): Promise<boolean> => {
    setBusy(true);
    try {
      const ok = await postMark({ staffIds, mode: 'MARK_FILED', target });
      if (!ok) {
        setError('Failed to mark as filed');
        return false;
      }
      await refresh();
      return true;
    } catch {
      setError('Error marking as filed');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const resetToPending = async (member: EpfoMemberRow): Promise<boolean> => {
    const latest = member.employmentPeriods?.[0];
    const target: UndoState['type'] = latest?.epfoExitExportedAt
      ? 'EXIT'
      : member.payrollInfo?.epfoKycExportedAt && member.nextAction === 'UP_TO_DATE'
      ? 'KYC'
      : 'REG';
    setResettingId(member.id);
    try {
      const ok = await postMark({ staffIds: [member.id], mode: 'RESET_PENDING', target });
      if (!ok) {
        setError('Failed to reset member to pending');
        return false;
      }
      await refresh();
      return true;
    } catch {
      setError('Error resetting member');
      return false;
    } finally {
      setResettingId(null);
    }
  };

  const runUndo = async () => {
    if (!undo) return;
    setBusy(true);
    try {
      const ok = await postMark({ staffIds: undo.staffIds, mode: 'RESET_PENDING', target: undo.type });
      if (!ok) {
        setError('Failed to undo export');
        return;
      }
      setUndo(null);
      await refresh();
    } catch {
      setError('Error during undo');
    } finally {
      setBusy(false);
    }
  };

  return {
    members,
    counts,
    loading,
    error,
    clearError: () => setError(null),
    refresh,
    saveUan,
    exportFile,
    markFiled,
    resetToPending,
    undo,
    runUndo,
    dismissUndo: () => setUndo(null),
    busy,
    savingUanId,
    resettingId,
  };
}

export type EpfoMembersApi = ReturnType<typeof useEpfoMembers>;
