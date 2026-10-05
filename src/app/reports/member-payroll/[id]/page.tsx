'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Download, FileText, Calendar as CalendarIcon, UserCheck, Wallet, IndianRupee, AlertTriangle, ExternalLink } from 'lucide-react'

type PayrollDetail = {
  payroll: any;
  systemPresentDays: number;
}

export default function PayrollDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PayrollDetail | null>(null)
  
  useEffect(() => {
    if (!id) return
    
    const fetchPayroll = async () => {
      try {
        const res = await fetch(`/api/payroll/${id}`)
        if (res.ok) {
          setData(await res.json())
        }
      } catch (e) {
        console.error('Failed to fetch payroll details:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchPayroll()
  }, [id])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
        <p className="text-slate-400 font-medium animate-pulse">Loading payroll details...</p>
      </div>
    )
  }

  if (!data || !data.payroll) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <FileText className="w-12 h-12 text-slate-600" />
        <h2 className="text-xl font-bold text-white">Payroll Record Not Found</h2>
        <button onClick={() => router.back()} className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors">
          Go Back
        </button>
      </div>
    )
  }

  const { payroll, systemPresentDays } = data
  const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('default', { month: 'long' })
  const isMismatch = systemPresentDays !== payroll.presentDays

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto min-h-screen pb-24 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/reports/member-payroll')}
            className="p-2.5 bg-black/40 hover:bg-white/10 border border-white/[0.08] rounded-xl text-slate-300 transition-colors shadow-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
              Payroll Details
            </h1>
            <p className="text-slate-400 mt-1 font-medium">{monthName} {payroll.year} • {payroll.staff.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {payroll.isLocked ? (
            <span className="px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider border bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-500/10">Locked</span>
          ) : (
            <span className="px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-wider border bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10">Draft</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        
        {/* Left Column: Days & Attendance */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-6">Attendance Summary</h3>
            
            {isMismatch && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-400">Manual Override Detected</h4>
                    <p className="text-xs text-rose-300/70 mt-1 leading-relaxed">
                      The paid days in this payroll do not match the system's recorded present days from the machine punches.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className={`p-4 rounded-2xl border ${isMismatch ? 'bg-rose-500/5 border-rose-500/20' : 'bg-white/5 border-white/[0.04]'}`}>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">System Present Days</p>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-black ${isMismatch ? 'text-rose-400' : 'text-white'}`}>{systemPresentDays}</span>
                  <span className="text-slate-500 font-medium mb-1.5">/ {payroll.totalDays}</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">Calculated directly from punches</p>
              </div>

              <div className={`p-4 rounded-2xl border ${isMismatch ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                <p className="text-xs font-bold text-emerald-300/70 uppercase tracking-wider mb-1">Paid Present Days</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-black text-emerald-400">{payroll.presentDays}</span>
                  <span className="text-slate-500 font-medium mb-1.5">/ {payroll.totalDays}</span>
                </div>
                <p className="text-[10px] text-emerald-400/50 mt-1 font-medium">Used for payroll generation</p>
              </div>
            </div>

            <button
              onClick={() => router.push(`/reports/member-attendance?staffId=${payroll.staffId}&month=${payroll.year}-${String(payroll.month).padStart(2, '0')}`)}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl transition-colors font-bold text-sm shadow-inner"
            >
              <CalendarIcon className="w-4 h-4" /> View Daily Logs <ExternalLink className="w-3 h-3 ml-1" />
            </button>
          </div>
          
          <div className="bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Staff Information</h3>
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Employee ID / Machine ID</p>
                <p className="text-sm font-medium text-slate-200 mt-0.5">{payroll.staff.machineId}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Department</p>
                <p className="text-sm font-medium text-slate-200 mt-0.5">{payroll.staff.department?.name || '-'}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Designation</p>
                <p className="text-sm font-medium text-slate-200 mt-0.5">{payroll.staff.designation?.name || '-'}</p>
              </div>
              <div className="pt-3 border-t border-white/[0.08]">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bank Account</p>
                <p className="text-sm font-medium text-slate-200 mt-0.5 break-all">{payroll.staff.payrollInfo?.bankAccount || 'Not provided'}</p>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">IFSC: {payroll.staff.payrollInfo?.ifsc || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Financial Breakdown */}
        <div className="lg:col-span-2">
          <div className="bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <h3 className="text-xl font-bold text-white mb-8 border-b border-white/[0.08] pb-4 flex items-center gap-3">
              <Wallet className="w-5 h-5 text-emerald-400" /> Financial Breakdown
            </h3>

            <div className="space-y-6">
              
              {/* Earnings */}
              <div>
                <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 bg-emerald-500/10 w-fit px-3 py-1 rounded-lg border border-emerald-500/20">Earnings</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                    <span className="text-sm text-slate-300 font-medium">Gross Wage (Prorated)</span>
                    <span className="text-sm font-bold text-white">{formatCurrency(payroll.grossWage)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl opacity-70">
                    <span className="text-sm text-slate-400 font-medium">Actual Cost To Company (CTC)</span>
                    <span className="text-sm font-bold text-slate-300">{formatCurrency(payroll.actualCtc)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h4 className="text-sm font-bold text-rose-400 uppercase tracking-wider mb-4 bg-rose-500/10 w-fit px-3 py-1 rounded-lg border border-rose-500/20">Deductions</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                    <span className="text-sm text-slate-300 font-medium">Employee EPF (12%)</span>
                    <span className="text-sm font-bold text-rose-400">-{formatCurrency(payroll.employeeEpf)}</span>
                  </div>
                  {payroll.refundOfAdvance > 0 && (
                    <div className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                      <span className="text-sm text-slate-300 font-medium">Advance Recovery</span>
                      <span className="text-sm font-bold text-rose-400">-{formatCurrency(payroll.refundOfAdvance)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total Net */}
              <div className="pt-6 mt-6 border-t border-white/[0.08]">
                <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-6 flex items-center justify-between shadow-[0_0_30px_rgba(16,185,129,0.15)] relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl"></div>
                  <div>
                    <h4 className="text-xs font-bold text-emerald-300/70 uppercase tracking-wider mb-1">Net Take Home</h4>
                    <p className="text-slate-400 text-xs font-medium">Amount to be transferred to bank</p>
                  </div>
                  <div className="text-right">
                    <span className="text-4xl font-black text-emerald-400 tracking-tight flex items-center gap-1 relative z-10">
                      {formatCurrency(payroll.netPayment)}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Employer Contributions (Info Only) */}
              <div className="mt-8 pt-6 border-t border-white/[0.04]">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> Employer Contributions (For Info)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-black/50 border border-white/[0.04] rounded-xl flex items-center justify-between">
                    <span className="text-xs text-slate-400">Employer EPF</span>
                    <span className="text-xs font-bold text-slate-300">{formatCurrency(payroll.employerEpf)}</span>
                  </div>
                  <div className="p-3 bg-black/50 border border-white/[0.04] rounded-xl flex items-center justify-between">
                    <span className="text-xs text-slate-400">Employer EPS</span>
                    <span className="text-xs font-bold text-slate-300">{formatCurrency(payroll.employerEps)}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
