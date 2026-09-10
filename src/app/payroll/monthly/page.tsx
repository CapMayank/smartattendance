'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Save, RefreshCw, AlertCircle, Calendar, IndianRupee, ShieldCheck } from 'lucide-react'
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

  const handleExport = (type: string) => {
    window.location.href = `/api/payroll/export/${type}?month=${selectedMonth}&year=${selectedYear}`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-white/5 shadow-lg shadow-indigo-500/10">
            <FileText className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Monthly Payroll
            </h1>
            <p className="text-slate-400 mt-1 font-medium">Generate calculations and export ECR files</p>
          </div>
        </div>

        {/* Global Save Button */}
        <button
          onClick={handleSave}
          disabled={saving || payrolls.length === 0}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-bold text-white rounded-xl transition-all shadow-lg ${
            saveSuccess 
              ? 'bg-emerald-500 shadow-emerald-500/20' 
              : 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5'
          } disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-none`}
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Recalculating...' : saveSuccess ? 'Saved & Recalculated' : 'Save & Recalculate'}
        </button>
      </div>

      {/* Glassmorphic Control Panel */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-5 mb-8 flex flex-wrap gap-6 items-end justify-between shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-wrap items-end gap-4 relative z-10">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 ml-1">
              <Calendar className="w-3.5 h-3.5" />
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 shadow-inner appearance-none min-w-[140px]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{format(new Date(2000, m - 1, 1), 'MMMM')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 ml-1">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-slate-950/50 border border-white/10 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 shadow-inner appearance-none min-w-[100px]"
            >
              {[currentDate.getFullYear() - 1, currentDate.getFullYear(), currentDate.getFullYear() + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={fetchPayroll}
            className="p-2.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 hover:shadow-md active:scale-95"
            title="Refresh Data"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>

        <div className="flex flex-wrap gap-3 relative z-10">
          <button
            onClick={() => handleExport('bank-payment')}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl transition-all border border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download className="w-4 h-4" />
            Bank Payment
          </button>
          <div className="w-px bg-white/10 mx-1"></div>
          <button
            onClick={() => handleExport('ecr-final')}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl transition-all border border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download className="w-4 h-4" />
            ECR (Excel)
          </button>
          <button
            onClick={() => handleExport('ecr-text')}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl transition-all border border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/10 hover:-translate-y-0.5 active:translate-y-0"
          >
            <FileText className="w-4 h-4" />
            ECR (TXT)
          </button>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl relative">
        <div className="flex-1 overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-400 uppercase bg-slate-950/80 sticky top-0 backdrop-blur-md z-10 shadow-sm border-b border-white/5">
              <tr>
                <th className="px-6 py-5 font-semibold tracking-wider">Staff Name</th>
                <th className="px-4 py-5 font-semibold tracking-wider text-center">Total / Present</th>
                <th className="px-4 py-5 font-semibold tracking-wider text-right">Fixed CTC</th>
                <th className="px-4 py-5 font-semibold tracking-wider text-right">Gross Wage</th>
                <th className="px-4 py-5 font-semibold tracking-wider text-right text-rose-400/80">Employee PF</th>
                <th className="px-4 py-5 font-semibold tracking-wider text-right text-rose-400/80">Adv. Refund</th>
                <th className="px-6 py-5 font-bold tracking-wider text-right text-emerald-400">Net Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {loading && payrolls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
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
                    <tr key={p.id} className={`group transition-all duration-300 ${isEdited ? 'bg-indigo-500/[0.03] hover:bg-indigo-500/[0.06]' : 'hover:bg-white/[0.02]'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-slate-400 font-bold text-xs shadow-inner">
                            {p.staff.name.charAt(0)}
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
                            onChange={(e) => setEdits({
                              ...edits, 
                              [p.id]: { ...edits[p.id], presentDays: parseFloat(e.target.value) || 0 }
                            })}
                            className={`w-16 bg-slate-950/50 border rounded-lg px-2 py-1.5 text-center font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${
                              edits[p.id]?.presentDays !== p.presentDays ? 'border-indigo-500/50 text-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'border-white/10 hover:border-white/20'
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
                            onChange={(e) => setEdits({
                              ...edits, 
                              [p.id]: { ...edits[p.id], refundOfAdvance: parseFloat(e.target.value) || 0 }
                            })}
                            className={`w-24 bg-slate-950/50 border rounded-lg px-3 py-1.5 text-right font-medium text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all ${
                              edits[p.id]?.refundOfAdvance !== p.refundOfAdvance ? 'border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.2)]' : 'border-white/10 hover:border-white/20'
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
        
        {/* Helper Footer */}
        <div className="p-4 border-t border-white/5 bg-slate-950/40 text-xs text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-indigo-400/70" />
            <span>Changes to <strong className="text-indigo-400">Present Days</strong> or <strong className="text-rose-400">Refunds</strong> require recalculation.</span>
          </div>
          <span>Showing {payrolls.length} active staff records</span>
        </div>
      </div>
    </div>
  )
}
