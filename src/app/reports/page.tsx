'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Calendar as CalendarIcon, Filter, Clock, Users, BarChart3, Plus, Trash2, X, Settings2 } from 'lucide-react'
import Papa from 'papaparse'

type DailyRecord = {
  id: string
  staffId: string
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  lateMinutes: number
  workMinutes: number
  staff: {
    name: string
    machineId: string
    department: { name: string } | null
    designation: { name: string } | null
    shift: { name: string } | null
  }
}

type MonthlyRecord = {
  staff: {
    name: string
    machineId: string
    department: { name: string } | null
    designation: { name: string } | null
    shift: { name: string } | null
  }
  days: Record<string, {
    status: string
    checkIn: string | null
    checkOut: string | null
    lateMinutes: number
    workMinutes: number
  }>
  totalPresents: number
  totalAbsents: number
  totalHalfDays: number
  totalLateMinutes: number
  totalWorkMinutes: number
}

export default function ReportsPage() {
  const [viewType, setViewType] = useState<'daily' | 'monthly'>('daily')
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([])
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyRecord[]>([])
  
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7)) // YYYY-MM

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [selectedStaffName, setSelectedStaffName] = useState<string>('')
  const [rawPunches, setRawPunches] = useState<any[]>([])
  const [newPunchTime, setNewPunchTime] = useState('')
  const [newPunchType, setNewPunchType] = useState('IN')
  const [isPunchLoading, setIsPunchLoading] = useState(false)

  const openPunchModal = async (staffId: string, name: string) => {
    setSelectedStaffId(staffId)
    setSelectedStaffName(name)
    setIsModalOpen(true)
    fetchRawPunches(staffId)
  }

  const fetchRawPunches = async (staffId: string) => {
    try {
      const res = await fetch(`/api/punches?staffId=${staffId}&date=${date}`)
      if (res.ok) setRawPunches(await res.json())
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddPunch = async () => {
    if (!selectedStaffId || !newPunchTime) return
    setIsPunchLoading(true)
    try {
      const timestamp = new Date(`${date}T${newPunchTime}`).toISOString()
      const res = await fetch('/api/punches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId: selectedStaffId, timestamp, type: newPunchType })
      })
      if (res.ok) {
        await fetchRawPunches(selectedStaffId)
        setNewPunchTime('')
        fetchRecords() // refresh main table
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsPunchLoading(false)
    }
  }

  const handleDeletePunch = async (id: string) => {
    if (!selectedStaffId || !confirm('Are you sure you want to delete this punch?')) return
    setIsPunchLoading(true)
    try {
      const res = await fetch(`/api/punches?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchRawPunches(selectedStaffId)
        fetchRecords() // refresh main table
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsPunchLoading(false)
    }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      if (viewType === 'daily') {
        const res = await fetch(`/api/reports?type=daily&date=${date}`)
        if (res.ok) setDailyRecords(await res.json())
      } else {
        const res = await fetch(`/api/reports?type=monthly&month=${month}`)
        if (res.ok) setMonthlyRecords(await res.json())
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
  }, [viewType, date, month])

  const getDaysInMonth = (monthStr: string) => {
    const [year, m] = monthStr.split('-').map(Number)
    return new Date(year, m, 0).getDate()
  }

  const daysInMonth = getDaysInMonth(month)
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const exportCSV = () => {
    let csvData = [];
    let filename = '';

    if (viewType === 'daily') {
      csvData = dailyRecords.map(r => ({
        'Staff Name': r.staff.name,
        'Machine ID': r.staff.machineId,
        'Department': r.staff.department?.name || '-',
        'Designation / Role': r.staff.designation?.name || '-',
        'Shift': r.staff.shift?.name || '-',
        'Date': new Date(r.date).toLocaleDateString(),
        'Status': r.status,
        'Check In': r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
        'Check Out': r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-',
        'Late By (Minutes)': r.lateMinutes,
        'Total Work Hours': (r.workMinutes / 60).toFixed(2)
      }))
      filename = `School_Attendance_Daily_${date}.csv`
    } else {
      csvData = monthlyRecords.map(r => {
        const row: any = {
          'Staff Name': r.staff.name,
          'Machine ID': r.staff.machineId,
          'Department': r.staff.department?.name || '-',
          'Designation / Role': r.staff.designation?.name || '-'
        };
        
        daysArray.forEach(day => {
          const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
          
          const dateObj = new Date(`${dateStr}T00:00:00`);
          const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
          const colName = `${day} (${dayName})`;
          
          const dayData = r.days[dateStr];
          
          if (!dayData) {
            row[colName] = '-';
          } else if (dayData.checkIn) {
            const inTime = new Date(dayData.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            const outTime = dayData.checkOut ? new Date(dayData.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
            let statusSuffix = '';
            if (dayData.status === 'HALF_DAY') statusSuffix = ' (HD)';
            if (dayData.status === 'ABSENT') statusSuffix = ' (A)';
            if (dayData.status === 'HOLIDAY') statusSuffix = ' (H)';
            if (dayData.status === 'WEEKOFF') statusSuffix = ' (W)';
            row[colName] = `${inTime} - ${outTime}${statusSuffix}`;
          } else if (dayData.status === 'ABSENT') {
            row[colName] = 'A';
          } else if (dayData.status === 'HALF_DAY') {
            row[colName] = 'HD';
          } else if (dayData.status === 'HOLIDAY') {
            row[colName] = 'H';
          } else if (dayData.status === 'WEEKOFF') {
            row[colName] = 'W';
          } else {
            row[colName] = '-';
          }
        });

        row['Total Presents'] = r.totalPresents;
        row['Total Absents'] = r.totalAbsents;
        row['Total Half Days'] = r.totalHalfDays;
        row['Total Late (Mins)'] = r.totalLateMinutes;
        row['Total Work Hrs'] = (r.totalWorkMinutes / 60).toFixed(2);
        
        return row;
      });
      filename = `School_Attendance_Monthly_${month}.csv`
    }

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
            <FileText className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              Attendance Reports
            </h1>
            <p className="text-slate-400 mt-1 font-medium">View and export detailed attendance sheets.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        {/* Filters and View Type */}
        <div className="bg-slate-800/30 px-6 py-5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-2 bg-slate-950/80 rounded-xl p-1.5 border border-white/10 shadow-inner">
            <button
              onClick={() => setViewType('daily')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                viewType === 'daily' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" /> Daily
            </button>
            <button
              onClick={() => setViewType('monthly')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                viewType === 'monthly' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Monthly
            </button>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/50 p-2 rounded-xl border border-white/10">
            <CalendarIcon className="w-5 h-5 text-indigo-400 ml-2" />
            {viewType === 'daily' ? (
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent border-none text-white font-medium focus:ring-0 outline-none cursor-pointer"
              />
            ) : (
              <input 
                type="month" 
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-transparent border-none text-white font-medium focus:ring-0 outline-none cursor-pointer"
              />
            )}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[500px] relative z-10 custom-scrollbar">
          <table className="w-full text-left text-sm text-slate-400 min-w-[800px]">
            <thead className="bg-slate-950/40 text-slate-300 text-xs uppercase font-bold tracking-wider border-b border-white/10">
              {viewType === 'daily' ? (
                <tr>
                  <th className="px-6 py-5 sticky left-0 bg-slate-950/80 backdrop-blur-xl z-20 shadow-[4px_0_15px_rgba(0,0,0,0.3)]">Staff Details</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5">Check In</th>
                  <th className="px-6 py-5">Check Out</th>
                  <th className="px-6 py-5 text-right">Late By / Work Hrs</th>
                  <th className="px-6 py-5 text-center">Manage</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-5 sticky left-0 bg-slate-950/80 backdrop-blur-xl z-20 shadow-[4px_0_15px_rgba(0,0,0,0.3)] whitespace-nowrap">Staff Details</th>
                  {daysArray.map(day => {
                    const dateObj = new Date(`${month}-${day.toString().padStart(2, '0')}T00:00:00`);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const isWeekend = dayName === 'Sun' || dayName === 'Sat';
                    return (
                      <th key={day} className={`px-2 py-3 text-center min-w-[75px] border-l border-white/5 ${isWeekend ? 'bg-indigo-500/5' : ''}`}>
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`text-sm ${isWeekend ? 'text-indigo-300' : 'text-slate-200'}`}>{day}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${isWeekend ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400'}`}>{dayName}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-4 text-center border-l border-white/10 bg-slate-950/60 text-emerald-400">P</th>
                  <th className="px-4 py-4 text-center bg-slate-950/60 text-rose-400">A</th>
                  <th className="px-4 py-4 text-right bg-slate-950/60 text-indigo-400">Total Hrs</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td colSpan={viewType === 'daily' ? 6 : daysArray.length + 4} className="p-16">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
                      <p className="text-slate-400 font-medium animate-pulse">Calculating attendance records...</p>
                    </div>
                  </td>
                </tr>
              ) : viewType === 'daily' ? (
                dailyRecords.length > 0 ? (
                  dailyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 sticky left-0 bg-slate-900/90 backdrop-blur-xl group-hover:bg-slate-800/90 z-10 shadow-[4px_0_15px_rgba(0,0,0,0.2)] transition-colors">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-200 text-base whitespace-nowrap">{record.staff.name}</span>
                          <span className="text-xs font-medium text-slate-500 whitespace-nowrap mt-0.5">
                            {record.staff.designation?.name || 'No Role'} • {record.staff.department?.name || 'No Dept'}
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
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openPunchModal(record.staffId, record.staff.name)}
                          className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 bg-slate-950 border border-white/5 rounded-xl transition-all shadow-sm opacity-50 group-hover:opacity-100"
                          title="Manage Punches"
                        >
                          <Settings2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-16 text-center">
                      <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-300 font-semibold text-lg">No Records Found</p>
                      <p className="text-slate-500 text-sm mt-1">There are no attendance records for this date.</p>
                    </td>
                  </tr>
                )
              ) : (
                monthlyRecords.length > 0 ? (
                  monthlyRecords.map((record) => (
                    <tr key={record.staff.machineId} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 sticky left-0 bg-slate-900/90 backdrop-blur-xl group-hover:bg-slate-800/90 z-10 shadow-[4px_0_15px_rgba(0,0,0,0.2)] transition-colors">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-200 text-base whitespace-nowrap">{record.staff.name}</span>
                          <span className="text-xs font-medium text-slate-500 whitespace-nowrap mt-0.5">
                            {record.staff.designation?.name || 'No Role'}
                          </span>
                        </div>
                      </td>
                      
                      {daysArray.map(day => {
                        const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
                        const dayData = record.days[dateStr];
                        
                        if (!dayData) return <td key={day} className="px-2 py-4 text-center border-l border-white/5 text-slate-600 font-bold">-</td>;
                        
                        if (dayData.checkIn) {
                          const inTime = new Date(dayData.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                          const outTime = dayData.checkOut ? new Date(dayData.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';
                          
                          let bgClass = "";
                          let statusLabel = null;

                          if (dayData.status === 'HALF_DAY') {
                            bgClass = "bg-amber-500/10";
                            statusLabel = <span className="text-amber-400 text-[10px] font-extrabold mt-1">HD</span>;
                          } else if (dayData.status === 'ABSENT') {
                            bgClass = "bg-rose-500/10";
                            statusLabel = <span className="text-rose-400 text-[10px] font-extrabold mt-1">A</span>;
                          } else if (dayData.status === 'HOLIDAY') {
                            bgClass = "bg-indigo-500/10";
                            statusLabel = <span className="text-indigo-400 text-[10px] font-extrabold mt-1">H</span>;
                          } else if (dayData.status === 'WEEKOFF') {
                            bgClass = "bg-slate-500/10";
                            statusLabel = <span className="text-slate-400 text-[10px] font-extrabold mt-1">W</span>;
                          }

                          return (
                            <td key={day} className={`px-2 py-3 text-center border-l border-white/5 whitespace-nowrap ${bgClass}`}>
                              <div className="flex flex-col items-center">
                                <span className="text-emerald-400 text-[11px] font-bold leading-none mb-1">{inTime}</span>
                                <span className="text-rose-400 text-[11px] font-bold leading-none">{outTime}</span>
                                {statusLabel}
                              </div>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'ABSENT') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/5 bg-rose-500/10">
                              <span className="text-rose-400 font-extrabold">A</span>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'HALF_DAY') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/5 bg-amber-500/10">
                              <span className="text-amber-400 font-extrabold">HD</span>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'HOLIDAY') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/5 bg-indigo-500/10">
                              <span className="text-indigo-400 font-extrabold">H</span>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'WEEKOFF') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/5 bg-slate-500/10">
                              <span className="text-slate-400 font-extrabold">W</span>
                            </td>
                          );
                        }

                        return <td key={day} className="px-2 py-4 text-center border-l border-white/5 text-slate-600 font-bold">-</td>;
                      })}

                      <td className="px-4 py-4 text-center border-l border-white/10 bg-slate-950/60 group-hover:bg-slate-900 transition-colors">
                        <span className="font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">{record.totalPresents}</span>
                      </td>
                      <td className="px-4 py-4 text-center bg-slate-950/60 group-hover:bg-slate-900 transition-colors">
                        <span className="font-extrabold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md">{record.totalAbsents}</span>
                      </td>
                      <td className="px-4 py-4 text-right bg-slate-950/60 group-hover:bg-slate-900 transition-colors">
                        <span className="font-extrabold text-indigo-400 whitespace-nowrap bg-indigo-500/10 px-2 py-1 rounded-md">{(record.totalWorkMinutes / 60).toFixed(1)} hrs</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={daysArray.length + 4} className="p-16 text-center">
                      <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-300 font-semibold text-lg">No Records Found</p>
                      <p className="text-slate-500 text-sm mt-1">There are no attendance records for this month.</p>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Punches Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center bg-slate-800/30">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-400" /> Manage Punches
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="mb-6">
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Staff Member</p>
                <p className="text-xl font-extrabold text-white">{selectedStaffName}</p>
              </div>

              <div className="space-y-4 bg-slate-950/50 p-5 rounded-2xl border border-white/5 shadow-inner">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Add Manual Punch</h4>
                <div className="flex gap-3">
                  <input
                    type="time"
                    value={newPunchTime}
                    onChange={(e) => setNewPunchTime(e.target.value)}
                    className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                  />
                  <select
                    value={newPunchType}
                    onChange={(e) => setNewPunchType(e.target.value)}
                    className="w-24 bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner appearance-none cursor-pointer"
                  >
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                  </select>
                  <button
                    onClick={handleAddPunch}
                    disabled={!newPunchTime || isPunchLoading}
                    className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:from-slate-700 disabled:to-slate-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Raw Logs</span>
                  <span className="text-indigo-400">{date}</span>
                </h4>
                {rawPunches.length === 0 ? (
                  <div className="p-6 text-center border border-white/5 rounded-2xl border-dashed">
                    <p className="text-sm font-medium text-slate-500">No punches recorded for this date.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rawPunches.map((punch: any) => (
                      <div key={punch.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors group">
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider border shadow-sm ${punch.type === 'IN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/10'}`}>
                            {punch.type}
                          </span>
                          <span className="text-slate-200 font-bold tracking-wide">
                            {new Date(punch.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeletePunch(punch.id)}
                          disabled={isPunchLoading}
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 bg-slate-900 border border-white/5 rounded-lg transition-all shadow-sm disabled:opacity-50 opacity-50 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
