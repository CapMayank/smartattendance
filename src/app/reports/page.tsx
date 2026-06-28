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
        'Check In': r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '-',
        'Check Out': r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '-',
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
          const dayData = r.days[dateStr];
          
          if (!dayData) {
            row[day.toString()] = '-';
          } else if (dayData.checkIn) {
            const inTime = new Date(dayData.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const outTime = dayData.checkOut ? new Date(dayData.checkOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
            let statusSuffix = '';
            if (dayData.status === 'HALF_DAY') statusSuffix = ' (HD)';
            if (dayData.status === 'ABSENT') statusSuffix = ' (A)';
            if (dayData.status === 'HOLIDAY') statusSuffix = ' (H)';
            if (dayData.status === 'WEEKOFF') statusSuffix = ' (W)';
            row[day.toString()] = `${inTime} - ${outTime}${statusSuffix}`;
          } else if (dayData.status === 'ABSENT') {
            row[day.toString()] = 'A';
          } else if (dayData.status === 'HALF_DAY') {
            row[day.toString()] = 'HD';
          } else if (dayData.status === 'HOLIDAY') {
            row[day.toString()] = 'H';
          } else if (dayData.status === 'WEEKOFF') {
            row[day.toString()] = 'W';
          } else {
            row[day.toString()] = '-';
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendance Reports</h1>
          <p className="text-slate-400 text-sm mt-1">View and export detailed attendance sheets. Data is automatically calculated to the latest records.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Filters and View Type */}
        <div className="bg-slate-800/30 px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-slate-950 rounded-lg p-1 border border-white/5">
            <button
              onClick={() => setViewType('daily')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewType === 'daily' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" /> Daily
            </button>
            <button
              onClick={() => setViewType('monthly')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewType === 'monthly' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Monthly
            </button>
          </div>

          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-slate-400" />
            {viewType === 'daily' ? (
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            ) : (
              <input 
                type="month" 
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            )}
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left text-sm text-slate-400 min-w-[800px]">
            <thead className="bg-slate-800/50 text-slate-300 text-xs uppercase font-semibold border-b border-white/10">
              {viewType === 'daily' ? (
                <tr>
                  <th className="px-6 py-4 sticky left-0 bg-slate-900 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.2)]">Staff Details</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Check In</th>
                  <th className="px-6 py-4">Check Out</th>
                  <th className="px-6 py-4 text-right">Late By / Work Hrs</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4 sticky left-0 bg-slate-900 z-10 shadow-[4px_0_10px_rgba(0,0,0,0.2)] whitespace-nowrap">Staff Details</th>
                  {daysArray.map(day => (
                    <th key={day} className="px-2 py-4 text-center min-w-[70px] border-l border-white/5">{day}</th>
                  ))}
                  <th className="px-4 py-4 text-center border-l border-white/5 bg-slate-800/30">P</th>
                  <th className="px-4 py-4 text-center bg-slate-800/30">A</th>
                  <th className="px-4 py-4 text-right bg-slate-800/30">Total Hrs</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={viewType === 'daily' ? 5 : daysArray.length + 4} className="p-12">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                      <p className="text-slate-400 text-sm font-medium">Calculating records, please wait...</p>
                    </div>
                  </td>
                </tr>
              ) : viewType === 'daily' ? (
                dailyRecords.length > 0 ? (
                  dailyRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 sticky left-0 bg-slate-900 shadow-[4px_0_10px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col">
                          <span className="font-medium text-white whitespace-nowrap">{record.staff.name}</span>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {record.staff.designation?.name || 'No Role'} • {record.staff.department?.name || 'No Dept'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          record.status === 'ABSENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          record.status === 'HOLIDAY' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                          record.status === 'WEEKOFF' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-300">
                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-300">
                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end">
                          {record.status === 'ABSENT' || record.status === 'HOLIDAY' || record.status === 'WEEKOFF' ? (
                            <span className="text-slate-500 font-medium">-</span>
                          ) : record.lateMinutes > 0 ? (
                            <span className="text-rose-400 font-medium">{record.lateMinutes} mins late</span>
                          ) : (
                            <span className="text-emerald-400 font-medium">On time</span>
                          )}
                          <span className="text-xs text-slate-500">{(record.workMinutes / 60).toFixed(1)} hrs worked</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => openPunchModal(record.staffId, record.staff.name)}
                          className="p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Manage Punches"
                        >
                          <Settings2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="p-12 text-center">No records found for this date.</td></tr>
                )
              ) : (
                monthlyRecords.length > 0 ? (
                  monthlyRecords.map((record) => (
                    <tr key={record.staff.machineId} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 sticky left-0 bg-slate-900 group-hover:bg-slate-800 shadow-[4px_0_10px_rgba(0,0,0,0.1)]">
                        <div className="flex flex-col">
                          <span className="font-medium text-white whitespace-nowrap">{record.staff.name}</span>
                          <span className="text-xs text-slate-500 whitespace-nowrap">
                            {record.staff.designation?.name || 'No Role'}
                          </span>
                        </div>
                      </td>
                      
                      {daysArray.map(day => {
                        const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
                        const dayData = record.days[dateStr];
                        
                        if (!dayData) return <td key={day} className="px-2 py-4 text-center border-l border-white/5 text-slate-600">-</td>;
                        
                        if (dayData.checkIn) {
                          const inTime = new Date(dayData.checkIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                          const outTime = dayData.checkOut ? new Date(dayData.checkOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-';
                          
                          let bgClass = "";
                          let statusLabel = null;

                          if (dayData.status === 'HALF_DAY') {
                            bgClass = "bg-amber-500/5";
                            statusLabel = <span className="text-amber-500 text-[10px] font-bold mt-1">HD</span>;
                          } else if (dayData.status === 'ABSENT') {
                            bgClass = "bg-rose-500/5";
                            statusLabel = <span className="text-rose-500 text-[10px] font-bold mt-1">A</span>;
                          } else if (dayData.status === 'HOLIDAY') {
                            bgClass = "bg-blue-500/5";
                            statusLabel = <span className="text-blue-500 text-[10px] font-bold mt-1">H</span>;
                          } else if (dayData.status === 'WEEKOFF') {
                            bgClass = "bg-slate-500/5";
                            statusLabel = <span className="text-slate-400 text-[10px] font-bold mt-1">W</span>;
                          }

                          return (
                            <td key={day} className={`px-2 py-4 text-center border-l border-white/5 whitespace-nowrap ${bgClass}`}>
                              <div className="flex flex-col items-center">
                                <span className="text-emerald-400 text-xs font-medium">{inTime}</span>
                                <span className="text-rose-400 text-xs font-medium mt-0.5">{outTime}</span>
                                {statusLabel}
                              </div>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'ABSENT') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/5 bg-rose-500/5">
                              <span className="text-rose-500 font-bold">A</span>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'HALF_DAY') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/5 bg-amber-500/5">
                              <span className="text-amber-500 font-bold">HD</span>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'HOLIDAY') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/5 bg-blue-500/5">
                              <span className="text-blue-500 font-bold">H</span>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'WEEKOFF') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/5 bg-slate-500/5">
                              <span className="text-slate-400 font-bold">W</span>
                            </td>
                          );
                        }

                        return <td key={day} className="px-2 py-4 text-center border-l border-white/5 text-slate-600">-</td>;
                      })}

                      <td className="px-4 py-4 text-center border-l border-white/5 bg-slate-800/10">
                        <span className="font-bold text-emerald-400">{record.totalPresents}</span>
                      </td>
                      <td className="px-4 py-4 text-center bg-slate-800/10">
                        <span className="font-bold text-rose-400">{record.totalAbsents}</span>
                      </td>
                      <td className="px-4 py-4 text-right bg-slate-800/10">
                        <span className="font-medium text-blue-400 whitespace-nowrap">{(record.totalWorkMinutes / 60).toFixed(1)} hrs</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={daysArray.length + 4} className="p-12 text-center">No records found for this month.</td></tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Punches Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
              <h3 className="text-lg font-bold text-white">Manage Punches - {selectedStaffName}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Add Manual Punch</h4>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={newPunchTime}
                    onChange={(e) => setNewPunchTime(e.target.value)}
                    className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <select
                    value={newPunchType}
                    onChange={(e) => setNewPunchType(e.target.value)}
                    className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                  </select>
                  <button
                    onClick={handleAddPunch}
                    disabled={!newPunchTime || isPunchLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Raw Logs ({date})</h4>
                {rawPunches.length === 0 ? (
                  <p className="text-sm text-slate-500">No punches recorded for this date.</p>
                ) : (
                  <div className="space-y-2">
                    {rawPunches.map((punch: any) => (
                      <div key={punch.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 text-xs font-bold rounded-md ${punch.type === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {punch.type}
                          </span>
                          <span className="text-slate-200 font-medium">
                            {new Date(punch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeletePunch(punch.id)}
                          disabled={isPunchLoading}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-50"
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
