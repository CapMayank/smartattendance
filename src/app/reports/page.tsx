'use client'

import { useState, useEffect } from 'react'
import { FileText, Download, Calendar as CalendarIcon, Filter, Clock, Users, BarChart3, Plus, Trash2, X, Settings2, ChevronDown, LogIn, LogOut, Timer } from 'lucide-react'
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

const timeFmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'

type DayKind = 'present' | 'absent' | 'half' | 'holiday' | 'weekoff' | 'none'

const getDayKind = (d?: MonthlyRecord['days'][string]): DayKind => {
  if (!d) return 'none'
  if (d.status === 'ABSENT') return 'absent'
  if (d.status === 'HALF_DAY') return 'half'
  if (d.status === 'HOLIDAY') return 'holiday'
  if (d.status === 'WEEKOFF') return 'weekoff'
  if (d.checkIn) return 'present'
  return 'none'
}

const dayKindStyle: Record<DayKind, { cell: string; label: string; name: string }> = {
  present: { cell: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300', label: 'P', name: 'Present' },
  absent: { cell: 'bg-rose-500/15 border-rose-500/30 text-rose-300', label: 'A', name: 'Absent' },
  half: { cell: 'bg-amber-500/15 border-amber-500/30 text-amber-300', label: 'HD', name: 'Half Day' },
  holiday: { cell: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300', label: 'H', name: 'Holiday' },
  weekoff: { cell: 'bg-slate-500/10 border-white/[0.06] text-slate-400', label: 'W', name: 'Week Off' },
  none: { cell: 'bg-white/[0.02] border-white/[0.04] text-slate-600', label: '', name: 'No data' },
}

function MonthlyMobileCard({
  record,
  month,
  daysArray,
  firstDow,
}: {
  record: MonthlyRecord
  month: string
  daysArray: number[]
  firstDow: number
}) {
  const [open, setOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const selectedStr = selectedDay ? `${month}-${selectedDay.toString().padStart(2, '0')}` : null
  const selectedData = selectedStr ? record.days[selectedStr] : undefined
  const selectedKind = getDayKind(selectedData)

  return (
    <div className="bg-black/40 border border-white/[0.08] rounded-3xl overflow-hidden shadow-lg">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 text-left active:bg-white/[0.03] transition-colors"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-black text-white shadow-lg border border-white/[0.08] shrink-0">
            {record.staff.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-white leading-tight truncate">{record.staff.name}</p>
            <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{record.staff.designation?.name || 'No Role'}</p>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 py-2 text-center">
            <p className="text-lg font-black text-emerald-400 leading-none">{record.totalPresents}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/70 mt-1">Present</p>
          </div>
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 py-2 text-center">
            <p className="text-lg font-black text-rose-400 leading-none">{record.totalAbsents}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-rose-300/70 mt-1">Absent</p>
          </div>
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 py-2 text-center">
            <p className="text-lg font-black text-amber-400 leading-none">{record.totalHalfDays}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-300/70 mt-1">Half</p>
          </div>
          <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 py-2 text-center">
            <p className="text-lg font-black text-indigo-400 leading-none">{(record.totalWorkMinutes / 60).toFixed(0)}</p>
            <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-300/70 mt-1">Hours</p>
          </div>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-white/[0.06] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="grid grid-cols-7 gap-1.5 mt-3 mb-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-slate-500">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`pad-${i}`} />)}
            {daysArray.map(day => {
              const dateStr = `${month}-${day.toString().padStart(2, '0')}`
              const kind = getDayKind(record.days[dateStr])
              const style = dayKindStyle[kind]
              const isSelected = selectedDay === day
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`aspect-square rounded-xl border flex flex-col items-center justify-center leading-none transition-all active:scale-90 ${style.cell} ${isSelected ? 'ring-2 ring-white/70 scale-105' : ''}`}
                >
                  <span className="text-[13px] font-bold">{day}</span>
                  <span className="text-[8px] font-extrabold mt-0.5 h-2">{style.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
            {(['present', 'absent', 'half', 'holiday', 'weekoff'] as DayKind[]).map(k => (
              <span key={k} className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                <span className={`w-2.5 h-2.5 rounded-[4px] border ${dayKindStyle[k].cell}`}></span>
                {dayKindStyle[k].name}
              </span>
            ))}
          </div>

          {selectedDay && (
            <div className="mt-3 rounded-2xl bg-black/50 border border-white/[0.08] p-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white">
                  {new Date(`${selectedStr}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${dayKindStyle[selectedKind].cell}`}>
                  {dayKindStyle[selectedKind].name}
                </span>
              </div>
              {selectedData && (selectedData.checkIn || selectedData.checkOut) ? (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">In</p>
                    <p className="text-sm font-bold text-emerald-400">{timeFmt(selectedData.checkIn)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Out</p>
                    <p className="text-sm font-bold text-rose-400">{timeFmt(selectedData.checkOut)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Hours</p>
                    <p className="text-sm font-bold text-slate-200">{(selectedData.workMinutes / 60).toFixed(1)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 mt-2">No punches recorded for this day.</p>
              )}
              {selectedData && selectedData.lateMinutes > 0 && (
                <p className="text-[11px] font-bold text-rose-400 mt-2">{selectedData.lateMinutes} mins late</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
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

  const firstDow = new Date(`${month}-01T00:00:00`).getDay()

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-screen pb-24 space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl border border-white/[0.04] shadow-lg shadow-indigo-500/10">
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
            className="w-full md:w-auto justify-center flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="bg-black/30 backdrop-blur-2xl border border-white/[0.08] rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative flex flex-col">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl pointer-events-none"></div>
        
        {/* Filters and View Type */}
        <div className="bg-black/50 px-4 sm:px-6 py-4 sm:py-5 border-b border-white/[0.08] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
          <div className="grid grid-cols-2 sm:flex items-center gap-2 bg-black/60 rounded-xl p-1.5 border border-white/[0.08] shadow-inner">
            <button
              onClick={() => setViewType('daily')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewType === 'daily' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" /> Daily
            </button>
            <button
              onClick={() => setViewType('monthly')}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
                viewType === 'monthly' ? 'bg-indigo-500/20 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Monthly
            </button>
          </div>

          <div className="flex items-center gap-3 bg-black/40 p-2 rounded-xl border border-white/[0.08]">
            <CalendarIcon className="w-5 h-5 text-indigo-400 ml-2 shrink-0" />
            {viewType === 'daily' ? (
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 min-w-0 bg-transparent border-none text-white font-medium focus:ring-0 outline-none cursor-pointer"
              />
            ) : (
              <input 
                type="month" 
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="flex-1 min-w-0 bg-transparent border-none text-white font-medium focus:ring-0 outline-none cursor-pointer"
              />
            )}
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto min-h-[500px] relative z-10 custom-scrollbar">
          <table className={`w-full text-left text-sm text-slate-400 min-w-[800px]`}>
            <thead className="bg-black/50/40 text-slate-300 text-xs uppercase font-bold tracking-wider border-b border-white/[0.08]">
              {viewType === 'daily' ? (
                <tr>
                  <th className="px-6 py-5 sticky left-0 bg-black/60 backdrop-blur-2xl z-20 shadow-[4px_0_15px_rgba(0,0,0,0.3)]">Staff Details</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5">Check In</th>
                  <th className="px-6 py-5">Check Out</th>
                  <th className="px-6 py-5 text-right">Late By / Work Hrs</th>
                  <th className="px-6 py-5 text-center">Manage</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-5 sticky left-0 bg-black/60 backdrop-blur-2xl z-20 shadow-[4px_0_15px_rgba(0,0,0,0.3)] whitespace-nowrap">Staff Details</th>
                  {daysArray.map(day => {
                    const dateObj = new Date(`${month}-${day.toString().padStart(2, '0')}T00:00:00`);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const isWeekend = dayName === 'Sun' || dayName === 'Sat';
                    return (
                      <th key={day} className={`px-2 py-3 text-center min-w-[75px] border-l border-white/[0.04] ${isWeekend ? 'bg-indigo-500/5' : ''}`}>
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`text-sm ${isWeekend ? 'text-indigo-300' : 'text-slate-200'}`}>{day}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${isWeekend ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400'}`}>{dayName}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="px-4 py-4 text-center border-l border-white/[0.08] bg-black/50/60 text-emerald-400">P</th>
                  <th className="px-4 py-4 text-center bg-black/50/60 text-rose-400">A</th>
                  <th className="px-4 py-4 text-right bg-black/50/60 text-indigo-400">Total Hrs</th>
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
                    <tr key={record.id} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 sticky left-0 bg-black/60 backdrop-blur-2xl group-hover:bg-black/40/90 z-10 shadow-[4px_0_15px_rgba(0,0,0,0.2)] transition-colors">
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
                          className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 bg-black/50 border border-white/[0.04] rounded-xl transition-all shadow-sm opacity-50 group-hover:opacity-100"
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
                    <tr key={record.staff.machineId} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 sticky left-0 bg-black/60 backdrop-blur-2xl group-hover:bg-black/40/90 z-10 shadow-[4px_0_15px_rgba(0,0,0,0.2)] transition-colors">
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
                        
                        if (!dayData) return <td key={day} className="px-2 py-4 text-center border-l border-white/[0.04] text-slate-600 font-bold">-</td>;
                        
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
                            <td key={day} className={`px-2 py-3 text-center border-l border-white/[0.04] whitespace-nowrap ${bgClass}`}>
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
                            <td key={day} className="px-2 py-4 text-center border-l border-white/[0.04] bg-rose-500/10">
                              <span className="text-rose-400 font-extrabold">A</span>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'HALF_DAY') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/[0.04] bg-amber-500/10">
                              <span className="text-amber-400 font-extrabold">HD</span>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'HOLIDAY') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/[0.04] bg-indigo-500/10">
                              <span className="text-indigo-400 font-extrabold">H</span>
                            </td>
                          );
                        }
                        
                        if (dayData.status === 'WEEKOFF') {
                          return (
                            <td key={day} className="px-2 py-4 text-center border-l border-white/[0.04] bg-slate-500/10">
                              <span className="text-slate-400 font-extrabold">W</span>
                            </td>
                          );
                        }

                        return <td key={day} className="px-2 py-4 text-center border-l border-white/[0.04] text-slate-600 font-bold">-</td>;
                      })}

                      <td className="px-4 py-4 text-center border-l border-white/[0.08] bg-black/50/60 group-hover:bg-black/40 transition-colors">
                        <span className="font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">{record.totalPresents}</span>
                      </td>
                      <td className="px-4 py-4 text-center bg-black/50/60 group-hover:bg-black/40 transition-colors">
                        <span className="font-extrabold text-rose-400 bg-rose-500/10 px-2 py-1 rounded-md">{record.totalAbsents}</span>
                      </td>
                      <td className="px-4 py-4 text-right bg-black/50/60 group-hover:bg-black/40 transition-colors">
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

        {/* Mobile View */}
        <div className="md:hidden relative z-10 p-4 space-y-3">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
              <p className="text-slate-400 font-medium animate-pulse">Calculating attendance records...</p>
            </div>
          ) : viewType === 'daily' ? (
            dailyRecords.length > 0 ? (
              <>
                {/* Summary strip */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                    <p className="text-2xl font-black text-emerald-400 leading-none">{dailyRecords.filter(r => r.status === 'PRESENT').length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70 mt-1.5">Present</p>
                  </div>
                  <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-center">
                    <p className="text-2xl font-black text-rose-400 leading-none">{dailyRecords.filter(r => r.status === 'ABSENT').length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300/70 mt-1.5">Absent</p>
                  </div>
                  <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                    <p className="text-2xl font-black text-amber-400 leading-none">{dailyRecords.filter(r => r.lateMinutes > 0 && r.status !== 'ABSENT').length}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300/70 mt-1.5">Late</p>
                  </div>
                </div>

                {dailyRecords.map((record) => {
                  const noWork = record.status === 'ABSENT' || record.status === 'HOLIDAY' || record.status === 'WEEKOFF'
                  return (
                    <div key={record.id} className="bg-black/40 border border-white/[0.08] rounded-3xl p-4 relative overflow-hidden shadow-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-black text-white shadow-lg border border-white/[0.08] shrink-0">
                          {record.staff.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-white leading-tight truncate">{record.staff.name}</p>
                          <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                            {record.staff.designation?.name || 'No Role'} • {record.staff.department?.name || 'No Dept'}
                          </p>
                        </div>
                        <span className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                          record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          record.status === 'ABSENT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          record.status === 'HOLIDAY' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          record.status === 'WEEKOFF' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {record.status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="bg-black/50 rounded-2xl border border-white/[0.04] p-2.5">
                          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"><LogIn className="w-3 h-3 text-emerald-400" />In</p>
                          <p className="mt-1 text-sm font-bold text-slate-200 whitespace-nowrap">{timeFmt(record.checkIn)}</p>
                        </div>
                        <div className="bg-black/50 rounded-2xl border border-white/[0.04] p-2.5">
                          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"><LogOut className="w-3 h-3 text-rose-400" />Out</p>
                          <p className="mt-1 text-sm font-bold text-slate-200 whitespace-nowrap">{timeFmt(record.checkOut)}</p>
                        </div>
                        <div className="bg-black/50 rounded-2xl border border-white/[0.04] p-2.5">
                          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500"><Timer className="w-3 h-3 text-indigo-400" />Hours</p>
                          <p className="mt-1 text-sm font-bold text-slate-200">{noWork ? '-' : (record.workMinutes / 60).toFixed(1)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-4">
                        {noWork ? (
                          <span className="text-xs font-semibold text-slate-600">No punches expected</span>
                        ) : record.lateMinutes > 0 ? (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">{record.lateMinutes} mins late</span>
                        ) : (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">On time</span>
                        )}
                        <button
                          onClick={() => openPunchModal(record.staffId, record.staff.name)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-xl transition-all active:scale-95"
                        >
                          <Settings2 className="w-4 h-4" /> Punches
                        </button>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className="py-14 text-center">
                <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-300 font-semibold text-lg">No Records Found</p>
                <p className="text-slate-500 text-sm mt-1">There are no attendance records for this date.</p>
              </div>
            )
          ) : monthlyRecords.length > 0 ? (
            <>
              <p className="text-xs text-slate-500 font-medium px-1">Tap a person to open their month calendar. Tap a day for details.</p>
              {monthlyRecords.map((record) => (
                <MonthlyMobileCard
                  key={record.staff.machineId}
                  record={record}
                  month={month}
                  daysArray={daysArray}
                  firstDow={firstDow}
                />
              ))}
            </>
          ) : (
            <div className="py-14 text-center">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-semibold text-lg">No Records Found</p>
              <p className="text-slate-500 text-sm mt-1">There are no attendance records for this month.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modern Punches Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in">
          <div className="bg-black/60 backdrop-blur-2xl border border-white/[0.08] rounded-3xl w-full max-w-lg shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 border-b border-white/[0.08] flex justify-between items-center bg-black/50">
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

              <div className="space-y-4 bg-black/40 p-5 rounded-3xl border border-white/[0.04] shadow-inner">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Add Manual Punch</h4>
                <div className="flex gap-3">
                  <input
                    type="time"
                    value={newPunchTime}
                    onChange={(e) => setNewPunchTime(e.target.value)}
                    className="flex-1 bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-white font-medium focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                  />
                  <select
                    value={newPunchType}
                    onChange={(e) => setNewPunchType(e.target.value)}
                    className="w-24 bg-black/40 border border-white/[0.08] rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner appearance-none cursor-pointer"
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
                  <div className="p-6 text-center border border-white/[0.04] rounded-3xl border-dashed">
                    <p className="text-sm font-medium text-slate-500">No punches recorded for this date.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rawPunches.map((punch: any) => (
                      <div key={punch.id} className="flex items-center justify-between p-4 rounded-3xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors group">
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
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 bg-black/40 border border-white/[0.04] rounded-lg transition-all shadow-sm disabled:opacity-50 opacity-50 group-hover:opacity-100"
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
