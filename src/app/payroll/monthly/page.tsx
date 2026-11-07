'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Save, RefreshCw, AlertCircle, IndianRupee, ShieldCheck, Lock, Unlock, Gift, Sparkles, Check, PencilLine, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { Avatar, Button, Card, Chip, ChipGroup, EmptyState, Field, Input, Modal, PageHeader, Select, StatusBadge } from '@/components/ui'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/cn'
import { staffPhotoUrl } from '@/lib/photo-url'

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
          <div className="flex flex-col justify-between gap-5 rounded-xl border border-line-soft bg-canvas p-4">
            <div>
              <h3 className="mb-3 flex items-center gap-2.5 text-[13.5px] font-medium text-text">
                <span className="num grid size-6 flex-none place-items-center rounded-full border border-line bg-card-hi text-xs text-muted">5</span>
                Lock & Export
              </h3>
              {!isMonthLocked ? (
                <Button
                  variant="danger"
                  icon={Lock}
                  onClick={handleToggleLock}
                  disabled={payrolls.length === 0}
                  className="mb-5"
                >
                  Lock Payroll
                </Button>
              ) : (
                <div className="mb-5 w-fit cursor-not-allowed" title="Contact database administrator to unlock">
                  <StatusBadge status="locked">Payroll Locked</StatusBadge>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Download}
                  onClick={() => handleExport('bank-payment')}
                >
                  Bank Pay
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Download}
                  onClick={() => handleExport('ecr-final')}
                >
                  ECR (Excel)
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={FileText}
                  onClick={() => handleExport('ecr-text')}
                >
                  ECR (TXT)
                </Button>
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
      <Card className="overflow-hidden !p-0">
        <div className="table-wrap hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th className="text-center">Total / Present</th>
                <th className="text-right">Fixed CTC</th>
                {isBonusModeEnabled && (
                  <th className="text-center">Bonus Days & Pay</th>
                )}
                <th className="text-right">Gross Wage</th>
                <th className="text-right">Employee PF</th>
                <th className="text-right">Adv. Refund</th>
                <th className="text-right">Net Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading && payrolls.length === 0 ? (
                <tr>
                  <td colSpan={isBonusModeEnabled ? 8 : 7}>
                    <div className="flex items-center justify-center gap-2 py-16 text-muted">
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Calculating payroll metrics...
                    </div>
                  </td>
                </tr>
              ) : payrolls.length === 0 ? (
                <tr>
                  <td colSpan={isBonusModeEnabled ? 8 : 7} className="whitespace-normal">
                    <EmptyState
                      icon={ShieldCheck}
                      title="No Active Payrolls"
                      hint="There are no staff members configured for payroll this month. Head to the Staff Payroll Master to configure them."
                    />
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
                    <tr key={p.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={p.staff.name} src={staffPhotoUrl(p.staff)} />
                          <div>
                            <div className="font-medium text-text">{p.staff.name}</div>
                            <div className="num text-[11px] text-subtle">{p.staff.payrollInfo?.uan || 'No UAN'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Total / Present Days */}
                      <td className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="num text-subtle">{p.totalDays}</span>
                          <span className="text-subtle">/</span>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            max={p.totalDays}
                            value={currentPresentDays}
                            disabled={isMonthLocked}
                            aria-label={`Present days for ${p.staff.name}`}
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
                            className={cn(
                              'num h-8 w-16 px-2 text-center',
                              !isMonthLocked && edits[p.id]?.presentDays !== p.presentDays && 'border-acc-2 text-acc-1'
                            )}
                          />
                        </div>
                      </td>

                      {/* Fixed CTC */}
                      <td className="text-right">
                        <span className="num text-subtle">{formatINR(p.staff.payrollInfo?.monthlyCtc || 0, { exact: true })}</span>
                      </td>

                      {/* Bonus Days & Live Computed Rupee Value */}
                      {isBonusModeEnabled && (
                        <td>
                          <div className="flex flex-col items-center justify-center gap-1">
                            <div className="flex items-center justify-center gap-1.5">
                              <Input
                                type="number"
                                step="0.5"
                                min="0"
                                max="15"
                                value={currentBonusDays === 0 ? '' : currentBonusDays}
                                placeholder="0"
                                disabled={isMonthLocked}
                                aria-label={`Bonus days for ${p.staff.name}`}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  handleBonusDaysChange(p, val);
                                }}
                                className={cn(
                                  'num h-8 w-14 px-2 text-center',
                                  !isMonthLocked && currentBonusDays > 0 ? 'border-late/60 text-late' : 'text-muted'
                                )}
                              />
                              <span className="text-xs text-subtle">days</span>
                            </div>
                            {currentBonusAmount > 0 && (
                              <span className="num text-[11px] text-late">
                                +{formatINR(currentBonusAmount, { exact: true })}
                              </span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Gross Wage */}
                      <td className="text-right">
                        <span className="num text-text">{formatINR(calc.grossWage, { exact: true })}</span>
                      </td>

                      {/* Employee PF */}
                      <td className="text-right">
                        <span className="num text-absent">-{formatINR(calc.employeeEpf, { exact: true })}</span>
                      </td>

                      {/* Advance Refund */}
                      <td className="text-right">
                        <div className="flex items-center justify-end">
                          <Input
                            type="number"
                            min="0"
                            value={currentRefund}
                            disabled={isMonthLocked}
                            aria-label={`Advance refund for ${p.staff.name}`}
                            onChange={(e) => setEdits({
                              ...edits,
                              [p.id]: {
                                ...(edits[p.id] || { presentDays: currentPresentDays, bonusDays: currentBonusDays, bonusAmount: currentBonusAmount, bonusType: 'DAYS' }),
                                refundOfAdvance: parseFloat(e.target.value) || 0
                              }
                            })}
                            className={cn(
                              'num h-8 w-24 px-3 text-right text-absent',
                              !isMonthLocked && edits[p.id]?.refundOfAdvance !== p.refundOfAdvance && 'border-absent/60'
                            )}
                          />
                        </div>
                      </td>

                      {/* Net Payment */}
                      <td className="text-right">
                        <span className="num text-[15px] font-medium text-present">{formatINR(calc.netPayment, { exact: true })}</span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-3 p-4 md:hidden">
          {loading && payrolls.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Calculating payroll metrics...
            </div>
          ) : payrolls.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No Active Payrolls"
              hint="No staff are configured for payroll this month."
            />
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
                <div key={p.id} className={cn('rounded-xl border p-4 transition-colors duration-150', isEdited ? 'border-acc-3 bg-card-hi' : 'border-line bg-canvas')}>
                  <div className="flex items-center gap-3">
                    <Avatar name={p.staff.name} src={staffPhotoUrl(p.staff)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium leading-tight text-text">{p.staff.name}</p>
                      <p className="num truncate text-[11px] text-subtle">{p.staff.payrollInfo?.uan || 'No UAN'}</p>
                    </div>
                    {isEdited && (
                      <span className="tone-accent tint-badge inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[11px]">
                        <PencilLine size={11} aria-hidden="true" />
                        Edited
                      </span>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-line-soft bg-ground p-3.5">
                    <p className="text-[11px] text-subtle">Net Payment</p>
                    <p className="num mt-0.5 text-2xl font-medium text-present">{formatINR(calc.netPayment, { exact: true })}</p>
                  </div>

                  <div className={`grid ${isBonusModeEnabled ? 'grid-cols-4' : 'grid-cols-3'} gap-2 mt-3`}>
                    <div className="rounded-lg border border-line-soft bg-ground p-2">
                      <p className="text-[10px] text-subtle">Fixed CTC</p>
                      <p className="num mt-1 truncate text-[12px] text-muted">{formatINR(monthlyCtc, { exact: true })}</p>
                    </div>
                    {isBonusModeEnabled && (
                      <div className="rounded-lg border border-line-soft bg-ground p-2">
                        <p className="text-[10px] text-late">Bonus</p>
                        <p className="num mt-1 truncate text-[12px] text-late">{formatINR(calc.bonusAmount, { exact: true })}</p>
                      </div>
                    )}
                    <div className="rounded-lg border border-line-soft bg-ground p-2">
                      <p className="text-[10px] text-subtle">Gross</p>
                      <p className="num mt-1 truncate text-[12px] text-text">{formatINR(calc.grossWage, { exact: true })}</p>
                    </div>
                    <div className="rounded-lg border border-line-soft bg-ground p-2">
                      <p className="text-[10px] text-absent">PF</p>
                      <p className="num mt-1 truncate text-[12px] text-absent">-{formatINR(calc.employeeEpf, { exact: true })}</p>
                    </div>
                  </div>

                  <div className={`grid ${isBonusModeEnabled ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-4`}>
                    <div>
                      <p className="mb-1.5 text-[11px] text-muted">Days <span className="num text-subtle">/{p.totalDays}</span></p>
                      <div className="flex items-center overflow-hidden rounded-[10px] border border-line bg-ground">
                        <button
                          disabled={isMonthLocked}
                          onClick={() => setPresent(currentPresentDays - 0.5)}
                          className="h-10 w-8 text-base text-muted transition-colors duration-150 hover:text-text active:bg-card-hi disabled:opacity-40"
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
                          aria-label={`Present days for ${p.staff.name}`}
                          onChange={(e) => setPresent(parseFloat(e.target.value) || 0)}
                          className="num h-10 w-full min-w-0 flex-1 bg-transparent text-center text-xs text-text disabled:opacity-50"
                        />
                        <button
                          disabled={isMonthLocked}
                          onClick={() => setPresent(currentPresentDays + 0.5)}
                          className="h-10 w-8 text-base text-muted transition-colors duration-150 hover:text-text active:bg-card-hi disabled:opacity-40"
                          aria-label="Increase present days"
                        >+</button>
                      </div>
                    </div>
                    {isBonusModeEnabled && (
                      <div>
                        <p className="mb-1.5 text-[11px] text-late">Bonus Days</p>
                        <div className="flex items-center overflow-hidden rounded-[10px] border border-line bg-ground">
                          <button
                            disabled={isMonthLocked}
                            onClick={() => handleBonusDaysChange(p, Math.max(0, currentBonusDays - 0.5))}
                            className="h-10 w-8 text-base text-muted transition-colors duration-150 hover:text-text active:bg-card-hi disabled:opacity-40"
                            aria-label="Decrease bonus days"
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
                            aria-label={`Bonus days for ${p.staff.name}`}
                            onChange={(e) => handleBonusDaysChange(p, parseFloat(e.target.value) || 0)}
                            className="num h-10 w-full min-w-0 flex-1 bg-transparent text-center text-xs text-late placeholder:text-subtle disabled:opacity-50"
                          />
                          <button
                            disabled={isMonthLocked}
                            onClick={() => handleBonusDaysChange(p, currentBonusDays + 0.5)}
                            className="h-10 w-8 text-base text-muted transition-colors duration-150 hover:text-text active:bg-card-hi disabled:opacity-40"
                            aria-label="Increase bonus days"
                          >+</button>
                        </div>
                        {currentBonusAmount > 0 && (
                          <p className="num mt-1 text-center text-[10px] text-late">+{formatINR(currentBonusAmount, { exact: true })}</p>
                        )}
                      </div>
                    )}
                    <div>
                      <label htmlFor={`refund-${p.id}`} className="mb-1.5 block text-[11px] text-absent">Refund (₹)</label>
                      <Input
                        id={`refund-${p.id}`}
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
                        className="num px-2 text-right text-xs text-absent"
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Helper Footer */}
        <div className="flex flex-col gap-2 border-t border-line-soft px-5 py-3 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="flex-none text-acc-1" aria-hidden="true" />
            {isBonusModeEnabled ? (
              <span>Directly adjust <strong className="font-medium text-late">Bonus Days</strong> (0-3d) per staff, and the system automatically computes exact rupees. Click Save Changes when done.</span>
            ) : (
              <span>Standard payroll mode. Adjust present days or advance refunds if needed. Click Save Changes when done.</span>
            )}
          </div>
          <span>Showing <span className="num">{payrolls.length}</span> active staff records</span>
        </div>
      </Card>

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
        <Card className="flex flex-col items-start justify-between gap-4 border-absent/30 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-medium text-absent">
              <AlertCircle size={18} aria-hidden="true" /> Danger Zone
            </h2>
            <p className="mt-1 text-[13px] text-muted">Unlocking payroll will allow manual edits and synchronization again. This should only be done if an error was made.</p>
          </div>
          <Button
            variant="danger"
            icon={Unlock}
            onClick={handleToggleLock}
            className="whitespace-nowrap"
          >
            Force Unlock Payroll
          </Button>
        </Card>
      )}
    </div>
  )
}
