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
  logs: AttendanceLog[]
}

type Staff = {
  id: string
  name: string
  machineId: string
  department: { name: string } | null
  designation: { name: string } | null
}

export default function MemberAttendancePage() {
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM
  
  const [loading, setLoading] = useState(false)
  const [staffData, setStaffData] = useState<Staff | null>(null)
  const [dailyRecords, setDailyRecords] = useState<DailyRecordWithLogs[]>([])
  const [summary, setSummary] = useState({
    totalPresents: 0,
    totalAbsents: 0,
    totalHalfDays: 0,
    totalLateMinutes: 0,
    totalWorkMinutes: 0
  })

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
        } else {
          setStaffData(null)
          setDailyRecords([])
        }
      } catch (e) {
        console.error('Failed to fetch report:', e)
        setStaffData(null)
        setDailyRecords([])
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [selectedStaffId, month])

  const exportCSV = () => {
    if (!staffData || dailyRecords.length === 0) return;

    const csvData = dailyRecords.map(r => {
      // Format logs as a readable string
      const logsStr = r.logs.map(log => 
        `${log.type}: ${new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
      ).join(' | ');

      return {
        'Date': new Date(r.date).toLocaleDateString(),
        'Status': r.status,
        'Check In': r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
        'Check Out': r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
        'Late By (Minutes)': r.lateMinutes,
        'Total Work Hours': (r.workMinutes / 60).toFixed(2),
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
    <div className="p-6 max-w-7xl mx-auto min-h-screen pb-20 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl border border-white/5 shadow-lg shadow-indigo-500/10">
            <UserCheck className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Member Attendance
            </h1>
            <p className="text-slate-400 mt-1 font-medium">Detailed daily logs for individual staff members.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            disabled={!staffData || dailyRecords.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        {/* Filters */}
        <div className="bg-slate-800/30 px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex-1 flex flex-col sm:flex-row gap-4 w-full">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none shadow-inner"
              >
                <option value="" disabled>Select Staff Member</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.machineId})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-950/50 p-2.5 rounded-xl border border-white/10 shadow-inner">
              <CalendarIcon className="w-5 h-5 text-indigo-400 ml-2" />
              <input 
                type="month" 
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent border-none text-white font-medium focus:ring-0 outline-none cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {staffData && !loading && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-6 border-b border-white/10 relative z-10 bg-slate-900/40">
             <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-emerald-400 mb-1">{summary.totalPresents}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Presents</span>
             </div>
             <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-rose-400 mb-1">{summary.totalAbsents}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Absents</span>
             </div>
             <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-amber-400 mb-1">{summary.totalHalfDays}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Half Days</span>
             </div>
             <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-orange-400 mb-1">{summary.totalLateMinutes}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Late (Mins)</span>
             </div>
             <div className="bg-slate-800/50 rounded-2xl p-4 border border-white/5 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-indigo-400 mb-1">{(summary.totalWorkMinutes / 60).toFixed(1)}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Work Hours</span>
             </div>
          </div>
        )}

        <div className="overflow-x-auto min-h-[500px] relative z-10 custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-400 min-w-[900px]">
            <thead className="bg-slate-950/40 text-slate-300 text-xs uppercase font-bold tracking-wider border-b border-white/10">
              <tr>
                <th className="px-6 py-5 sticky left-0 bg-slate-950/80 backdrop-blur-xl z-20 shadow-[4px_0_15px_rgba(0,0,0,0.3)]">Date</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5">Check In</th>
                <th className="px-6 py-5">Check Out</th>
                <th className="px-6 py-5 text-right">Late / Work Hrs</th>
                <th className="px-6 py-5">Punch Logs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-16">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                      <p className="text-slate-400 font-medium animate-pulse">Fetching member records...</p>
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
                    <tr key={record.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className={`px-6 py-4 sticky left-0 bg-slate-900/90 backdrop-blur-xl group-hover:bg-slate-800/90 z-10 shadow-[4px_0_15px_rgba(0,0,0,0.2)] transition-colors ${isWeekend ? 'bg-indigo-500/5 group-hover:bg-indigo-500/10' : ''}`}>
                        <div className="flex flex-col">
                          <span className={`font-bold text-base whitespace-nowrap ${isWeekend ? 'text-indigo-300' : 'text-slate-200'}`}>{dateStr}</span>
                          <span className={`text-xs font-bold uppercase tracking-widest mt-1 w-fit px-1.5 py-0.5 rounded ${isWeekend ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-500'}`}>
                            {dayName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider border shadow-sm ${
                          record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10' :
                          record.status === 'ABSENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/10' :
                          record.status === 'HOLIDAY' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-indigo-500/10' :
                          record.status === 'WEEKOFF' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20 shadow-slate-500/10' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10'
                        }`}>
                          {record.status}
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
                            <span className="text-slate-600 font-bold">-</span>
                          ) : record.lateMinutes > 0 ? (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">{record.lateMinutes} mins late</span>
                          ) : (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">On time</span>
                          )}
                          <span className="text-xs font-medium text-slate-500">{(record.workMinutes / 60).toFixed(1)} hrs</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {record.logs.length > 0 ? (
                          <div className="flex flex-wrap gap-2 max-w-xs">
                            {record.logs.map((log) => (
                              <span key={log.id} className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider border flex items-center gap-1 ${
                                log.type === 'IN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              }`}>
                                {log.type === 'IN' ? '↓' : '↑'} {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs font-medium">No Punches</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <UserCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-300 font-semibold text-lg">No Records Found</p>
                    <p className="text-slate-500 text-sm mt-1">Select a different staff member or month.</p>
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
