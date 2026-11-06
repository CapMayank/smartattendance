'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Save, RefreshCw, AlertCircle, Calendar, IndianRupee, ShieldCheck, Lock, Unlock, CheckCircle, ChevronRight, Gift, Sparkles, X, Check } from 'lucide-react'
import { format } from 'date-fns'

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-24 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-lg border border-white/[0.04]">
            <FileText className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-2xl font-semibold tracking-tight text-fg">
                Monthly Payroll
              </h1>
              {payrolls.length > 0 && (
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase border  ${
                  isMonthLocked 
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 ' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20 '
                }`}>
                  {isMonthLocked ? 'Locked' : 'Draft'}
                </span>
              )}
            </div>
            <p className="text-muted mt-1 font-medium">Follow the steps below to process, adjust bonuses, and export payroll</p>
          </div>
        </div>
      </div>

      {/* 5-Step Process Wizard */}
      <div className="bg-black/30 border border-white/[0.08] rounded-lg p-5 relative overflow-hidden">
        
        <div className="flex flex-col xl:flex-row gap-6 relative z-10 items-stretch">
          
          {/* Step 1 & 2: Setup & Sync */}
          <div className="flex-1 bg-black/50/40 p-5 rounded-lg border border-white/[0.04] relative">
            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white z-10">1</div>
            <h3 className="text-sm font-bold text-white mb-4 ml-3">Select Period</h3>
            <div className="flex flex-wrap items-end gap-3 ml-3">
              <div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-blue-500/50 min-w-[120px]"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM')}</option>
                  ))}
                </select>
              </div>
              <div>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-blue-500/50 min-w-[90px]"
                >
                  {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={fetchPayroll}
                className="p-2 text-muted hover:text-white bg-black/40 rounded-lg transition-all border border-white/[0.04]"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
              </button>
            </div>

            <div className="mt-6 ml-3">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white z-10 mt-[88px]">2</div>
              <h3 className="text-sm font-bold text-white mb-3">Sync Attendance</h3>
              <button
                onClick={handleSyncAttendance}
                disabled={syncing || payrolls.length === 0 || isMonthLocked}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-all border border-amber-500/20 disabled:opacity-50"
              >
                {syncing ? <div className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin"></div> : <RefreshCw className="w-3.5 h-3.5" />}
                Sync with Logs
              </button>
            </div>
          </div>

          <div className="hidden xl:flex items-center justify-center text-slate-700">
            <ChevronRight className="w-8 h-8" />
          </div>

          {/* Step 3 & 4: Review & Recalculate */}
          <div className="flex-1 bg-black/50/40 p-5 rounded-lg border border-white/[0.04] relative flex flex-col justify-between">
            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white z-10">3</div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-white mb-2">Review & Adjust</h3>
              <p className="text-xs text-muted max-w-xs mb-3">
                {isBonusModeEnabled ? (
                  <>Directly enter <strong className="text-amber-400">Bonus Days</strong> per staff in the table below, or apply bulk baseline bonuses.</>
                ) : (
                  <>Review present days and advance refunds below. Toggle Bonus Mode ON if awarding bonuses this month.</>
                )}
              </p>
              {isBonusModeEnabled && (
                <button
                  type="button"
                  onClick={() => setShowBonusModal(true)}
                  disabled={payrolls.length === 0 || isMonthLocked}
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 rounded-md transition-all border border-amber-500/30 disabled:opacity-50"
                >
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  Distribute Baseline Bonus
                </button>
              )}
            </div>

            <div className="mt-6 ml-3">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white z-10 mt-[96px]">4</div>
              <h3 className="text-sm font-bold text-white mb-3">Save & Recalculate</h3>
              <button
                onClick={handleSave}
                disabled={saving || payrolls.length === 0 || isMonthLocked}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-lg transition-all  ${
                  saveSuccess 
                    ? 'bg-emerald-500' 
                    : 'bg-accent hover:from-blue-500 hover:to-blue-400'
                } disabled:opacity-50`}
              >
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="hidden xl:flex items-center justify-center text-slate-700">
            <ChevronRight className="w-8 h-8" />
          </div>

          {/* Step 5: Lock & Export */}
          <div className="flex-[1.2] bg-black/50/40 p-5 rounded-lg border border-white/[0.04] relative flex flex-col justify-between">
            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white z-10">5</div>
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
                <div className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border mb-6 text-muted bg-black/40 border-white/[0.08] cursor-not-allowed" title="Contact database administrator to unlock">
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
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-blue-400 bg-blue-500/10 hover:bg-accent-hover/20 rounded-lg transition-all border border-blue-500/20"
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
      </div>

      {/* Master Performance / Festival Bonus Mode Switch */}
      <div className="p-4 sm:p-5 rounded-lg bg-black/40 border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className={`p-3 rounded-lg border shrink-0 transition-colors ${
            isBonusModeEnabled 
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 ' 
              : 'bg-white/[0.04] border-white/[0.08] text-muted'
          }`}>
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-bold text-white">Performance / Festival Bonus:</span>
              {isBonusModeEnabled ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Sparkles className="w-3 h-3" /> Enabled for this Month
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/[0.04] text-muted border border-white/[0.08]">
                  Standard Payroll (Bonus Off)
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
              {isBonusModeEnabled
                ? 'Bonus columns and EPF configuration are visible. You can assign performance bonus days or flat bonuses per staff member.'
                : 'Turn on to reward performance days or festive bonuses to your team for this month. Bonus controls and columns stay hidden when off.'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 self-end sm:self-center shrink-0 bg-black/50 px-4 py-2.5 rounded-lg border border-white/[0.08]">
          <span className="text-xs font-semibold text-slate-300">
            {isBonusModeEnabled ? 'Bonus Active' : 'Include Bonus'}
          </span>
          <button
            type="button"
            disabled={isMonthLocked}
            onClick={handleToggleBonusMode}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
              isBonusModeEnabled ? 'bg-amber-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white  ring-0 transition duration-200 ease-in-out ${
                isBonusModeEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Dedicated EPF Compliance & Bonus Configuration Banner (Visible only when Bonus Mode is Enabled) */}
      {isBonusModeEnabled && (
        <div className="p-4 sm:p-5 rounded-lg bg-black/40 border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className={`p-3 rounded-lg border shrink-0 transition-colors ${
              isBonusPfApplicable 
                ? 'bg-blue-500/15 border-blue-500/30 text-blue-400 ' 
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 '
            }`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-sm font-bold text-white">EPF on Bonus Setting:</span>
                {isBonusPfApplicable ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    <Check className="w-3 h-3" /> PF Applicable (12% Deducted)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <Check className="w-3 h-3" /> PF-Exempt (Standard EPFO Rule)
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-1 max-w-2xl leading-relaxed">
                {isBonusPfApplicable 
                  ? 'Bonus is added into EPF Wages and attracts 12% employee PF contribution (subject to the revised ₹25,000 ceiling).'
                  : 'Standard EPFO rule: Bonuses are paid in full to employees in Net Payment without PF deduction, avoiding wage ceiling violations.'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 self-end md:self-center shrink-0 bg-black/50 px-4 py-2.5 rounded-lg border border-white/[0.08]">
            <span className="text-xs font-semibold text-slate-300">Deduct 12% PF:</span>
            <button
              type="button"
              disabled={isMonthLocked}
              onClick={() => setIsBonusPfApplicable(!isBonusPfApplicable)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                isBonusPfApplicable ? 'bg-accent' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white  ring-0 transition duration-200 ease-in-out ${
                  isBonusPfApplicable ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Main Table Area */}
      <div className="bg-black/30 border border-white/[0.08] rounded-lg overflow-hidden flex flex-col relative">
        <div className="hidden md:block flex-1 overflow-x-auto custom-scrollbar px-4 pb-3">
          <table className="data-table text-sm text-left whitespace-nowrap">
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
                      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      <p className="text-muted font-medium animate-pulse">Calculating payroll metrics...</p>
                    </div>
                  </td>
                </tr>
              ) : payrolls.length === 0 ? (
                <tr>
                  <td colSpan={isBonusModeEnabled ? 8 : 7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <ShieldCheck className="w-12 h-12 text-subtle mb-2" />
                      <p className="text-slate-300 font-semibold text-lg">No Active Payrolls</p>
                      <p className="text-subtle text-sm max-w-sm">There are no staff members configured for payroll this month. Head to the Staff Payroll Master to configure them.</p>
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
                          <div className="w-10 h-10 rounded-lg bg-accent border border-white/[0.08] flex items-center justify-center text-white font-bold text-xs shrink-0">
                            {p.staff.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">{p.staff.name}</div>
                            <div className="text-[10px] uppercase tracking-wider text-subtle">{p.staff.payrollInfo?.uan || 'No UAN'}</div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Total / Present Days */}
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-subtle font-medium">{p.totalDays}</span>
                          <span className="text-subtle">/</span>
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
                              edits[p.id]?.presentDays !== p.presentDays ? 'border-blue-500/50 text-blue-400 focus:ring-2 focus:ring-blue-500/50' : 'border-white/[0.08] hover:border-white/20 focus:ring-2 focus:ring-blue-500/50'
                            }`}
                          />
                        </div>
                      </td>
                      
                      {/* Fixed CTC */}
                      <td className="px-4 py-4 text-right">
                        <span className="text-subtle font-medium">₹{p.staff.payrollInfo?.monthlyCtc?.toLocaleString() || '0'}</span>
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
                                    ? 'border-amber-500/60 focus:ring-2 focus:ring-amber-500/50 text-amber-300'
                                    : 'border-white/[0.08] hover:border-white/20 focus:ring-2 focus:ring-amber-500/50 text-muted'
                                }`}
                              />
                              <span className="text-xs font-semibold text-subtle">days</span>
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
                              edits[p.id]?.refundOfAdvance !== p.refundOfAdvance ? 'border-rose-500/50 focus:ring-2 focus:ring-rose-500/50' : 'border-white/[0.08] hover:border-white/20 focus:ring-2 focus:ring-rose-500/50'
                            }`}
                          />
                        </div>
                      </td>
                      
                      {/* Net Payment */}
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
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
              <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-muted font-medium animate-pulse">Calculating payroll metrics...</p>
            </div>
          ) : payrolls.length === 0 ? (
            <div className="py-14 text-center">
              <ShieldCheck className="w-12 h-12 text-subtle mx-auto mb-3" />
              <p className="text-slate-300 font-semibold text-lg">No Active Payrolls</p>
              <p className="text-subtle text-sm mt-1">No staff are configured for payroll this month.</p>
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
                <div key={p.id} className={`rounded-lg p-4 border  relative overflow-hidden transition-colors ${isEdited ? 'bg-blue-500/[0.06] border-blue-500/30' : 'bg-black/40 border-white/[0.08]'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-slate-800 border border-white/[0.08] flex items-center justify-center text-white font-bold shrink-0">
                      {p.staff.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white leading-tight truncate">{p.staff.name}</p>
                      <p className="text-[10px] uppercase tracking-wider text-subtle truncate">{p.staff.payrollInfo?.uan || 'No UAN'}</p>
                    </div>
                    {isEdited && <span className="shrink-0 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">Edited</span>}
                  </div>

                  <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">Net Payment</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-0.5">₹{calc.netPayment.toLocaleString()}</p>
                  </div>

                  <div className={`grid ${isBonusModeEnabled ? 'grid-cols-4' : 'grid-cols-3'} gap-2 mt-3`}>
                    <div className="bg-black/50 rounded-md border border-white/[0.04] p-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-subtle">Fixed CTC</p>
                      <p className="text-[12px] font-bold text-muted mt-1 truncate">₹{monthlyCtc.toLocaleString()}</p>
                    </div>
                    {isBonusModeEnabled && (
                      <div className="bg-black/50 rounded-md border border-white/[0.04] p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400/80">Bonus</p>
                        <p className="text-[12px] font-bold text-amber-300 mt-1 truncate">₹{calc.bonusAmount.toLocaleString()}</p>
                      </div>
                    )}
                    <div className="bg-black/50 rounded-md border border-white/[0.04] p-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-subtle">Gross</p>
                      <p className="text-[12px] font-bold text-slate-200 mt-1 truncate">₹{calc.grossWage.toLocaleString()}</p>
                    </div>
                    <div className="bg-black/50 rounded-md border border-white/[0.04] p-2">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-rose-400/70">PF</p>
                      <p className="text-[12px] font-bold text-rose-400 mt-1 truncate">-₹{calc.employeeEpf.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className={`grid ${isBonusModeEnabled ? 'grid-cols-3' : 'grid-cols-2'} gap-2 mt-4`}>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Days <span className="text-subtle">/{p.totalDays}</span></p>
                      <div className="flex items-center rounded-md border border-white/[0.08] bg-black/50 overflow-hidden">
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
                        <div className="flex items-center rounded-md border border-white/[0.08] bg-black/50 overflow-hidden">
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
                        className="w-full h-10 rounded-md border border-white/[0.08] bg-black/50 px-2 text-right font-bold text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        
        {/* Helper Footer */}
        <div className="p-4 border-t border-white/[0.04] bg-black/50/40 text-xs text-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400/70" />
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
      {showBonusModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/[0.12] rounded-lg max-w-md w-full p-6 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-lg text-amber-400">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Distribute Baseline Bonus</h3>
                  <p className="text-xs text-muted">Batch-apply a starting bonus to all staff, then tweak individually</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBonusModal(false)}
                className="p-1.5 text-muted hover:text-white rounded-md hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode selection */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 border border-white/[0.08] rounded-lg mb-5">
              <button
                type="button"
                onClick={() => setBonusDistMode('DAYS')}
                className={`py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  bonusDistMode === 'DAYS'
                    ? 'bg-amber-500 text-slate-950 '
                    : 'text-muted hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Days of Pay (0-3d)
              </button>
              <button
                type="button"
                onClick={() => setBonusDistMode('FLAT')}
                className={`py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  bonusDistMode === 'FLAT'
                    ? 'bg-amber-500 text-slate-950 '
                    : 'text-muted hover:text-white'
                }`}
              >
                <IndianRupee className="w-3.5 h-3.5" />
                Equal Flat (₹)
              </button>
            </div>

            {/* Mode 1: Days of Wage */}
            {bonusDistMode === 'DAYS' ? (
              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Default Bonus Days for All Members
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setBonusDaysInput(d)}
                        className={`flex-1 py-2 rounded-md text-xs font-bold border transition-all ${
                          bonusDaysInput === d
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300 '
                            : 'bg-black/30 border-white/[0.08] text-muted hover:border-white/20'
                        }`}
                      >
                        +{d} {d === 1 ? 'Day' : 'Days'}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-muted">Custom Days:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="15"
                      value={bonusDaysInput}
                      onChange={(e) => setBonusDaysInput(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-20 bg-black/40 border border-white/[0.12] rounded-md px-2.5 py-1.5 text-center text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-xs text-subtle">days of daily rate</span>
                  </div>
                </div>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[11px] text-amber-300/90 leading-relaxed">
                  💡 Sets each employee's Bonus Days to <strong>{bonusDaysInput} days</strong> and auto-multiplies by their daily wage. You can still adjust each person's days in the table afterwards.
                </div>
              </div>
            ) : (
              /* Mode 2: Equal Flat Amount */
              <div className="space-y-4 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Flat Rupee Amount per Staff
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle font-bold text-sm">₹</span>
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={bonusFlatInput}
                      onChange={(e) => setBonusFlatInput(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full bg-black/40 border border-white/[0.12] rounded-md pl-8 pr-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-amber-500"
                      placeholder="e.g. 1000"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[500, 1000, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setBonusFlatInput(amt)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        bonusFlatInput === amt
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-black/30 border-white/[0.08] text-muted hover:border-white/20'
                      }`}
                    >
                      ₹{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={clearAllBonuses}
                className="px-3 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
              >
                Clear All Bonuses
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBonusModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:text-white rounded-md hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={applyBonusToAll}
                  className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-md transition-all"
                >
                  Apply to All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      {isMonthLocked && (
        <div className="mt-8 border border-rose-500/20 rounded-lg bg-rose-500/5 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Danger Zone
            </h3>
            <p className="text-sm text-muted mt-1">Unlocking payroll will allow manual edits and synchronization again. This should only be done if an error was made.</p>
          </div>
          <button
            onClick={handleToggleLock}
            className="whitespace-nowrap px-6 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-md border border-rose-500/20 transition-all flex items-center gap-2"
          >
            <Unlock className="w-4 h-4" />
            Force Unlock Payroll
          </button>
        </div>
      )}
    </div>
  )
}
