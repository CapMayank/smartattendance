'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Save, RefreshCw, AlertCircle, Calendar, IndianRupee, ShieldCheck, Lock, Unlock, CheckCircle, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'

function calculatePayroll(
  monthlyCtc: number,
  presentDays: number,
  totalDays: number,
  refundOfAdvance: number = 0
) {
  if (totalDays === 0) return null;
  const baseGrossWage = monthlyCtc / 1.12;
  const wagePerDay = Math.round(baseGrossWage / totalDays);
  
  let basicWage = 0;
  if (presentDays === totalDays) {
    basicWage = baseGrossWage;
  } else {
    basicWage = wagePerDay * presentDays;
  }
  
  const employeeEpf = Math.round(basicWage * 0.12);
  const netPayment = Math.round(basicWage - employeeEpf - refundOfAdvance);

  return {
    grossWage: Math.round(basicWage),
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
  
  const [edits, setEdits] = useState<Record<string, { presentDays: number, refundOfAdvance: number }>>({})

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
      data.forEach((p: any) => {
        initialEdits[p.id] = {
          presentDays: p.presentDays,
          refundOfAdvance: p.refundOfAdvance
        }
      })
      setEdits(initialEdits)
    } catch (error) {
      console.error('Failed to fetch payroll:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      const updates = payrolls.map(p => ({
        id: p.id,
        totalDays: p.totalDays,
        monthlyCtc: p.staff.payrollInfo?.monthlyCtc || 0,
        presentDays: edits[p.id]?.presentDays ?? p.presentDays,
        refundOfAdvance: edits[p.id]?.refundOfAdvance ?? p.refundOfAdvance
      }))

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
    return edits[id].presentDays !== p.presentDays || edits[id].refundOfAdvance !== p.refundOfAdvance
  })

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-screen pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/[0.05] rounded-2xl border border-white/[0.06]">
            <FileText className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100">
                Monthly Payroll
              </h1>
              {payrolls.length > 0 && (
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase border shadow-sm ${
                  isMonthLocked 
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/10' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10'
                }`}>
                  {isMonthLocked ? 'Locked' : 'Draft'}
                </span>
              )}
            </div>
            <p className="text-slate-500 mt-1 font-medium">Follow the steps below to process and export payroll</p>
          </div>
        </div>
      </div>

      {/* 5-Step Process Wizard */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 mb-8 shadow-[0_4px_24px_rgba(0,0,0,0.3)] relative overflow-hidden">
        <div className="flex flex-col xl:flex-row gap-6 relative z-10 items-stretch">
          
          {/* Step 1 & 2: Setup & Sync */}
          <div className="flex-1 bg-black/50/40 p-5 rounded-3xl border border-white/[0.04] relative">
            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white shadow-lg z-10">1</div>
            <h3 className="text-sm font-bold text-white mb-4 ml-3">Select Period</h3>
            <div className="flex flex-wrap items-end gap-3 ml-3">
              <div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-indigo-500/50 min-w-[120px]"
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
                  className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 text-white text-sm font-medium focus:outline-none focus:border-indigo-500/50 min-w-[90px]"
                >
                  {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={fetchPayroll}
                className="p-2 text-slate-400 hover:text-white bg-black/40 rounded-lg transition-all border border-white/[0.04]"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
            </div>

            <div className="mt-6 ml-3">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white shadow-lg z-10 mt-[88px]">2</div>
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
          <div className="flex-1 bg-black/50/40 p-5 rounded-3xl border border-white/[0.04] relative flex flex-col justify-between">
            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white shadow-lg z-10">3</div>
            <div className="ml-3">
              <h3 className="text-sm font-bold text-white mb-2">Review & Adjust</h3>
              <p className="text-xs text-slate-400 max-w-xs">
                Review the table below. Manually adjust <strong className="text-indigo-400">Present Days</strong> or <strong className="text-rose-400">Advances</strong> if needed.
              </p>
            </div>

            <div className="mt-6 ml-3">
              <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-black/40 border-2 border-slate-700 flex items-center justify-center text-sm font-bold text-white shadow-lg z-10 mt-[96px]">4</div>
              <h3 className="text-sm font-bold text-white mb-3">Save & Recalculate</h3>
              <button
                onClick={handleSave}
                disabled={saving || payrolls.length === 0 || isMonthLocked}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-lg transition-all shadow-lg ${
                  saveSuccess 
                    ? 'bg-emerald-500' 
                    : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400'
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
      </div>

      {/* Main Table Area */}
      <div className="bg-white/[0.025] backdrop-blur-xl border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col shadow-[0_4px_24px_rgba(0,0,0,0.3)] relative">
        <div className="hidden md:block flex-1 overflow-x-auto custom-scrollbar px-4 pb-3">
          <table className="glass-table text-sm text-left whitespace-nowrap">
            <thead>
              <tr>
                <th className="px-6 py-3.5 font-semibold tracking-wider">Staff Name</th>
                <th className="px-4 py-3.5 font-semibold tracking-wider text-center">Total / Present</th>
                <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Fixed CTC</th>
                <th className="px-4 py-3.5 font-semibold tracking-wider text-right">Gross Wage</th>
                <th className="px-4 py-3.5 font-semibold tracking-wider text-right text-rose-400/80">Employee PF</th>
                <th className="px-4 py-3.5 font-semibold tracking-wider text-right text-rose-400/80">Adv. Refund</th>
                <th className="px-6 py-3.5 font-bold tracking-wider text-right text-emerald-400">Net Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading && payrolls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin "></div>
                      <p className="text-slate-400 font-medium animate-pulse">Calculating payroll metrics...</p>
                    </div>
                  </td>
                </tr>
              ) : payrolls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
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
                  const isEdited = currentPresentDays !== p.presentDays || currentRefund !== p.refundOfAdvance;
                  
                  const monthlyCtc = p.staff.payrollInfo?.monthlyCtc || 0;
                  const calc = calculatePayroll(monthlyCtc, currentPresentDays, p.totalDays, currentRefund) || p;

                  return (
                    <tr key={p.id} className="group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-white/[0.08] text-slate-300 border border-white/[0.08] border border-white/[0.08] flex items-center justify-center text-white font-black text-xs shadow-lg shrink-0">
                            {p.staff.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-200">{p.staff.name}</div>
                            <div className="text-[10px] uppercase tracking-widest text-slate-500">{p.staff.payrollInfo?.uan || 'No UAN'}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-slate-500 font-medium">{p.totalDays}</span>
                          <span className="text-slate-600">/</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max={p.totalDays}
                            value={edits[p.id]?.presentDays ?? p.presentDays}
                            disabled={isMonthLocked}
                            onChange={(e) => setEdits({
                              ...edits, 
                              [p.id]: { ...edits[p.id], presentDays: parseFloat(e.target.value) || 0 }
                            })}
                            className={`w-16 bg-black/40 border rounded-lg px-2 py-1.5 text-center font-bold text-white focus:outline-none transition-all ${
                              isMonthLocked ? 'opacity-50 cursor-not-allowed border-white/[0.04]' :
                              edits[p.id]?.presentDays !== p.presentDays ? 'border-indigo-500/50 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)] focus:ring-2 focus:ring-indigo-500/50' : 'border-white/[0.08] hover:border-white/20 focus:ring-2 focus:ring-indigo-500/50'
                            }`}
                          />
                        </div>
                      </td>
                      
                      <td className="px-4 py-4 text-right">
                        <span className="text-slate-500 font-medium">₹{p.staff.payrollInfo?.monthlyCtc?.toLocaleString() || '0'}</span>
                      </td>
                      
                      <td className="px-4 py-4 text-right">
                        <span className="text-slate-200 font-semibold">₹{calc.grossWage.toLocaleString()}</span>
                      </td>
                      
                      <td className="px-4 py-4 text-right">
                        <span className="text-rose-400/90 font-medium">-₹{calc.employeeEpf.toLocaleString()}</span>
                      </td>
                      
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end">
                          <input
                            type="number"
                            min="0"
                            value={edits[p.id]?.refundOfAdvance ?? p.refundOfAdvance}
                            disabled={isMonthLocked}
                            onChange={(e) => setEdits({
                              ...edits, 
                              [p.id]: { ...edits[p.id], refundOfAdvance: parseFloat(e.target.value) || 0 }
                            })}
                            className={`w-24 bg-black/40 border rounded-lg px-3 py-1.5 text-right font-medium text-rose-400 focus:outline-none transition-all ${
                              isMonthLocked ? 'opacity-50 cursor-not-allowed border-white/[0.04]' :
                              edits[p.id]?.refundOfAdvance !== p.refundOfAdvance ? 'border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)] focus:ring-2 focus:ring-rose-500/50' : 'border-white/[0.08] hover:border-white/20 focus:ring-2 focus:ring-rose-500/50'
                            }`}
                          />
                        </div>
                      </td>
                      
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
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin "></div>
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
              const isEdited = currentPresentDays !== p.presentDays || currentRefund !== p.refundOfAdvance
              const monthlyCtc = p.staff.payrollInfo?.monthlyCtc || 0
              const calc = calculatePayroll(monthlyCtc, currentPresentDays, p.totalDays, currentRefund) || p
              const setPresent = (v: number) => {
                const clamped = Math.max(0, Math.min(p.totalDays, v))
                setEdits({ ...edits, [p.id]: { ...edits[p.id], refundOfAdvance: currentRefund, presentDays: clamped } })
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

                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="bg-black/50 rounded-xl border border-white/[0.04] p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Fixed CTC</p>
                      <p className="text-[13px] font-bold text-slate-400 mt-1">₹{monthlyCtc.toLocaleString()}</p>
                    </div>
                    <div className="bg-black/50 rounded-xl border border-white/[0.04] p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Gross</p>
                      <p className="text-[13px] font-bold text-slate-200 mt-1">₹{calc.grossWage.toLocaleString()}</p>
                    </div>
                    <div className="bg-black/50 rounded-xl border border-white/[0.04] p-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-rose-400/70">PF</p>
                      <p className="text-[13px] font-bold text-rose-400 mt-1">-₹{calc.employeeEpf.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Present Days <span className="text-slate-600">/ {p.totalDays}</span></p>
                      <div className="flex items-center rounded-xl border border-white/[0.08] bg-black/50 overflow-hidden">
                        <button
                          disabled={isMonthLocked}
                          onClick={() => setPresent(currentPresentDays - 0.5)}
                          className="w-10 h-11 text-lg font-bold text-slate-300 active:bg-white/10 disabled:opacity-40"
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
                          className="flex-1 min-w-0 w-full h-11 bg-transparent text-center font-bold text-white focus:outline-none disabled:opacity-50"
                        />
                        <button
                          disabled={isMonthLocked}
                          onClick={() => setPresent(currentPresentDays + 0.5)}
                          className="w-10 h-11 text-lg font-bold text-slate-300 active:bg-white/10 disabled:opacity-40"
                          aria-label="Increase present days"
                        >+</button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400/80 mb-1.5">Adv. Refund (₹)</p>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={currentRefund}
                        disabled={isMonthLocked}
                        onChange={(e) => setEdits({
                          ...edits,
                          [p.id]: { ...edits[p.id], presentDays: currentPresentDays, refundOfAdvance: parseFloat(e.target.value) || 0 }
                        })}
                        className="w-full h-11 rounded-xl border border-white/[0.08] bg-black/50 px-3 text-right font-bold text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/40 disabled:opacity-50"
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
            <span>Changes to <strong className="text-indigo-400">Present Days</strong> or <strong className="text-rose-400">Refunds</strong> require recalculation.</span>
          </div>
          <span>Showing {payrolls.length} active staff records</span>
        </div>
      </div>

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
