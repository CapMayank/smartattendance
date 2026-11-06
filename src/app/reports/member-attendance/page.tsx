'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Calendar as CalendarIcon, Filter, Clock, Users, Search, UserCheck } from 'lucide-react'
import Papa from 'papaparse'

type AttendanceLog = {
  id: string
  timestamp: string
  type: string
}

type DailyRecordWithLogs = {
  id: string
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  lateMinutes: number
  workMinutes: number
  payrollEligible?: number
  isSandwiched?: boolean
  logs: AttendanceLog[]
}

type Staff = {
  id: string
  name: string
  machineId: string
  department: { name: string } | null
  designation: { name: string } | null
}

const formatLogsWithDirection = (logs: AttendanceLog[]): AttendanceLog[] => {
  if (!logs || logs.length === 0) return []
  if (logs.length === 1) {
    return [{ ...logs[0], type: logs[0].type === 'OUT' ? 'OUT' : 'IN' }]
  }

  const hasExplicitOut = logs.some(l => l.type === 'OUT')
  const hasExplicitIn = logs.some(l => l.type === 'IN')

  if (hasExplicitIn && hasExplicitOut) {
    return logs
  }

  // If logs don't distinguish IN and OUT (e.g. all IN or PUNCH), infer by sequence:
  // First punch is IN, last punch is OUT, intermediate alternate
  return logs.map((log, index) => ({
    ...log,
    type: (index === logs.length - 1 || index % 2 === 1) ? 'OUT' : 'IN'
  }))
}

