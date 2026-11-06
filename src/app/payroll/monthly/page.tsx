'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Save, RefreshCw, AlertCircle, IndianRupee, ShieldCheck, Lock, Unlock, Gift, Sparkles, Check, PencilLine } from 'lucide-react'
import { format } from 'date-fns'
import { Button, Card, Chip, ChipGroup, Field, Input, Modal, PageHeader, Select, StatusBadge } from '@/components/ui'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/cn'

function calculatePayroll(
  monthlyCtc: number,
  presentDays: number,
  totalDays: number,
  refundOfAdvance: number = 0,
  bonusAmount: number = 0,
  isBonusPfApplicable: boolean = false
) {
  if (totalDays === 0) return null;
  const baseGrossWage = monthlyCtc / 1.12;
  const wagePerDay = Math.round(baseGrossWage / totalDays);
  
  const validPresentDays = Math.min(presentDays, totalDays);
  let basicWage = 0;
  if (validPresentDays === totalDays) {
    basicWage = baseGrossWage;
  } else {
    basicWage = wagePerDay * validPresentDays;
  }
  
  const grossWage = Math.round(basicWage + (Number(bonusAmount) || 0));
  const epfWages = Math.round(isBonusPfApplicable ? basicWage + (Number(bonusAmount) || 0) : basicWage);
  const employeeEpf = Math.round(epfWages * 0.12);
  const netPayment = Math.round(grossWage - employeeEpf - refundOfAdvance);

  return {
    grossWage,
    basicWage: Math.round(basicWage),
    wagePerDay,
    bonusAmount: Math.round(Number(bonusAmount) || 0),
    employeeEpf,
    netPayment
  };
}

