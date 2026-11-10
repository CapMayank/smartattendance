'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  RotateCcw,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import {
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Input,
  Modal,
} from '@/components/ui';
import { ExportSummaryDialog, type ExportType } from './ExportSummaryDialog';
import { MarkExitDialog } from './MarkExitDialog';
import type { EpfoExitReasonCode, EpfoNextAction } from '@/lib/epfo/types';

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

interface UndoState {
  type: 'REG' | 'EXIT' | 'KYC';
  staffIds: string[];
  count: number;
}

interface EpfoMembersTabProps {
  onFixMember: (staffId: string, initialTab: 'statutory' | 'kyc', missingFields: string[]) => void;
  refreshTrigger?: number;
  onCountsUpdated?: (counts: Record<EpfoNextAction, number>) => void;
  initialData?: {
    members: EpfoMemberRow[];
    counts: Record<EpfoNextAction, number>;
  };
  initialQueue?: QueueFilter;
  initialUndo?: UndoState | null;
}

export function EpfoMembersTab({
  onFixMember,
  refreshTrigger = 0,
  onCountsUpdated,
  initialData,
  initialQueue = 'NEEDS_REGISTRATION',
  initialUndo = null,
}: EpfoMembersTabProps) {
  const [members, setMembers] = useState<EpfoMemberRow[]>(initialData?.members || []);
  const [counts, setCounts] = useState<Record<EpfoNextAction, number>>(
    initialData?.counts || {
      NEEDS_REGISTRATION: 0,
      AWAITING_UAN: 0,
      NEEDS_EXIT: 0,
      NEEDS_KYC: 0,
      UP_TO_DATE: 0,
      HIDDEN: 0,
    }
  );
  const [loading, setLoading] = useState(!initialData);
  const [activeQueue, setActiveQueue] = useState<QueueFilter>(initialQueue);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeUndo, setActiveUndo] = useState<UndoState | null>(initialUndo);

  // Inline UAN edit state for AWAITING_UAN rows
  const [uanInputs, setUanInputs] = useState<Record<string, string>>({});
  const [savingUanId, setSavingUanId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  // Dialog states
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [markFiledModalOpen, setMarkFiledModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/payroll/epfo/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        const nextCounts = data.counts || counts;
        setCounts(nextCounts);
        onCountsUpdated?.(nextCounts);
      }
    } catch (e) {
      console.error('Failed to fetch EPFO members', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData || refreshTrigger > 0) {
      fetchMembers();
    }
  }, [refreshTrigger]);

  const totalAllEpf = useMemo(() => {
    return (
      (counts.NEEDS_REGISTRATION || 0) +
      (counts.AWAITING_UAN || 0) +
      (counts.NEEDS_EXIT || 0) +
      (counts.NEEDS_KYC || 0) +
      (counts.UP_TO_DATE || 0)
    );
  }, [counts]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (activeQueue !== 'ALL' && m.nextAction !== activeQueue) {
        return false;
      }
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(s) ||
        m.machineId.toLowerCase().includes(s) ||
        (m.employeeCode && m.employeeCode.toLowerCase().includes(s)) ||
        (m.payrollInfo?.uan && m.payrollInfo.uan.includes(s))
      );
    });
  }, [members, activeQueue, search]);

  const allVisibleSelected = useMemo(() => {
    if (filteredMembers.length === 0) return false;
    return filteredMembers.every((m) => selectedIds.includes(m.id));
  }, [filteredMembers, selectedIds]);

  const handleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filteredMembers.some((m) => m.id === id)));
    } else {
      const visibleIds = filteredMembers.map((m) => m.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedMembers = useMemo(() => {
    return members.filter((m) => selectedIds.includes(m.id));
  }, [members, selectedIds]);

  const readySelectedMembers = useMemo(() => {
    return selectedMembers.filter((m) => m.readiness.ready);
  }, [selectedMembers]);

  const skippedSelectedMembers = useMemo(() => {
    return selectedMembers
      .filter((m) => !m.readiness.ready)
      .map((m) => ({
        id: m.id,
        name: m.name,
        reasons: m.readiness.errors.map((e) => e.message),
      }));
  }, [selectedMembers]);

  const handleSaveInlineUan = async (staffId: string) => {
    const uanValue = (uanInputs[staffId] || '').trim();
    if (!/^\d{12}$/.test(uanValue)) {
      alert('Please enter a valid 12-digit UAN');
      return;
    }
    setSavingUanId(staffId);
    try {
      const res = await fetch('/api/payroll/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          payrollInfo: { uan: uanValue },
        }),
      });
      if (res.ok) {
        await fetchMembers();
        setUanInputs((prev) => {
          const next = { ...prev };
          delete next[staffId];
          return next;
        });
      } else {
        alert('Failed to save UAN');
      }
    } catch {
      alert('Network error while saving UAN');
    } finally {
      setSavingUanId(null);
    }
  };

  const triggerExportFlow = () => {
    if (activeQueue === 'NEEDS_EXIT') {
      setExitModalOpen(true);
    } else {
      setExportModalOpen(true);
    }
  };

  const exportType: ExportType =
    activeQueue === 'NEEDS_EXIT'
      ? 'exit'
      : activeQueue === 'NEEDS_KYC'
      ? 'kyc'
      : 'reg';

  const downloadFileFromResponse = async (res: Response, fallbackName: string) => {
    const text = await res.text();
    const disposition = res.headers.get('Content-Disposition');
    let filename = fallbackName;
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match?.[1]) filename = match[1];
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const executeExport = async (exitCodes?: Record<string, EpfoExitReasonCode>) => {
    setExportLoading(true);
    try {
      const staffIds = readySelectedMembers.map((m) => m.id);
      const res = await fetch(`/api/payroll/epfo/export/${exportType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffIds,
          exitCodes,
          docTypes: ['B', 'P', 'A'],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' }));
        alert(err.error || 'Export failed');
        return;
      }

      await downloadFileFromResponse(res, `EPFO_${exportType.toUpperCase()}.txt`);

      let exportedCount = staffIds.length;
      const summaryHeader = res.headers.get('X-Epfo-Summary');
      if (summaryHeader) {
        try {
          const parsed = JSON.parse(summaryHeader);
          if (typeof parsed.exportedCount === 'number') {
            exportedCount = parsed.exportedCount;
          }
        } catch {
          // Ignore header parse error
        }
      }

      setActiveUndo({
        type: exportType === 'reg' ? 'REG' : exportType === 'exit' ? 'EXIT' : 'KYC',
        staffIds,
        count: exportedCount,
      });

      setExportModalOpen(false);
      setExitModalOpen(false);
      setSelectedIds([]);
      await fetchMembers();
    } catch (e) {
      console.error(e);
      alert('Network error during export');
    } finally {
      setExportLoading(false);
    }
  };

  const handleResetMemberToPending = async (member: EpfoMemberRow) => {
    const latestPeriod = member.employmentPeriods?.[0];
    const target: 'REG' | 'EXIT' | 'KYC' = latestPeriod?.epfoExitExportedAt
      ? 'EXIT'
      : member.payrollInfo?.epfoKycExportedAt && member.nextAction === 'UP_TO_DATE'
      ? 'KYC'
      : 'REG';

    setResettingId(member.id);
    try {
      const res = await fetch('/api/payroll/epfo/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffIds: [member.id],
          mode: 'RESET_PENDING',
          target,
        }),
      });
      if (res.ok) {
        await fetchMembers();
      } else {
        alert('Failed to reset member to pending');
      }
    } catch {
      alert('Error resetting member');
    } finally {
      setResettingId(null);
    }
  };

  const handleUndo = async () => {
    if (!activeUndo) return;
    setUndoLoading(true);
    try {
      const res = await fetch('/api/payroll/epfo/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffIds: activeUndo.staffIds,
          mode: 'RESET_PENDING',
          target: activeUndo.type,
        }),
      });
      if (res.ok) {
        setActiveUndo(null);
        await fetchMembers();
      } else {
        alert('Failed to undo export');
      }
    } catch {
      alert('Error during undo');
    } finally {
      setUndoLoading(false);
    }
  };

  const handleMarkAsAlreadyFiled = async () => {
    if (selectedIds.length === 0) return;
    const target =
      activeQueue === 'NEEDS_EXIT' ? 'EXIT' : activeQueue === 'NEEDS_KYC' ? 'KYC' : 'REG';

    setExportLoading(true);
    try {
      const res = await fetch('/api/payroll/epfo/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffIds: selectedIds,
          mode: 'MARK_FILED',
          target,
        }),
      });
      if (res.ok) {
        setMarkFiledModalOpen(false);
        setSelectedIds([]);
        await fetchMembers();
      } else {
        alert('Failed to mark as filed');
      }
    } catch {
      alert('Error marking as filed');
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Post-Export Undo Banner */}
      {activeUndo && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span>
              Exported {activeUndo.count}{' '}
              {activeUndo.type === 'REG'
                ? 'registration'
                : activeUndo.type === 'EXIT'
                ? 'exit'
                : 'KYC'}{' '}
              records. Timestamps recorded on staff profile.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={RotateCcw}
              onClick={handleUndo}
              loading={undoLoading}
            >
              Undo
            </Button>
            <button
              onClick={() => setActiveUndo(null)}
              className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-400"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Main Container Card */}
      <Card className="overflow-hidden !p-0">
        {/* Top Controls: Queue Chips + Search + Mark Filed */}
        <div className="flex flex-col gap-3 border-b border-line-soft px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <ChipGroup label="Compliance Queues">
              <Chip
                pressed={activeQueue === 'NEEDS_REGISTRATION'}
                onClick={() => {
                  setActiveQueue('NEEDS_REGISTRATION');
                  setSelectedIds([]);
                }}
                dot="accent"
                count={counts.NEEDS_REGISTRATION}
              >
                Needs registration
              </Chip>
              <Chip
                pressed={activeQueue === 'AWAITING_UAN'}
                onClick={() => {
                  setActiveQueue('AWAITING_UAN');
                  setSelectedIds([]);
                }}
                count={counts.AWAITING_UAN}
              >
                Awaiting UAN
              </Chip>
              <Chip
                pressed={activeQueue === 'NEEDS_EXIT'}
                onClick={() => {
                  setActiveQueue('NEEDS_EXIT');
                  setSelectedIds([]);
                }}
                dot="absent"
                count={counts.NEEDS_EXIT}
              >
                Needs exit
              </Chip>
              <Chip
                pressed={activeQueue === 'NEEDS_KYC'}
                onClick={() => {
                  setActiveQueue('NEEDS_KYC');
                  setSelectedIds([]);
                }}
                count={counts.NEEDS_KYC}
              >
                KYC pending
              </Chip>
              <Chip
                pressed={activeQueue === 'UP_TO_DATE'}
                onClick={() => {
                  setActiveQueue('UP_TO_DATE');
                  setSelectedIds([]);
                }}
                dot="present"
                count={counts.UP_TO_DATE}
              >
                Up to date
              </Chip>
              <Chip
                pressed={activeQueue === 'ALL'}
                onClick={() => {
                  setActiveQueue('ALL');
                  setSelectedIds([]);
                }}
                count={totalAllEpf}
              >
                All EPF
              </Chip>
            </ChipGroup>

            <div className="flex items-center gap-2">
              <div className="relative w-full lg:max-w-xs">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
                  aria-hidden="true"
                />
                <Input
                  type="text"
                  aria-label="Search compliance records"
                  placeholder="Search name, code, UAN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setMarkFiledModalOpen(true)}
                disabled={selectedIds.length === 0}
              >
                Mark as already filed
              </Button>
            </div>
          </div>
        </div>

        {/* Member Table (Desktop) */}
        <div className="table-wrap hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleSelectAll}
                    aria-label="Select all rows"
                    className="rounded border-line text-accent focus:ring-accent"
                  />
                </th>
                <th>Staff Member</th>
                <th>Universal Account Number (UAN)</th>
                <th>Next Action</th>
                <th>Compliance Readiness</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-subtle">
                    {loading ? (
                      'Loading EPFO member compliance records...'
                    ) : (
                      <EmptyState
                        icon={ShieldCheck}
                        title="No staff in this compliance queue"
                        hint="All members in this queue are either up to date or no matching records were found."
                      />
                    )}
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isSelected = selectedIds.includes(member.id);
                  const isAwaitingUan = member.nextAction === 'AWAITING_UAN';
                  const uanDraft =
                    uanInputs[member.id] !== undefined
                      ? uanInputs[member.id]
                      : member.payrollInfo?.uan || '';
                  const latestPeriod = member.employmentPeriods?.[0];
                  const canResetToPending = Boolean(
                    latestPeriod?.epfoJoinExportedAt ||
                      latestPeriod?.epfoExitExportedAt ||
                      member.payrollInfo?.epfoKycExportedAt
                  );

                  return (
                    <tr key={member.id} className={isSelected ? 'bg-accent/5' : ''}>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(member.id)}
                          aria-label={`Select ${member.name}`}
                          className="rounded border-line text-accent focus:ring-accent"
                        />
                      </td>

                      <td>
                        <div className="flex flex-col">
                          <span className="font-medium text-text">{member.name}</span>
                          <span className="text-xs text-subtle">
                            {member.employeeCode || `Machine #${member.machineId}`}
                            {member.department?.name ? ` · ${member.department.name}` : ''}
                          </span>
                        </div>
                      </td>

                      <td>
                        {isAwaitingUan ? (
                          <div className="flex items-center gap-1.5 max-w-xs">
                            <Input
                              type="text"
                              value={uanDraft}
                              placeholder="Enter 12-digit UAN"
                              onChange={(e) =>
                                setUanInputs({ ...uanInputs, [member.id]: e.target.value })
                              }
                              className="h-8 text-xs font-mono"
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleSaveInlineUan(member.id)}
                              loading={savingUanId === member.id}
                              disabled={!/^\d{12}$/.test(uanDraft.trim())}
                            >
                              Save UAN
                            </Button>
                          </div>
                        ) : (
                          <span className="font-mono text-xs text-text">
                            {member.payrollInfo?.uan || '—'}
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            member.nextAction === 'NEEDS_REGISTRATION'
                              ? 'tint-badge tone-accent'
                              : member.nextAction === 'NEEDS_EXIT'
                              ? 'tint-badge tone-absent'
                              : member.nextAction === 'NEEDS_KYC'
                              ? 'tint-badge tone-accent'
                              : member.nextAction === 'UP_TO_DATE'
                              ? 'tint-badge tone-present'
                              : 'tint-badge'
                          }`}
                        >
                          {member.nextAction === 'NEEDS_REGISTRATION'
                            ? member.payrollInfo?.uan?.trim()
                              ? 'Register (link)'
                              : 'Register'
                            : member.nextAction === 'AWAITING_UAN'
                            ? 'Awaiting UAN'
                            : member.nextAction === 'NEEDS_EXIT'
                            ? 'Mark exit'
                            : member.nextAction === 'NEEDS_KYC'
                            ? 'Seed KYC'
                            : 'Up to date'}
                        </span>
                      </td>

                      <td>
                        {isAwaitingUan ? (
                          <span className="text-xs text-subtle">—</span>
                        ) : member.readiness.ready ? (
                          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={14} />
                            Ready
                          </span>
                        ) : (
                          <div className="group relative flex items-center gap-2">
                            <span
                              tabIndex={0}
                              title={member.readiness.errors.map((e) => e.message).join(' • ')}
                              className="inline-flex cursor-help items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            >
                              <AlertTriangle size={12} aria-hidden="true" />
                              <span>{member.readiness.errors.length} missing</span>
                            </span>
                            <div className="pointer-events-none absolute bottom-full left-0 z-20 mb-1.5 hidden w-64 rounded-xl border border-line bg-card p-2.5 text-left text-[11px] text-text shadow-lg group-hover:block group-focus-within:block">
                              <p className="mb-1 font-semibold text-amber-600 dark:text-amber-400">
                                Missing required fields:
                              </p>
                              <ul className="list-disc space-y-0.5 pl-4 text-subtle">
                                {member.readiness.errors.map((err, i) => (
                                  <li key={i}>{err.message}</li>
                                ))}
                              </ul>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={Wrench}
                              onClick={() =>
                                onFixMember(
                                  member.id,
                                  'statutory',
                                  member.readiness.errors.map((e) => e.field)
                                )
                              }
                            >
                              Fix
                            </Button>
                          </div>
                        )}
                      </td>

                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canResetToPending && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={RotateCcw}
                              loading={resettingId === member.id}
                              onClick={() => handleResetMemberToPending(member)}
                            >
                              Reset to pending
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              onFixMember(
                                member.id,
                                'statutory',
                                member.readiness.errors.map((e) => e.field)
                              )
                            }
                          >
                            Edit Profile
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="flex flex-col gap-3 p-4 md:hidden">
          {filteredMembers.length === 0 ? (
            loading ? (
              <p className="py-8 text-center text-sm text-subtle">
                Loading EPFO member compliance records...
              </p>
            ) : (
              <EmptyState
                icon={ShieldCheck}
                title="No staff in this compliance queue"
                hint="All members in this queue are either up to date or no matching records were found."
              />
            )
          ) : (
            filteredMembers.map((member) => {
              const isSelected = selectedIds.includes(member.id);
              const isAwaitingUan = member.nextAction === 'AWAITING_UAN';
              const uanDraft =
                uanInputs[member.id] !== undefined
                  ? uanInputs[member.id]
                  : member.payrollInfo?.uan || '';
              const latestPeriod = member.employmentPeriods?.[0];
              const canResetToPending = Boolean(
                latestPeriod?.epfoJoinExportedAt ||
                  latestPeriod?.epfoExitExportedAt ||
                  member.payrollInfo?.epfoKycExportedAt
              );

              return (
                <div
                  key={member.id}
                  className={`flex flex-col gap-3 rounded-xl border p-4 ${
                    isSelected ? 'border-accent bg-accent/5' : 'border-line bg-canvas'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(member.id)}
                        aria-label={`Select ${member.name}`}
                        className="mt-1 rounded border-line text-accent focus:ring-accent"
                      />
                      <div>
                        <span className="block font-medium text-text">{member.name}</span>
                        <span className="text-xs text-subtle">
                          {member.employeeCode || `Machine #${member.machineId}`}
                          {member.department?.name ? ` · ${member.department.name}` : ''}
                        </span>
                      </div>
                    </label>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                        member.nextAction === 'NEEDS_REGISTRATION'
                          ? 'tint-badge tone-accent'
                          : member.nextAction === 'NEEDS_EXIT'
                          ? 'tint-badge tone-absent'
                          : member.nextAction === 'NEEDS_KYC'
                          ? 'tint-badge tone-accent'
                          : member.nextAction === 'UP_TO_DATE'
                          ? 'tint-badge tone-present'
                          : 'tint-badge'
                      }`}
                    >
                      {member.nextAction === 'NEEDS_REGISTRATION'
                        ? member.payrollInfo?.uan?.trim()
                          ? 'Register (link)'
                          : 'Register'
                        : member.nextAction === 'AWAITING_UAN'
                        ? 'Awaiting UAN'
                        : member.nextAction === 'NEEDS_EXIT'
                        ? 'Mark exit'
                        : member.nextAction === 'NEEDS_KYC'
                        ? 'Seed KYC'
                        : 'Up to date'}
                    </span>
                  </div>

                  {isAwaitingUan ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={uanDraft}
                        placeholder="Enter 12-digit UAN"
                        onChange={(e) =>
                          setUanInputs({ ...uanInputs, [member.id]: e.target.value })
                        }
                        className="h-8 text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSaveInlineUan(member.id)}
                        loading={savingUanId === member.id}
                        disabled={!/^\d{12}$/.test(uanDraft.trim())}
                      >
                        Save UAN
                      </Button>
                    </div>
                  ) : (
                    <div className="text-xs text-subtle">
                      UAN: <span className="font-mono text-text">{member.payrollInfo?.uan || '—'}</span>
                    </div>
                  )}

                  {!isAwaitingUan && !member.readiness.ready && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs">
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        {member.readiness.errors.length} missing:
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-subtle">
                        {member.readiness.errors.map((err, i) => (
                          <li key={i}>{err.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 border-t border-line-soft pt-2.5">
                    {canResetToPending && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={RotateCcw}
                        loading={resettingId === member.id}
                        onClick={() => handleResetMemberToPending(member)}
                      >
                        Reset to pending
                      </Button>
                    )}
                    {!isAwaitingUan && !member.readiness.ready ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={Wrench}
                        onClick={() =>
                          onFixMember(
                            member.id,
                            'statutory',
                            member.readiness.errors.map((e) => e.field)
                          )
                        }
                      >
                        Fix
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          onFixMember(
                            member.id,
                            'statutory',
                            member.readiness.errors.map((e) => e.field)
                          )
                        }
                      >
                        Edit Profile
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Export Footer when rows are selected */}
        {selectedIds.length > 0 && (
          <div className="sticky bottom-0 flex flex-col sm:flex-row items-center justify-between border-t border-line-soft bg-canvas px-5 py-3 shadow-md gap-3">
            <div className="flex items-center gap-2 text-xs text-text">
              <span className="font-medium">{selectedIds.length} selected</span>
              <span className="text-subtle">·</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {readySelectedMembers.length} ready
              </span>
              {skippedSelectedMembers.length > 0 && (
                <>
                  <span className="text-subtle">·</span>
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    {skippedSelectedMembers.length} skipped
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {activeQueue === 'NEEDS_EXIT' ? (
                <Button
                  variant="primary"
                  icon={Download}
                  onClick={triggerExportFlow}
                  disabled={readySelectedMembers.length === 0}
                  className="w-full sm:w-auto"
                >
                  Mark exit &amp; download file
                </Button>
              ) : activeQueue === 'NEEDS_KYC' ? (
                <Button
                  variant="primary"
                  icon={Download}
                  onClick={triggerExportFlow}
                  disabled={readySelectedMembers.length === 0}
                  className="w-full sm:w-auto"
                >
                  Download KYC file
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon={Download}
                  onClick={triggerExportFlow}
                  disabled={readySelectedMembers.length === 0}
                  className="w-full sm:w-auto"
                >
                  Download registration file
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Export Summary Dialog */}
      <ExportSummaryDialog
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onConfirm={() => executeExport()}
        exportType={exportType}
        readyMembers={readySelectedMembers.map((m) => ({
          id: m.id,
          name: m.name,
          uan: m.payrollInfo?.uan,
        }))}
        skippedMembers={skippedSelectedMembers}
        loading={exportLoading}
      />

      {/* Mark Exit Dialog */}
      <MarkExitDialog
        open={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        onConfirm={(exitCodes) => executeExport(exitCodes)}
        onOpenProfile={(staffId) => onFixMember(staffId, 'statutory', [])}
        members={readySelectedMembers.map((m) => ({
          id: m.id,
          name: m.name,
          uan: m.payrollInfo?.uan,
          lastWorkingDay:
            m.employmentPeriods?.find((p) => p.endDate)?.endDate || m.joiningDate || '',
          defaultExitCode: m.defaultExitCode || 'C',
          exitMonthPayrollLocked: Boolean(m.exitMonthPayrollLocked),
        }))}
        loading={exportLoading}
      />

      {/* Mark as already filed modal */}
      <Modal
        open={markFiledModalOpen}
        onClose={() => setMarkFiledModalOpen(false)}
        title="Mark Selected as Already Filed on EPFO"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => setMarkFiledModalOpen(false)}
              disabled={exportLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleMarkAsAlreadyFiled}
              loading={exportLoading}
            >
              Confirm Mark as Filed
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-text">
          <p>
            This action records that the selected {selectedIds.length} members have already been submitted on the EPFO portal outside of this app.
          </p>
          <p className="text-subtle">
            Their export status will be updated to remove them from the pending queue without generating a downloadable bulk file.
          </p>
        </div>
      </Modal>
    </div>
  );
}