export default function MemberAttendancePage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM
  
  const [loading, setLoading] = useState(false)
  const [staffData, setStaffData] = useState<Staff | null>(null)
  const [payrollData, setPayrollData] = useState<any | null>(null)
  const [dailyRecords, setDailyRecords] = useState<DailyRecordWithLogs[]>([])
  const [summary, setSummary] = useState({
    totalPresents: 0,
    totalAbsents: 0,
    totalHalfDays: 0,
    totalLateMinutes: 0,
    totalWorkMinutes: 0,
    totalPayrollEligibleDays: 0
  })

  // Fetch staff list for dropdown
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/staff')
        if (res.ok) {
          const data = await res.json()
          setStaffList(data)
          
          const params = new URLSearchParams(window.location.search)
          const paramStaffId = params.get('staffId')
          const paramMonth = params.get('month')
          
          if (paramMonth) {
            setMonth(paramMonth)
          }

          if (paramStaffId) {
            setSelectedStaffId(paramStaffId)
          } else if (data.length > 0) {
            setSelectedStaffId(data[0].id)
          }
        }
      } catch (e) {
        console.error('Failed to fetch staff list:', e)
      }
    }
    fetchStaff()
  }, [])

  // Fetch report data when staff or month changes
  useEffect(() => {
    if (!selectedStaffId || !month) return

    const fetchReport = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/reports/member-attendance?staffId=${selectedStaffId}&month=${month}`)
        if (res.ok) {
          const data = await res.json()
          setStaffData(data.staff)
          setDailyRecords(data.days)
          setSummary(data.summary)
          setPayrollData(data.payroll)
        } else {
          setStaffData(null)
          setDailyRecords([])
          setPayrollData(null)
        }
      } catch (e) {
        console.error('Failed to fetch report:', e)
        setStaffData(null)
        setDailyRecords([])
        setPayrollData(null)
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [selectedStaffId, month])

  const exportCSV = () => {
    if (!staffData || dailyRecords.length === 0) return;

    const csvData = dailyRecords.map(r => {
      // Format logs as a readable string with proper IN/OUT direction
      const formattedLogs = formatLogsWithDirection(r.logs)
      const logsStr = formattedLogs.map(log => 
        `${log.type}: ${new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
      ).join(' | ');

      return {
        'Date': new Date(r.date).toLocaleDateString(),
        'Status': r.status,
        'Check In': r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
        'Check Out': r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
        'Late By (Minutes)': r.lateMinutes,
        'Total Work Hours': (r.workMinutes / 60).toFixed(2),
        'Payroll Eligible (Days)': r.payrollEligible ?? '-',
        'Punch Logs': logsStr || 'No Punches'
      };
    });

    const filename = `Attendance_${staffData.name.replace(/\s+/g, '_')}_${month}.csv`
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto pb-24 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/20 rounded-lg border border-white/[0.04]">
            <UserCheck className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">
              Member Attendance
            </h1>
            <p className="text-muted mt-1 font-medium">Detailed daily logs for individual staff members.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={!staffData || dailyRecords.length === 0}
            className="w-full md:w-auto justify-center flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-md transition-all hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-black/30 border border-white/[0.08] rounded-lg overflow-hidden relative flex flex-col">
        
        {/* Filters */}
        <div className="bg-black/50 px-4 sm:px-6 py-4 sm:py-5 border-b border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 relative z-10">
          <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-muted" />
              </div>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-black/60 border border-white/[0.08] rounded-md pl-10 pr-4 py-2.5 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none"
              >
                <option value="" disabled>Select Staff Member</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.machineId} - {staff.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-md border border-white/[0.08]">
              <CalendarIcon className="w-5 h-5 text-blue-400 ml-2" />
              <input 
                type="month" 
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="flex-1 min-w-0 bg-transparent border-none text-white font-medium focus:ring-0 outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {staffData && !loading && (
          <div className="flex flex-col border-b border-white/[0.08] relative z-10 bg-black/40/40">
            {payrollData && summary.totalPayrollEligibleDays !== payrollData.presentDays && (
              <div className="bg-rose-500/10 border-b border-rose-500/20 p-4 flex items-start gap-3">
                <div className="mt-0.5 p-1 bg-rose-500/20 rounded-md">
                  <UserCheck className="w-4 h-4 text-rose-400" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-rose-400">Days Mismatch Detected</h4>
                  <p className="text-sm font-medium text-rose-300/70 mt-0.5">
                    The system calculated <strong>{summary.totalPayrollEligibleDays}</strong> present days based on punches, but the generated payroll has been manually set to <strong>{payrollData.presentDays}</strong> present days.
                  </p>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4 p-4 sm:p-6">
               <div className={`rounded-lg p-4 border flex flex-col items-center justify-center text-center col-span-2 md:col-span-1 ${payrollData && summary.totalPayrollEligibleDays !== payrollData.presentDays ? 'border-rose-500/30 bg-rose-500/10' : 'border-blue-500/30 bg-blue-500/10'}`}>
                  <span className={`text-2xl font-bold mb-1 ${payrollData && summary.totalPayrollEligibleDays !== payrollData.presentDays ? 'text-rose-400' : 'text-blue-400'}`}>{summary.totalPayrollEligibleDays}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${payrollData && summary.totalPayrollEligibleDays !== payrollData.presentDays ? 'text-rose-300/70' : 'text-blue-300/70'}`}>System Days</span>
               </div>
               
               {payrollData && (
                 <div className="bg-black/40/50 rounded-lg p-4 border border-white/[0.04] flex flex-col items-center justify-center text-center col-span-2 md:col-span-1 border-emerald-500/30 bg-emerald-500/10">
                    <span className="text-2xl font-bold text-emerald-400 mb-1">{payrollData.presentDays}</span>
                    <span className="text-[10px] font-bold text-emerald-300/70 uppercase tracking-wider">Paid Days</span>
                 </div>
               )}

               <div className="bg-black/40/50 rounded-lg p-4 border border-white/[0.04] flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-emerald-400 mb-1">{summary.totalPresents}</span>
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Presents</span>
               </div>
               <div className="bg-black/40/50 rounded-lg p-4 border border-white/[0.04] flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-rose-400 mb-1">{summary.totalAbsents}</span>
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Absents</span>
               </div>
               <div className="bg-black/40/50 rounded-lg p-4 border border-white/[0.04] flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-amber-400 mb-1">{summary.totalHalfDays}</span>
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Half Days</span>
               </div>
               <div className="bg-black/40/50 rounded-lg p-4 border border-white/[0.04] flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-orange-400 mb-1">{summary.totalLateMinutes}</span>
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Late (Mins)</span>
               </div>
               <div className="bg-black/40/50 rounded-lg p-4 border border-white/[0.04] flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-bold text-blue-400 mb-1">{(summary.totalWorkMinutes / 60).toFixed(1)}</span>
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">Work Hours</span>
               </div>
            </div>
          </div>
        )}

        <div className="hidden md:block overflow-x-auto min-h-[500px] relative z-10 custom-scrollbar px-4 pb-3">
          <table className="data-table text-left text-sm text-muted min-w-[900px]">
            <thead>
              <tr>
                <th className="px-6 py-3.5 sticky left-0 z-20">Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Payroll Day</th>
                <th className="px-6 py-3.5">Check In</th>
                <th className="px-6 py-3.5">Check Out</th>
                <th className="px-6 py-3.5 text-right">Late / Work Hrs</th>
                <th className="px-6 py-3.5">Punch Logs</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-16">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                      <p className="text-muted font-medium animate-pulse">Fetching member records...</p>
                    </div>
                  </td>
                </tr>
              ) : dailyRecords.length > 0 ? (
                dailyRecords.map((record) => {
                  const dateObj = new Date(record.date);
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                  const isWeekend = dayName === 'Sun' || dayName === 'Sat';

                  return (
                    <tr key={record.id} className="group">
                      <td className="px-6 py-4 sticky left-0 z-10">
                        <div className="flex flex-col">
                          <span className={`font-bold text-base whitespace-nowrap ${isWeekend ? 'text-blue-300' : 'text-slate-200'}`}>{dateStr}</span>
                          <span className={`text-xs font-bold uppercase tracking-wider mt-1 w-fit px-1.5 py-0.5 rounded ${isWeekend ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-subtle'}`}>
                            {dayName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border  ${
                          record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ' :
                          record.status === 'ABSENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 ' :
                          record.status === 'HOLIDAY' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 ' :
                          record.status === 'WEEKOFF' ? 'bg-slate-500/10 text-muted border-slate-500/20 ' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20 '
                        }`}>
                          {record.status}
                        </span>
                        {record.isSandwiched && (
                          <span className="block mt-1 text-[9px] font-bold text-rose-400 uppercase tracking-wider">Sandwiched (Unpaid)</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-bold">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs border ${
                          record.payrollEligible === 1 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          record.payrollEligible === 0.5 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-slate-500/10 text-muted border-slate-500/20'
                        }`}>
                          +{record.payrollEligible} Day
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-300">
                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-300">
                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          {record.status === 'ABSENT' || record.status === 'HOLIDAY' || record.status === 'WEEKOFF' ? (
                            <span className="text-subtle font-bold">-</span>
                          ) : record.lateMinutes > 0 ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">{record.lateMinutes} mins late</span>
                          ) : (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">On time</span>
                          )}
                          <span className="text-xs font-medium text-subtle">{(record.workMinutes / 60).toFixed(1)} hrs</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const formattedLogs = formatLogsWithDirection(record.logs);
                          return formattedLogs.length > 0 ? (
                            <div className="flex flex-wrap gap-2 max-w-xs">
                              {formattedLogs.map((log) => (
                                <span key={log.id} className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider border flex items-center gap-1 ${
                                  log.type === 'IN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                }`}>
                                  {log.type === 'IN' ? '↓' : '↑'} {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-subtle text-xs font-medium">No Punches</span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-16 text-center">
                    <UserCheck className="w-12 h-12 text-subtle mx-auto mb-3" />
                    <p className="text-slate-300 font-semibold text-lg">No Records Found</p>
                    <p className="text-subtle text-sm mt-1">Select a different staff member or month.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Day Cards */}
        <div className="md:hidden relative z-10 p-4 space-y-3">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-muted font-medium animate-pulse">Fetching member records...</p>
            </div>
          ) : dailyRecords.length > 0 ? (
            dailyRecords.map((record) => {
              const dateObj = new Date(record.date)
              const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
              const dayNum = dateObj.toLocaleDateString('en-IN', { day: '2-digit' })
              const monthShort = dateObj.toLocaleDateString('en-IN', { month: 'short' })
              const isWeekend = dayName === 'Sun' || dayName === 'Sat'
              const noWork = record.status === 'ABSENT' || record.status === 'HOLIDAY' || record.status === 'WEEKOFF'
              const accent =
                record.status === 'PRESENT' ? 'border-l-emerald-500/60' :
                record.status === 'ABSENT' ? 'border-l-rose-500/60' :
                record.status === 'HOLIDAY' ? 'border-l-blue-500/60' :
                record.status === 'WEEKOFF' ? 'border-l-slate-500/40' :
                'border-l-amber-500/60'

              return (
                <div key={record.id} className={`bg-black/40 border border-white/[0.08] border-l-4 ${accent} rounded-lg p-3.5  ${isWeekend ? 'bg-blue-500/[0.04]' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 shrink-0 text-center rounded-md py-1.5 border ${isWeekend ? 'bg-blue-500/15 border-blue-500/25' : 'bg-white/[0.04] border-white/[0.06]'}`}>
                      <p className={`text-xl font-bold leading-none ${isWeekend ? 'text-blue-300' : 'text-white'}`}>{dayNum}</p>
                      <p className="text-[9px] font-bold uppercase tracking-wider text-subtle mt-1">{monthShort}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                          record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          record.status === 'ABSENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          record.status === 'HOLIDAY' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          record.status === 'WEEKOFF' ? 'bg-slate-500/10 text-muted border-slate-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {record.status.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-subtle">{dayName}</span>
                      </div>
                      {record.isSandwiched && (
                        <p className="mt-1 text-[10px] font-bold text-rose-400 uppercase tracking-wider">Sandwiched (Unpaid)</p>
                      )}
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-lg text-xs font-bold border ${
                      record.payrollEligible === 1 ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      record.payrollEligible === 0.5 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-slate-500/10 text-muted border-slate-500/20'
                    }`}>
                      +{record.payrollEligible ?? 0}
                    </span>
                  </div>

                  {!noWork && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="bg-black/50 rounded-md border border-white/[0.04] px-2.5 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-subtle">In</p>
                        <p className="text-[13px] font-bold text-emerald-400 whitespace-nowrap">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</p>
                      </div>
                      <div className="bg-black/50 rounded-md border border-white/[0.04] px-2.5 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-subtle">Out</p>
                        <p className="text-[13px] font-bold text-rose-400 whitespace-nowrap">{record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</p>
                      </div>
                      <div className="bg-black/50 rounded-md border border-white/[0.04] px-2.5 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-subtle">Hours</p>
                        <p className="text-[13px] font-bold text-slate-200">{(record.workMinutes / 60).toFixed(1)}</p>
                      </div>
                    </div>
                  )}

                  {!noWork && (
                    <div className="flex items-center gap-2 flex-wrap mt-2.5">
                      {record.lateMinutes > 0 ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">{record.lateMinutes} mins late</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">On time</span>
                      )}
                      {(() => {
                        const formattedLogs = formatLogsWithDirection(record.logs);
                        return formattedLogs.length > 0 ? formattedLogs.map((log) => (
                          <span key={log.id} className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${
                            log.type === 'IN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          }`}>
                            {log.type === 'IN' ? '↓' : '↑'} {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                        )) : (
                          <span className="text-subtle text-[10px] font-medium">No punches</span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="py-14 text-center">
              <UserCheck className="w-12 h-12 text-subtle mx-auto mb-3" />
              <p className="text-slate-300 font-semibold text-lg">No Records Found</p>
              <p className="text-subtle text-sm mt-1">Select a different staff member or month.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