export default function MonthlyPayrollPage() {
  const [payrolls, setPayrolls] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  
  const [edits, setEdits] = useState<Record<string, {
    presentDays: number;
    refundOfAdvance: number;
    bonusDays: number;
    bonusAmount: number;
    bonusType: 'DAYS' | 'FLAT' | 'CUSTOM';
  }>>({})

  // Page-level bonus PF toggle
  const [isBonusPfApplicable, setIsBonusPfApplicable] = useState<boolean>(false)

  // Master bonus mode toggle
  const [isBonusModeEnabled, setIsBonusModeEnabled] = useState<boolean>(false)

  // Bonus modal states
  const [showBonusModal, setShowBonusModal] = useState(false)
  const [bonusDistMode, setBonusDistMode] = useState<'DAYS' | 'FLAT'>('DAYS')
  const [bonusDaysInput, setBonusDaysInput] = useState<number>(1)
  const [bonusFlatInput, setBonusFlatInput] = useState<number>(1000)

  useEffect(() => {
    fetchPayroll()
  }, [selectedMonth, selectedYear])

  const fetchPayroll = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/payroll/monthly?month=${selectedMonth}&year=${selectedYear}`)
      const data = await res.json()
      setPayrolls(data || [])
      
      const initialEdits: Record<string, any> = {}
      let initialPfApplicable = false
      const hasExistingBonuses = (data || []).some((p: any) => (p.bonusAmount || 0) > 0 || (p.bonusDays || 0) > 0)
      setIsBonusModeEnabled(hasExistingBonuses)

      data.forEach((p: any) => {
        const monthlyCtc = p.staff.payrollInfo?.monthlyCtc || 0
        const baseGrossWage = monthlyCtc / 1.12
        const wagePerDay = p.totalDays > 0 ? Math.round(baseGrossWage / p.totalDays) : 0

        let bDays = p.bonusDays ?? 0
        let bAmount = p.bonusAmount ?? 0
        let bType = p.bonusType || (bDays > 0 ? 'DAYS' : 'CUSTOM')

        // If bonusAmount exists but bonusDays is 0, infer days if wagePerDay > 0
        if (bAmount > 0 && bDays === 0 && wagePerDay > 0) {
          bDays = Math.round((bAmount / wagePerDay) * 10) / 10
        }

        if (p.isBonusPfApplicable) initialPfApplicable = true

        initialEdits[p.id] = {
          presentDays: p.presentDays,
          refundOfAdvance: p.refundOfAdvance,
          bonusDays: bDays,
          bonusAmount: bAmount,
          bonusType: bType
        }
      })
      setEdits(initialEdits)
      setIsBonusPfApplicable(initialPfApplicable)
    } catch (error) {
      console.error('Failed to fetch payroll:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle toggling Master Bonus Mode
  const handleToggleBonusMode = () => {
    if (isBonusModeEnabled) {
      const hasBonuses = Object.values(edits).some(e => (e.bonusAmount || 0) > 0 || (e.bonusDays || 0) > 0) ||
                         payrolls.some(p => (p.bonusAmount || 0) > 0 || (p.bonusDays || 0) > 0)
      
      if (hasBonuses) {
        if (!confirm('Disable bonus mode? This will reset all entered bonuses for this month to ₹0.')) {
          return
        }
        const newEdits = { ...edits }
        payrolls.forEach(p => {
          newEdits[p.id] = {
            ...(newEdits[p.id] || { presentDays: p.presentDays, refundOfAdvance: p.refundOfAdvance }),
            bonusAmount: 0,
            bonusDays: 0,
            bonusType: 'DAYS'
          }
        })
        setEdits(newEdits)
      }
      setIsBonusModeEnabled(false)
    } else {
      setIsBonusModeEnabled(true)
    }
  }

  // Handle changing bonus days for an individual employee
  const handleBonusDaysChange = (p: any, days: number) => {
    const safeDays = Math.max(0, days)
    const monthlyCtc = p.staff.payrollInfo?.monthlyCtc || 0
    const baseGrossWage = monthlyCtc / 1.12
    const wagePerDay = p.totalDays > 0 ? Math.round(baseGrossWage / p.totalDays) : 0
    const computedAmount = Math.round(wagePerDay * safeDays)

    setEdits(prev => ({
      ...prev,
      [p.id]: {
        ...(prev[p.id] || { presentDays: p.presentDays, refundOfAdvance: p.refundOfAdvance }),
        bonusDays: safeDays,
        bonusAmount: computedAmount,
        bonusType: 'DAYS'
      }
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      const updates = payrolls.map(p => {
        const itemEdit = edits[p.id]
        const monthlyCtc = p.staff.payrollInfo?.monthlyCtc || 0
        const baseGrossWage = monthlyCtc / 1.12
        const wagePerDay = p.totalDays > 0 ? Math.round(baseGrossWage / p.totalDays) : 0

        const bDays = isBonusModeEnabled ? (itemEdit?.bonusDays ?? p.bonusDays ?? 0) : 0
        let bAmount = isBonusModeEnabled ? (itemEdit?.bonusAmount ?? p.bonusAmount ?? 0) : 0
        const bType = isBonusModeEnabled ? (itemEdit?.bonusType ?? p.bonusType ?? 'DAYS') : 'DAYS'

        if (isBonusModeEnabled && bType === 'DAYS' && bDays > 0 && bAmount === 0 && wagePerDay > 0) {
          bAmount = Math.round(wagePerDay * bDays)
        }

        return {
          id: p.id,
          totalDays: p.totalDays,
          monthlyCtc,
          presentDays: itemEdit?.presentDays ?? p.presentDays,
          refundOfAdvance: itemEdit?.refundOfAdvance ?? p.refundOfAdvance,
          bonusAmount: bAmount,
          bonusDays: bDays,
          bonusType: bType,
          isBonusPfApplicable: isBonusModeEnabled ? isBonusPfApplicable : false
        }
      })

      await fetch('/api/payroll/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrolls: updates })
      })
      
      await fetchPayroll()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Failed to save payroll:', error)
      alert('Failed to recalculate')
    } finally {
      setSaving(false)
    }
  }

  const applyBonusToAll = () => {
    const newEdits = { ...edits }
    payrolls.forEach(p => {
      const monthlyCtc = p.staff.payrollInfo?.monthlyCtc || 0
      const baseGrossWage = monthlyCtc / 1.12
      const wagePerDay = p.totalDays > 0 ? Math.round(baseGrossWage / p.totalDays) : 0
      
      let amount = 0
      let days = 0
      if (bonusDistMode === 'DAYS') {
        days = bonusDaysInput
        amount = Math.round(wagePerDay * bonusDaysInput)
      } else {
        amount = bonusFlatInput
        days = 0
      }
      
      newEdits[p.id] = {
        ...(newEdits[p.id] || { presentDays: p.presentDays, refundOfAdvance: p.refundOfAdvance }),
        bonusAmount: amount,
        bonusDays: days,
        bonusType: bonusDistMode
      }
    })
    setEdits(newEdits)
    setShowBonusModal(false)
  }

  const clearAllBonuses = () => {
    const newEdits = { ...edits }
    payrolls.forEach(p => {
      newEdits[p.id] = {
        ...(newEdits[p.id] || { presentDays: p.presentDays, refundOfAdvance: p.refundOfAdvance }),
        bonusAmount: 0,
        bonusDays: 0,
        bonusType: 'DAYS'
      }
    })
    setEdits(newEdits)
    setShowBonusModal(false)
  }

  const [syncing, setSyncing] = useState(false)

  const handleSyncAttendance = async () => {
    if (!confirm('This will overwrite any manually adjusted Present Days for this month with the fresh attendance data from the logs. Are you sure you want to sync?')) return;
    
    setSyncing(true)
    try {
      const res = await fetch('/api/payroll/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, year: selectedYear })
      })
      const data = await res.json()
      if (data.success) {
        alert(`Successfully synced attendance. ${data.updatedCount} records were updated.`)
        await fetchPayroll()
      } else {
        alert('Failed to sync attendance: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to sync attendance:', error)
      alert('Failed to sync attendance due to an error.')
    } finally {
      setSyncing(false)
    }
  }

  const handleExport = (type: string) => {
    window.location.href = `/api/payroll/export/${type}?month=${selectedMonth}&year=${selectedYear}`
  }

  const isMonthLocked = payrolls.length > 0 && payrolls.every(p => p.isLocked)
  const hasUnsavedEdits = Object.keys(edits).some(id => {
    const p = payrolls.find(p => p.id === id)
    if (!p) return false
    const bonusDaysVal = isBonusModeEnabled ? (edits[id].bonusDays ?? 0) : 0
    const bonusAmountVal = isBonusModeEnabled ? (edits[id].bonusAmount ?? 0) : 0
    return (
      edits[id].presentDays !== p.presentDays ||
      edits[id].refundOfAdvance !== p.refundOfAdvance ||
      bonusAmountVal !== (p.bonusAmount ?? 0) ||
      bonusDaysVal !== (p.bonusDays ?? 0)
    )
  }) || (isBonusModeEnabled && payrolls.length > 0 && isBonusPfApplicable !== (payrolls[0]?.isBonusPfApplicable ?? false))

  const handleToggleLock = async () => {
    if (!confirm(isMonthLocked ? 'Are you sure you want to unlock this month?' : 'Are you sure you want to lock this month? Locked payrolls cannot be edited or synced.')) return;
    try {
      const res = await fetch('/api/payroll/monthly/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, year: selectedYear, isLocked: !isMonthLocked })
      })
      if (res.ok) await fetchPayroll()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Monthly payroll"
        subtitle="Follow the steps below to process, adjust bonuses, and export payroll"
        actions={payrolls.length > 0 && (
          isMonthLocked ? (
            <StatusBadge status="locked" />
          ) : (
            <span className="tone-late tint-badge inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
              <PencilLine size={13} aria-hidden="true" />
              Draft
            </span>
          )
        )}
      />

      {/* 5-Step Process Wizard */}
      <Card>
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-[1fr_1fr_1.2fr]">

          {/* Step 1 & 2: Setup & Sync */}
          <div className="flex flex-col gap-5 rounded-xl border border-line-soft bg-canvas p-4">
            <div>
              <h3 className="mb-3 flex items-center gap-2.5 text-[13.5px] font-medium text-text">
                <span className="num grid size-6 flex-none place-items-center rounded-full border border-line bg-card-hi text-xs text-muted">1</span>
                Select Period
              </h3>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Month" htmlFor="payroll-month">
                  <Select
                    id="payroll-month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="min-w-[120px]"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM')}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Year" htmlFor="payroll-year">
                  <Select
                    id="payroll-year"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="num min-w-[90px]"
                  >
                    {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                </Field>
                <Button
                  variant="secondary"
                  onClick={fetchPayroll}
                  title="Refresh Data"
                  aria-label="Refresh data"
                  className="w-10 px-0"
                >
                  <RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin text-acc-1' : ''} />
                </Button>
              </div>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2.5 text-[13.5px] font-medium text-text">
                <span className="num grid size-6 flex-none place-items-center rounded-full border border-line bg-card-hi text-xs text-muted">2</span>
                Sync Attendance
              </h3>
              <Button
                variant="secondary"
                icon={RefreshCw}
                loading={syncing}
                onClick={handleSyncAttendance}
                disabled={syncing || payrolls.length === 0 || isMonthLocked}
              >
                Sync with Logs
              </Button>
            </div>
          </div>

          {/* Step 3 & 4: Review & Recalculate */}
          <div className="flex flex-col justify-between gap-5 rounded-xl border border-line-soft bg-canvas p-4">
            <div>
              <h3 className="mb-2 flex items-center gap-2.5 text-[13.5px] font-medium text-text">
                <span className="num grid size-6 flex-none place-items-center rounded-full border border-line bg-card-hi text-xs text-muted">3</span>
                Review & Adjust
              </h3>
              <p className="mb-3 max-w-xs text-xs leading-relaxed text-muted">
                {isBonusModeEnabled ? (
                  <>Directly enter <strong className="font-medium text-late">Bonus Days</strong> per staff in the table below, or apply bulk baseline bonuses.</>
                ) : (
                  <>Review present days and advance refunds below. Toggle Bonus Mode ON if awarding bonuses this month.</>
                )}
              </p>
              {isBonusModeEnabled && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Gift}
                  onClick={() => setShowBonusModal(true)}
                  disabled={payrolls.length === 0 || isMonthLocked}
                >
                  Distribute Baseline Bonus
                </Button>
              )}
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2.5 text-[13.5px] font-medium text-text">
                <span className="num grid size-6 flex-none place-items-center rounded-full border border-line bg-card-hi text-xs text-muted">4</span>
                Save & Recalculate
              </h3>
              <Button
                variant="primary"
                icon={saveSuccess ? Check : Save}
                loading={saving}
                onClick={handleSave}
                disabled={saving || payrolls.length === 0 || isMonthLocked}
                className={saveSuccess ? 'bg-present text-ground hover:bg-present' : undefined}
              >
                {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* Step 5: Lock & Export */}
          <div className="flex-[1.2] bg-black/50/40 p-5 rounded-3xl border border-white/[0.04] relative flex flex-col justify-between">
            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white shadow-lg z-10">5</div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-white mb-3">Lock & Export</h3>
              {!isMonthLocked ? (
                <button
                  onClick={handleToggleLock}
                  disabled={payrolls.length === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all border disabled:opacity-50 mb-6 text-rose-400 bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20"
                >
                  <Lock className="w-4 h-4" />
                  Lock Payroll
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border mb-6 text-slate-400 bg-black/40 border-white/[0.08] cursor-not-allowed" title="Contact database administrator to unlock">
                  <Lock className="w-4 h-4" />
                  Payroll Locked
                </div>
              )}
              
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleExport('bank-payment')}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-all border border-emerald-500/20"
                >
                  <Download className="w-3.5 h-3.5" /> Bank Pay
                </button>
                <button
                  onClick={() => handleExport('ecr-final')}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-all border border-blue-500/20"
                >
                  <Download className="w-3.5 h-3.5" /> ECR (Excel)
                </button>
                <button
                  onClick={() => handleExport('ecr-text')}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg transition-all border border-purple-500/20"
                >
                  <FileText className="w-3.5 h-3.5" /> ECR (TXT)
                </button>
              </div>
            </div>
          </div>

        </div>
      </Card>

      {/* Master Performance / Festival Bonus Mode Switch */}
      <Card className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3.5 sm:items-center">
          <span className={cn(
            'grid size-10 flex-none place-items-center rounded-[10px] transition-colors duration-150',
            isBonusModeEnabled ? 'tone-late tint-badge' : 'border border-line bg-card-hi text-muted'
          )}>
            <Gift size={18} aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[14px] font-medium text-text">Performance / Festival Bonus:</span>
              {isBonusModeEnabled ? (
                <span className="tone-late tint-badge inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                  <Sparkles size={13} aria-hidden="true" /> Enabled for this Month
                </span>
              ) : (
                <span className="inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-card-hi px-2.5 text-xs text-muted">
                  Standard Payroll (Bonus Off)
                </span>
              )}
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
              {isBonusModeEnabled
                ? 'Bonus columns and EPF configuration are visible. You can assign performance bonus days or flat bonuses per staff member.'
                : 'Turn on to reward performance days or festive bonuses to your team for this month. Bonus controls and columns stay hidden when off.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 self-end rounded-xl border border-line bg-ground px-4 py-2.5 sm:self-center">
          <span id="bonus-mode-switch-label" className="text-xs text-muted">
            {isBonusModeEnabled ? 'Bonus Active' : 'Include Bonus'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isBonusModeEnabled}
            aria-labelledby="bonus-mode-switch-label"
            disabled={isMonthLocked}
            onClick={handleToggleBonusMode}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
              isBonusModeEnabled ? 'border-acc-2 bg-acc-2' : 'border-line bg-card-hi'
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none inline-block size-4 rounded-full bg-text',
                isBonusModeEnabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </Card>

      {/* Dedicated EPF Compliance & Bonus Configuration Banner (Visible only when Bonus Mode is Enabled) */}
      {isBonusModeEnabled && (
        <Card className={cn(
          'flex flex-col justify-between gap-4 md:flex-row md:items-center',
          isBonusPfApplicable ? 'border-acc-3' : 'border-late/30'
        )}>
          <div className="flex items-start gap-3.5 sm:items-center">
            <span className={cn(
              'grid size-10 flex-none place-items-center rounded-[10px] tint-badge transition-colors duration-150',
              isBonusPfApplicable ? 'tone-accent' : 'tone-present'
            )}>
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[14px] font-medium text-text">EPF on Bonus Setting:</span>
                {isBonusPfApplicable ? (
                  <span className="tone-accent tint-badge inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                    <Check size={13} aria-hidden="true" /> PF Applicable (12% Deducted)
                  </span>
                ) : (
                  <span className="tone-present tint-badge inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                    <Check size={13} aria-hidden="true" /> PF-Exempt (Standard EPFO Rule)
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
                {isBonusPfApplicable
                  ? 'Bonus is added into EPF Wages and attracts 12% employee PF contribution (subject to the revised ₹25,000 ceiling).'
                  : 'Standard EPFO rule: Bonuses are paid in full to employees in Net Payment without PF deduction, avoiding wage ceiling violations.'}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 self-end rounded-xl border border-line bg-ground px-4 py-2.5 md:self-center">
            <span id="bonus-pf-switch-label" className="text-xs text-muted">Deduct 12% PF:</span>
            <button
              type="button"
              role="switch"
              aria-checked={isBonusPfApplicable}
              aria-labelledby="bonus-pf-switch-label"
              disabled={isMonthLocked}
              onClick={() => setIsBonusPfApplicable(!isBonusPfApplicable)}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
                isBonusPfApplicable ? 'border-acc-2 bg-acc-2' : 'border-line bg-card-hi'
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none inline-block size-4 rounded-full bg-text',
                  isBonusPfApplicable ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          </div>
        </Card>
      )}

      {/* Main Table Area */}
      <div className="bg-black/30 backdrop-blur-2xl border border-white/[0.08] rounded-3xl overflow-hidden flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative">
        <div className="hidden md:block flex-1 overflow-x-auto custom-scrollbar px-4 pb-3">
          <table className="glass-table text-sm text-left whitespace-nowrap">
            <thead>
              <tr>
                <th className="px-6 py-3.5 font-semibold tracking-wider">Staff Name</th>
                <th className="px-4 py-3.5 font-semibold tracking-wider text-center">Total / Present</th>
                <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Fixed CTC</th>
                {isBonusModeEnabled && (
                  <th className="px-4 py-3.5 font-semibold tracking-wider text-center text-amber-400">Bonus Days & Pay</th>
                )}
                <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Gross Wage</th>
                <th className="px-4 py-3.5 font-semibold tracking-wider text-right text-rose-400/80">Employee PF</th>
                <th className="px-4 py-3.5 font-semibold tracking-wider text-right text-rose-400/80">Adv. Refund</th>
                <th className="px-6 py-3.5 font-bold tracking-wider text-right text-emerald-400">Net Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading && payrolls.length === 0 ? (
                <tr>
                  <td colSpan={isBonusModeEnabled ? 8 : 7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                      <p className="text-slate-400 font-medium animate-pulse">Calculating payroll metrics...</p>
                    </div>
                  </td>
                </tr>
              ) : payrolls.length === 0 ? (
                <tr>
                  <td colSpan={isBonusModeEnabled ? 8 : 7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <ShieldCheck className="w-12 h-12 text-slate-600 mb-2" />
                      <p className="text-slate-300 font-semibold text-lg">No Active Payrolls</p>
                      <p className="text-slate-500 text-sm max-w-sm">There are no staff members configured for payroll this month. Head to the Staff Payroll Master to configure them.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payrolls.map((p) => {
                  const currentPresentDays = edits[p.id]?.presentDays ?? p.presentDays;
                  const currentRefund = edits[p.id]?.refundOfAdvance ?? p.refundOfAdvance;
                  const currentBonusDays = isBonusModeEnabled ? (edits[p.id]?.bonusDays ?? p.bonusDays ?? 0) : 0;
                  const currentBonusAmount = isBonusModeEnabled ? (edits[p.id]?.bonusAmount ?? p.bonusAmount ?? 0) : 0;
                  
                  const monthlyCtc = p.staff.payrollInfo?.monthlyCtc || 0;
                  const calc = calculatePayroll(monthlyCtc, currentPresentDays, p.totalDays, currentRefund, currentBonusAmount, isBonusPfApplicable) || p;

                  return (
                    <tr key={p.id} className="group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 border border-white/[0.08] flex items-center justify-center text-white font-black text-xs shadow-lg shrink-0">
                            {p.staff.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">{p.staff.name}</div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-500">{p.staff.payrollInfo?.uan || 'No UAN'}</div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Total / Present Days */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-slate-500 font-medium">{p.totalDays}</span>
                          <span className="text-slate-600">/</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={p.totalDays}
                            value={currentPresentDays}
                            disabled={isMonthLocked}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const clamped = Math.max(0, Math.min(val, p.totalDays));
                              setEdits({
                                ...edits, 
                                [p.id]: { 
                                  ...(edits[p.id] || { refundOfAdvance: currentRefund, bonusDays: currentBonusDays, bonusAmount: currentBonusAmount, bonusType: 'DAYS' }),
                                  presentDays: clamped 
                                }
                              });
                            }}
                            className={`w-16 bg-black/40 border rounded-lg px-2 py-1.5 text-center font-bold text-white focus:outline-none transition-all ${
                              isMonthLocked ? 'opacity-50 cursor-not-allowed border-white/[0.04]' :
                              edits[p.id]?.presentDays !== p.presentDays ? 'border-indigo-500/50 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)] focus:ring-2 focus:ring-indigo-500/50' : 'border-white/[0.08] hover:border-white/20 focus:ring-2 focus:ring-indigo-500/50'
                            }`}
                          />
                        </div>
                      </td>
                      
                      {/* Fixed CTC */}
                      <td className="px-4 py-4 text-right">
                        <span className="text-slate-500 font-medium">₹{p.staff.payrollInfo?.monthlyCtc?.toLocaleString() || '0'}</span>
                      </td>

                      {/* Bonus Days & Live Computed Rupee Value */}
                      {isBonusModeEnabled && (
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="15"
                                value={currentBonusDays === 0 ? '' : currentBonusDays}
                                placeholder="0"
                                disabled={isMonthLocked}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleBonusDaysChange(p, val);
                                }}
                                className={`w-14 bg-black/50 border rounded-lg px-2 py-1.5 text-center font-bold text-amber-300 focus:outline-none transition-all ${
                                  isMonthLocked ? 'opacity-50 cursor-not-allowed border-white/[0.04]' :
                                  currentBonusDays > 0
                                    ? 'border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.25)] focus:ring-2 focus:ring-amber-500/50 text-amber-300'
                                    : 'border-white/[0.08] hover:border-white/20 focus:ring-2 focus:ring-amber-500/50 text-slate-400'
                                }`}
                              />
                              <span className="text-xs font-semibold text-slate-500">days</span>
                            </div>
                            {currentBonusAmount > 0 && (
                              <span className="text-[11px] font-bold text-amber-400 tracking-tight">
                                +₹{currentBonusAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      
                      {/* Gross Wage */}
                      <td className="px-4 py-4 text-right">
                        <span className="text-slate-200 font-semibold">₹{calc.grossWage.toLocaleString()}</span>
                      </td>
                      
                      {/* Employee PF */}
                      <td className="px-4 py-4 text-right">
                        <span className="text-rose-400/90 font-medium">-₹{calc.employeeEpf.toLocaleString()}</span>
                      </td>
                      
                      {/* Advance Refund */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end">
                          <input
                            type="number"
                            min="0"
                            value={currentRefund}
                            disabled={isMonthLocked}
                            onChange={(e) => setEdits({
                              ...edits, 
                              [p.id]: { 
                                ...(edits[p.id] || { presentDays: currentPresentDays, bonusDays: currentBonusDays, bonusAmount: currentBonusAmount, bonusType: 'DAYS' }),
                                refundOfAdvance: parseFloat(e.target.value) || 0 
                              }
                            })}
                            className={`w-24 bg-black/40 border rounded-lg px-3 py-1.5 text-right font-medium text-rose-400 focus:outline-none transition-all ${
                              isMonthLocked ? 'opacity-50 cursor-not-allowed border-white/[0.04]' :
                              edits[p.id]?.refundOfAdvance !== p.refundOfAdvance ? 'border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)] focus:ring-2 focus:ring-rose-500/50' : 'border-white/[0.08] hover:border-white/20 focus:ring-2 focus:ring-rose-500/50'
                            }`}
                          />
                        </div>
                      </td>
                      
                      {/* Net Payment */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg shadow-inner">
                          <span className="text-emerald-400 font-bold tracking-tight text-base">₹{calc.netPayment.toLocaleString()}</span>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden p-4 space-y-3">
          {loading && payrolls.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
              <p className="text-slate-400 font-medium animate-pulse">Calculating payroll metrics...</p>
            </div>
          ) : payrolls.length === 0 ? (
            <div className="py-14 text-center">
              <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-semibold text-lg">No Active Payrolls</p>
              <p className="text-slate-500 text-sm mt-1">No staff are configured for payroll this month.</p>
            </div>
          ) : (
            payrolls.map((p) => {
              const currentPresentDays = edits[p.id]?.presentDays ?? p.presentDays
              const currentRefund = edits[p.id]?.refundOfAdvance ?? p.refundOfAdvance
              const currentBonusDays = isBonusModeEnabled ? (edits[p.id]?.bonusDays ?? p.bonusDays ?? 0) : 0
              const currentBonusAmount = isBonusModeEnabled ? (edits[p.id]?.bonusAmount ?? p.bonusAmount ?? 0) : 0
              const isEdited = currentPresentDays !== p.presentDays || 
                               currentRefund !== p.refundOfAdvance || 
                               (isBonusModeEnabled && (currentBonusAmount !== (p.bonusAmount ?? 0) || currentBonusDays !== (p.bonusDays ?? 0)))
              const monthlyCtc = p.staff.payrollInfo?.monthlyCtc || 0
              const calc = calculatePayroll(monthlyCtc, currentPresentDays, p.totalDays, currentRefund, currentBonusAmount, isBonusPfApplicable) || p
              const setPresent = (v: number) => {
                const clamped = Math.max(0, Math.min(p.totalDays, v))
                setEdits({ 
                  ...edits, 
                  [p.id]: { 
                    ...(edits[p.id] || { refundOfAdvance: currentRefund, bonusDays: currentBonusDays, bonusAmount: currentBonusAmount, bonusType: 'DAYS' }),
                    presentDays: clamped 
                  } 
                })
              }

              return (
                <div key={p.id} className={`rounded-3xl p-4 border shadow-lg relative overflow-hidden transition-colors ${isEdited ? 'bg-indigo-500/[0.06] border-indigo-500/30' : 'bg-black/40 border-white/[0.08]'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/[0.08] flex items-center justify-center text-white font-black shrink-0">
                      {p.staff.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white leading-tight truncate">{p.staff.name}</p>
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 truncate">{p.staff.payrollInfo?.uan || 'No UAN'}</p>
                    </div>
                    {isEdited && <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Edited</span>}
                  </div>

                  <div className="mt-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">Net Payment</p>
                    <p className="text-2xl font-black text-emerald-400 mt-0.5">₹{calc.netPayment.toLocaleString()}</p>
                  </div>

                  <div className={`grid ${isBonusModeEnabled ? 'grid-cols-4' : 'grid-cols-3'} gap-2 mt-3`}>
                    <div className="bg-black/50 rounded-xl border border-white/[0.04] p-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Fixed CTC</p>
                      <p className="text-[12px] font-bold text-slate-400 mt-1 truncate">₹{monthlyCtc.toLocaleString()}</p>
                    </div>
                    {isBonusModeEnabled && (
                      <div className="bg-black/50 rounded-xl border border-white/[0.04] p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80">Bonus</p>
                        <p className="text-[12px] font-bold text-amber-300 mt-1 truncate">₹{calc.bonusAmount.toLocaleString()}</p>
                      </div>
                    )}
                    <div className="bg-black/50 rounded-xl border border-white/[0.04] p-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Gross</p>
                      <p className="text-[12px] font-bold text-slate-200 mt-1 truncate">₹{calc.grossWage.toLocaleString()}</p>
                    </div>
                    <div className="bg-black/50 rounded-xl border border-white/[0.04] p-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-rose-400/70">PF</p>
                      <p className="text-[12px] font-bold text-rose-400 mt-1 truncate">-₹{calc.employeeEpf.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className={`grid ${isBonusModeEnabled ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-4`}>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Days <span className="text-slate-600">/{p.totalDays}</span></p>
                      <div className="flex items-center rounded-xl border border-white/[0.08] bg-black/50 overflow-hidden">
                        <button
                          disabled={isMonthLocked}
                          onClick={() => setPresent(currentPresentDays - 0.5)}
                          className="w-8 h-10 text-base font-bold text-slate-300 active:bg-white/10 disabled:opacity-40"
                          aria-label="Decrease present days"
                        >−</button>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          min="0"
                          max={p.totalDays}
                          value={currentPresentDays}
                          disabled={isMonthLocked}
                          onChange={(e) => setPresent(parseFloat(e.target.value) || 0)}
                          className="flex-1 min-w-0 w-full h-10 bg-transparent text-center font-bold text-white focus:outline-none disabled:opacity-50 text-xs"
                        />
                        <button
                          disabled={isMonthLocked}
                          onClick={() => setPresent(currentPresentDays + 0.5)}
                          className="w-8 h-10 text-base font-bold text-slate-300 active:bg-white/10 disabled:opacity-40"
                          aria-label="Increase present days"
                        >+</button>
                      </div>
                    </div>
                    {isBonusModeEnabled && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 mb-1.5">Bonus Days</p>
                        <div className="flex items-center rounded-xl border border-white/[0.08] bg-black/50 overflow-hidden">
                          <button
                            disabled={isMonthLocked}
                            onClick={() => handleBonusDaysChange(p, Math.max(0, currentBonusDays - 0.5))}
                            className="w-8 h-10 text-base font-bold text-slate-300 active:bg-white/10 disabled:opacity-40"
                          >−</button>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min="0"
                            max="15"
                            value={currentBonusDays === 0 ? '' : currentBonusDays}
                            placeholder="0"
                            disabled={isMonthLocked}
                            onChange={(e) => handleBonusDaysChange(p, parseFloat(e.target.value) || 0)}
                            className="flex-1 min-w-0 w-full h-10 bg-transparent text-center font-bold text-amber-300 focus:outline-none disabled:opacity-50 text-xs"
                          />
                          <button
                            disabled={isMonthLocked}
                            onClick={() => handleBonusDaysChange(p, currentBonusDays + 0.5)}
                            className="w-8 h-10 text-base font-bold text-slate-300 active:bg-white/10 disabled:opacity-40"
                          >+</button>
                        </div>
                        {currentBonusAmount > 0 && (
                          <p className="text-[10px] font-bold text-amber-400 mt-1 text-center">+₹{currentBonusAmount.toLocaleString()}</p>
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/80 mb-1.5">Refund (₹)</p>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={currentRefund}
                        disabled={isMonthLocked}
                        onChange={(e) => setEdits({
                          ...edits,
                          [p.id]: { 
                            ...(edits[p.id] || { presentDays: currentPresentDays, bonusDays: currentBonusDays, bonusAmount: currentBonusAmount, bonusType: 'DAYS' }),
                            refundOfAdvance: parseFloat(e.target.value) || 0 
                          }
                        })}
                        className="w-full h-10 rounded-xl border border-white/[0.08] bg-black/50 px-2 text-right font-bold text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        
        {/* Helper Footer */}
        <div className="p-4 border-t border-white/[0.04] bg-black/50/40 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-indigo-400/70" />
            {isBonusModeEnabled ? (
              <span>Directly adjust <strong className="text-amber-400">Bonus Days</strong> (0-3d) per staff, and the system automatically computes exact rupees. Click Save Changes when done.</span>
            ) : (
              <span>Standard payroll mode. Adjust present days or advance refunds if needed. Click Save Changes when done.</span>
            )}
          </div>
          <span>Showing {payrolls.length} active staff records</span>
        </div>
      </div>

      {/* Bonus Baseline Modal */}
      <Modal
        open={showBonusModal}
        onClose={() => setShowBonusModal(false)}
        title="Distribute baseline bonus"
        footer={
          <>
            <Button variant="ghost" onClick={clearAllBonuses} className="mr-auto text-absent hover:text-absent">
              Clear All Bonuses
            </Button>
            <Button variant="secondary" onClick={() => setShowBonusModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={applyBonusToAll}>
              Apply to All
            </Button>
          </>
        }
      >
        <p className="mb-4 text-[12.5px] text-subtle">Batch-apply a starting bonus to all staff, then tweak individually</p>

        {/* Mode selection */}
        <div className="mb-5">
          <ChipGroup label="Bonus distribution mode">
            <Chip pressed={bonusDistMode === 'DAYS'} onClick={() => setBonusDistMode('DAYS')}>
              <Sparkles size={14} aria-hidden="true" />
              Days of Pay (0-3d)
            </Chip>
            <Chip pressed={bonusDistMode === 'FLAT'} onClick={() => setBonusDistMode('FLAT')}>
              <IndianRupee size={14} aria-hidden="true" />
              Equal Flat (₹)
            </Chip>
          </ChipGroup>
        </div>

        {/* Mode 1: Days of Wage */}
        {bonusDistMode === 'DAYS' ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[12.5px] text-muted">
                Default Bonus Days for All Members
              </p>
              <ChipGroup label="Default bonus days">
                {[1, 2, 3].map((d) => (
                  <Chip
                    key={d}
                    pressed={bonusDaysInput === d}
                    onClick={() => setBonusDaysInput(d)}
                  >
                    <span className="num">+{d}</span> {d === 1 ? 'Day' : 'Days'}
                  </Chip>
                ))}
              </ChipGroup>
              <div className="mt-3 flex items-center gap-2">
                <label htmlFor="bonus-custom-days" className="text-xs text-muted">Custom Days:</label>
                <Input
                  id="bonus-custom-days"
                  type="number"
                  step="0.5"
                  min="0"
                  max="15"
                  value={bonusDaysInput}
                  onChange={(e) => setBonusDaysInput(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="num w-20 px-2.5 text-center"
                />
                <span className="text-xs text-subtle">days of daily rate</span>
              </div>
            </div>
            <p className="tone-late tint-badge rounded-xl p-3 text-[12px] leading-relaxed">
              Sets each employee&apos;s Bonus Days to <strong className="num font-medium">{bonusDaysInput} days</strong> and auto-multiplies by their daily wage. You can still adjust each person&apos;s days in the table afterwards.
            </p>
          </div>
        ) : (
          /* Mode 2: Equal Flat Amount */
          <div className="space-y-4">
            <Field label="Flat Rupee Amount per Staff" htmlFor="bonus-flat-amount">
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-subtle" aria-hidden="true">₹</span>
                <Input
                  id="bonus-flat-amount"
                  type="number"
                  step="100"
                  min="0"
                  value={bonusFlatInput}
                  onChange={(e) => setBonusFlatInput(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="num pl-8"
                  placeholder="e.g. 1000"
                />
              </div>
            </Field>
            <ChipGroup label="Quick flat amounts">
              {[500, 1000, 2000, 5000].map((amt) => (
                <Chip
                  key={amt}
                  pressed={bonusFlatInput === amt}
                  onClick={() => setBonusFlatInput(amt)}
                  className="num"
                >
                  {formatINR(amt)}
                </Chip>
              ))}
            </ChipGroup>
          </div>
        )}
      </Modal>

      {/* Danger Zone */}
      {isMonthLocked && (
        <div className="mt-8 border border-rose-500/20 rounded-3xl bg-rose-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-rose-500/5">
          <div>
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Danger Zone
            </h3>
            <p className="text-sm text-slate-400 mt-1">Unlocking payroll will allow manual edits and synchronization again. This should only be done if an error was made.</p>
          </div>
          <button
            onClick={handleToggleLock}
            className="whitespace-nowrap px-6 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-xl border border-rose-500/20 transition-all flex items-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            Force Unlock Payroll
          </button>
        </div>
      )}
    </div>
  )
}
