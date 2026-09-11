'use client'

import { useState, useEffect } from 'react'
import { Download, Search, Wallet, IndianRupee, FileText, Calendar as CalendarIcon } from 'lucide-react'
import Papa from 'papaparse'

type MonthlyPayroll = {
  id: string
  month: number
  year: number
  totalDays: number
  presentDays: number
  ncpDays: number
  actualCtc: number
  grossWage: number
  netPayment: number
  isLocked: boolean
}

type Staff = {
  id: string
  name: string
  machineId: string
  department: { name: string } | null
  designation: { name: string } | null
  payrollInfo: {
    monthlyCtc: number
    bankAccount: string | null
    ifsc: string | null
  } | null
}

export default function MemberPayrollPage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [staffData, setStaffData] = useState<Staff | null>(null)
  const [payrolls, setPayrolls] = useState<MonthlyPayroll[]>([])

  // Fetch staff list for dropdown
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/staff')
        if (res.ok) {
          const data = await res.json()
          setStaffList(data)
          if (data.length > 0) {
            setSelectedStaffId(data[0].id)
          }
        }
      } catch (e) {
        console.error('Failed to fetch staff list:', e)
      }
    }
    fetchStaff()
  }, [])

  // Fetch payroll history when staff changes
  useEffect(() => {
    if (!selectedStaffId) return

    const fetchReport = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/payroll/member-payroll?staffId=${selectedStaffId}`)
        if (res.ok) {
          const data = await res.json()
          setStaffData(data.staff)
          setPayrolls(data.payrolls)
        } else {
          setStaffData(null)
          setPayrolls([])
        }
      } catch (e) {
        console.error('Failed to fetch report:', e)
        setStaffData(null)
        setPayrolls([])
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [selectedStaffId])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount)
  }

  const exportCSV = () => {
    if (!staffData || payrolls.length === 0) return;

    const csvData = payrolls.map(p => {
      const monthName = new Date(p.year, p.month - 1).toLocaleString('default', { month: 'long' });
      return {
        'Period': `${monthName} ${p.year}`,
        'Total Days': p.totalDays,
        'Present/Paid Days': p.presentDays,
        'NCP Days': p.ncpDays,
        'Actual CTC': p.actualCtc,
        'Gross Wage': p.grossWage,
        'Net Payment': p.netPayment,
        'Status': p.isLocked ? 'Locked' : 'Draft'
      };
    });

    const filename = `Payroll_History_${staffData.name.replace(/\s+/g, '_')}.csv`
    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl border border-white/5 shadow-lg shadow-emerald-500/10">
            <Wallet className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Member Payroll History
            </h1>
            <p className="text-slate-400 mt-1 font-medium">View detailed payroll history for individual staff members.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={!staffData || payrolls.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        {/* Filters */}
        <div className="bg-slate-800/30 px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex-1 max-w-md relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none shadow-inner"
            >
              <option value="" disabled>Select Staff Member</option>
              {staffList.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.machineId} - {staff.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Staff Summary */}
        {staffData && !loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 border-b border-white/10 relative z-10 bg-slate-900/40">
             <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current CTC</span>
                <span className="text-2xl font-black text-emerald-400">{formatCurrency(staffData.payrollInfo?.monthlyCtc || 0)}</span>
             </div>
             <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Department / Role</span>
                <span className="text-lg font-bold text-white">{staffData.department?.name || '-'}</span>
                <span className="text-sm font-medium text-slate-400">{staffData.designation?.name || '-'}</span>
             </div>
             <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 flex flex-col">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Bank Details</span>
                <span className="text-sm font-medium text-white break-all">{staffData.payrollInfo?.bankAccount || 'Not Provided'}</span>
                <span className="text-xs font-medium text-slate-400">{staffData.payrollInfo?.ifsc || 'No IFSC'}</span>
             </div>
          </div>
        )}

        <div className="overflow-x-auto min-h-[400px] relative z-10 custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-400 min-w-[800px]">
            <thead className="bg-slate-950/40 text-slate-300 text-xs uppercase font-bold tracking-wider border-b border-white/10">
              <tr>
                <th className="px-6 py-5 sticky left-0 bg-slate-950/80 backdrop-blur-xl z-20 shadow-[4px_0_15px_rgba(0,0,0,0.3)]">Period</th>
                <th className="px-6 py-5 text-center">Days (Total / Paid)</th>
                <th className="px-6 py-5 text-right">Actual CTC</th>
                <th className="px-6 py-5 text-right">Gross Wage</th>
                <th className="px-6 py-5 text-right">Net Payment</th>
                <th className="px-6 py-5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-16">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                      <p className="text-slate-400 font-medium animate-pulse">Fetching payroll history...</p>
                    </div>
                  </td>
                </tr>
              ) : payrolls.length > 0 ? (
                payrolls.map((payroll) => {
                  const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('default', { month: 'short' });
                  
                  return (
                    <tr key={payroll.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 sticky left-0 bg-slate-900/90 backdrop-blur-xl group-hover:bg-slate-800/90 z-10 shadow-[4px_0_15px_rgba(0,0,0,0.2)] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-800 rounded-lg">
                            <CalendarIcon className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-200 text-base">{monthName} {payroll.year}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-white">{payroll.totalDays}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{payroll.presentDays} Paid</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-300">
                        {formatCurrency(payroll.actualCtc)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-300">
                        {formatCurrency(payroll.grossWage)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                          {formatCurrency(payroll.netPayment)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {payroll.isLocked ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border shadow-sm bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-500/10">
                            Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border shadow-sm bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10">
                            Draft
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-300 font-semibold text-lg">No Payroll Records Found</p>
                    <p className="text-slate-500 text-sm mt-1">Select a different staff member or generate payroll first.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
