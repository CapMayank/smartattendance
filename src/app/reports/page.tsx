'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download, Calendar as CalendarIcon, BarChart3, Plus, Trash2, Settings2, ChevronDown, LogIn, LogOut, Timer } from 'lucide-react'
import Papa from 'papaparse'
import { Avatar, Button, Card, EmptyState, Field, IconButton, Input, Modal, PageHeader, PhotoLightbox, Select, Skeleton, Tabs } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatTime, formatTimeSeconds } from '@/lib/format'
import { punchPhotoUrl, staffPhotoUrl } from '@/lib/photo-url'
import { StatusPill } from '@/components/attendance/StatusPill'

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
    id: string
    name: string
    machineId: string
    profilePhotoId?: string | null
    department: { name: string } | null
    designation: { name: string } | null
    shift: { name: string } | null
  }
}

/** One raw punch from GET /api/punches; photoId is the linked punch photo, if any. */
type RawPunch = {
  id: string
  staffId: string
  timestamp: string
  type: string
  photoId: string | null
}

type MonthlyRecord = {
  staff: {
    id: string
    name: string
    machineId: string
    profilePhotoId?: string | null
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
  present: { cell: 'bg-present/10 border-present/30 text-present', label: 'P', name: 'Present' },
  absent: { cell: 'bg-absent/10 border-absent/30 text-absent', label: 'A', name: 'Absent' },
  half: { cell: 'bg-late/10 border-late/30 text-late', label: 'HD', name: 'Half Day' },
  holiday: { cell: 'bg-card-hi border-line text-muted', label: 'H', name: 'Holiday' },
  weekoff: { cell: 'bg-card-hi border-line text-muted', label: 'W', name: 'Week Off' },
  none: { cell: 'bg-transparent border-line-soft text-subtle', label: '', name: 'No data' },
}

// IN / OUT punch pill: LogIn/LogOut icon + word (present tone for IN, muted for OUT).
function PunchTypePill({ type }: { type: string }) {
  const isIn = type === 'IN'
  const Icon = isIn ? LogIn : LogOut
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs',
        isIn ? 'tone-present tint-badge' : 'tone-muted border border-line bg-card-hi text-muted',
      )}
    >
      <Icon size={13} aria-hidden="true" />
      {type}
    </span>
  )
}

// 40 px thumbnail of a punch photo that opens it large; nothing when the punch has no photo
// (or the thumbnail fails to load). Rows share a min height, so nothing shifts.
function PunchThumb({ punch, name, onOpen }: { punch: RawPunch; name: string; onOpen: () => void }) {
  const [failed, setFailed] = useState(false)
  const src = punchPhotoUrl(punch.photoId)
  if (!src || failed) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View punch photo of ${name} at ${formatTime(new Date(punch.timestamp))}`}
      title="View punch photo"
      className="size-10 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border border-line bg-card-hi focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={40} height={40} loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
    </button>
  )
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
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      {/* The whole header toggles on tap; the name button is the keyboard and screen reader toggle.
          It is not one big button, because the profile photo is a button of its own. */}
      <div
        onClick={() => setOpen(o => !o)}
        className="w-full cursor-pointer p-4 text-left transition-colors duration-150 hover:bg-card-hi"
      >
        <div className="flex items-center gap-3">
          <Avatar name={record.staff.name} src={staffPhotoUrl(record.staff)} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpen(o => !o)
            }}
            aria-expanded={open}
            className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium leading-tight text-text">{record.staff.name}</span>
              <span className="mt-0.5 block truncate text-xs text-subtle">{record.staff.designation?.name || 'No Role'}</span>
            </span>
            <ChevronDown size={18} aria-hidden="true" className={cn('shrink-0 text-muted transition-transform duration-150', open && 'rotate-180')} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <div className="rounded-xl border border-present/30 bg-present/10 py-2 text-center">
            <p className="num text-lg leading-none text-present">{record.totalPresents}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">Present</p>
          </div>
          <div className="rounded-xl border border-absent/30 bg-absent/10 py-2 text-center">
            <p className="num text-lg leading-none text-absent">{record.totalAbsents}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">Absent</p>
          </div>
          <div className="rounded-xl border border-late/30 bg-late/10 py-2 text-center">
            <p className="num text-lg leading-none text-late">{record.totalHalfDays}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">Half</p>
          </div>
          <div className="rounded-xl border border-acc-2/30 bg-acc-2/10 py-2 text-center">
            <p className="num text-lg leading-none text-acc-1">{(record.totalWorkMinutes / 60).toFixed(0)}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wider text-muted">Hours</p>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-line-soft px-4 pb-4 pt-1">
          <div className="mb-1.5 mt-3 grid grid-cols-7 gap-1.5">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <div key={i} className="text-center text-[10px] text-subtle">{d}</div>
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
                  className={cn(
                    'flex aspect-square flex-col items-center justify-center rounded-xl border leading-none transition-colors duration-150',
                    style.cell,
                    isSelected && 'ring-2 ring-acc-2',
                  )}
                >
                  <span className="num text-[13px]">{day}</span>
                  <span className="mt-0.5 h-2 text-[8px] font-semibold">{style.label}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {(['present', 'absent', 'half', 'holiday', 'weekoff'] as DayKind[]).map(k => (
              <span key={k} className="flex items-center gap-1 text-[10px] text-muted">
                <span className={cn('size-2.5 rounded-[4px] border', dayKindStyle[k].cell)}></span>
                <span className="font-semibold">{dayKindStyle[k].label}</span> {dayKindStyle[k].name}
              </span>
            ))}
          </div>

          {selectedDay && (
            <div className="mt-3 rounded-xl border border-line bg-ground p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-text">
                  {new Date(`${selectedStr}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
                <span className={cn('rounded-md border px-2 py-0.5 text-[10px] uppercase tracking-wider', dayKindStyle[selectedKind].cell)}>
                  {dayKindStyle[selectedKind].label ? `${dayKindStyle[selectedKind].label} · ` : ''}{dayKindStyle[selectedKind].name}
                </span>
              </div>
              {selectedData && (selectedData.checkIn || selectedData.checkOut) ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-subtle">In</p>
                    <p className="num text-sm text-present">{timeFmt(selectedData.checkIn)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-subtle">Out</p>
                    <p className="num text-sm text-absent">{timeFmt(selectedData.checkOut)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-subtle">Hours</p>
                    <p className="num text-sm text-text">{(selectedData.workMinutes / 60).toFixed(1)}</p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-subtle">No punches recorded for this day.</p>
              )}
              {selectedData && selectedData.lateMinutes > 0 && (
                <p className="mt-2 text-[11px] text-late"><span className="num">{selectedData.lateMinutes}</span> mins late</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ReportsPage() {
  const router = useRouter()
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
  const [rawPunches, setRawPunches] = useState<RawPunch[]>([])
  const [viewPunch, setViewPunch] = useState<RawPunch | null>(null)
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
    <div className="space-y-5">
      <PageHeader
        title="Attendance Reports"
        subtitle="View and export detailed attendance sheets."
        actions={<Button variant="secondary" icon={Download} onClick={exportCSV}>Export CSV</Button>}
      />

      <Card className="flex flex-col !p-0">
        {/* Filters and View Type */}
        <div className="flex flex-col items-stretch justify-between gap-4 border-b border-line-soft px-4 py-4 sm:flex-row sm:items-end sm:px-5">
          <Tabs
            tabs={[
              { id: 'daily', label: 'Daily' },
              { id: 'monthly', label: 'Monthly' },
            ]}
            value={viewType}
            onChange={(id) => setViewType(id as 'daily' | 'monthly')}
          />

          <div className="w-full sm:w-56">
            {viewType === 'daily' ? (
              <Field label="Date" htmlFor="report-date">
                <div className="relative">
                  <CalendarIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                  <Input
                    id="report-date"
                    type="date"
                    className="num pl-10"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </Field>
            ) : (
              <Field label="Month" htmlFor="report-month">
                <div className="relative">
                  <CalendarIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                  <Input
                    id="report-month"
                    type="month"
                    className="num pl-10"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </div>
              </Field>
            )}
          </div>
        </div>

        <div className="table-wrap hidden min-h-[500px] md:block">
          <table className={viewType === 'daily' ? 'data-table min-w-[800px]' : 'data-matrix min-w-[1400px]'}>
            <thead>
              {viewType === 'daily' ? (
                <tr>
                  <th>Staff Details</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th className="text-right">Late By / Work Hrs</th>
                  <th className="text-center">Manage</th>
                </tr>
              ) : (
                <tr>
                  <th className="whitespace-nowrap">Staff Details</th>
                  {daysArray.map(day => {
                    const dateObj = new Date(`${month}-${day.toString().padStart(2, '0')}T00:00:00`);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const isWeekend = dayName === 'Sun' || dayName === 'Sat';
                    return (
                      <th key={day} className="min-w-[75px]">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={cn('num text-sm', isWeekend ? 'text-acc-1' : 'text-text')}>{day}</span>
                          <span className={cn('rounded px-1.5 py-0.5 text-[10px] uppercase tracking-widest', isWeekend ? 'bg-acc-3/30 text-acc-1' : 'bg-card-hi text-muted')}>{dayName}</span>
                        </div>
                      </th>
                    );
                  })}
                  <th className="text-present">P</th>
                  <th className="text-absent">A</th>
                  <th className="text-right text-acc-1">Total Hrs</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-[38px] rounded-xl" />
                          <div className="flex flex-col gap-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      </td>
                      <td colSpan={viewType === 'daily' ? 5 : daysArray.length + 3}>
                        <Skeleton className="h-4 w-full" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : viewType === 'daily' ? (
                dailyRecords.length > 0 ? (
                  dailyRecords.map((record) => (
                    <tr
                      key={record.id}
                      className="group cursor-pointer"
                      onClick={() => router.push(`/reports/member-attendance?staffId=${record.staffId}&month=${date.substring(0, 7)}`)}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={record.staff.name} src={staffPhotoUrl(record.staff)} />
                          <div className="flex flex-col">
                            <span className="whitespace-nowrap font-medium text-text">{record.staff.name}</span>
                            <span className="mt-0.5 whitespace-nowrap text-xs text-subtle">
                              {record.staff.designation?.name || 'No Role'} • {record.staff.department?.name || 'No Dept'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <StatusPill status={record.status} />
                      </td>
                      <td className="num text-text">
                        {record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                      </td>
                      <td className="num text-text">
                        {record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                      </td>
                      <td className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          {record.status === 'ABSENT' || record.status === 'HOLIDAY' || record.status === 'WEEKOFF' ? (
                            <span className="text-subtle">-</span>
                          ) : record.lateMinutes > 0 ? (
                            <span className="tone-late tint-badge inline-flex h-[22px] items-center rounded-full px-2 text-[11px]"><span className="num mr-1">{record.lateMinutes}</span> mins late</span>
                          ) : (
                            <span className="tone-present tint-badge inline-flex h-[22px] items-center rounded-full px-2 text-[11px]">On time</span>
                          )}
                          <span className="num text-xs text-subtle">{(record.workMinutes / 60).toFixed(1)} hrs</span>
                        </div>
                      </td>
                      <td className="text-center">
                        <IconButton
                          icon={Settings2}
                          label="Manage punches"
                          className="size-8"
                          onClick={(e) => {
                            e.stopPropagation()
                            openPunchModal(record.staffId, record.staff.name)
                          }}
                        />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="!p-0">
                      <EmptyState icon={FileText} title="No Records Found" hint="There are no attendance records for this date." />
                    </td>
                  </tr>
                )
              ) : (
                monthlyRecords.length > 0 ? (
                  monthlyRecords.map((record) => (
                    <tr
                      key={record.staff.machineId}
                      className="group cursor-pointer"
                      onClick={() => router.push(`/reports/member-attendance?staffId=${record.staff.id}&month=${month}`)}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={record.staff.name} src={staffPhotoUrl(record.staff)} />
                          <div className="flex flex-col">
                            <span className="whitespace-nowrap text-sm font-medium text-text">{record.staff.name}</span>
                            <span className="whitespace-nowrap text-[11px] text-subtle">
                              {record.staff.designation?.name || 'No Role'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {daysArray.map(day => {
                        const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
                        const dayData = record.days[dateStr];

                        if (!dayData) return <td key={day} className="text-subtle">-</td>;

                        if (dayData.checkIn) {
                          const inTime = new Date(dayData.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                          const outTime = dayData.checkOut ? new Date(dayData.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-';

                          let bgClass = "bg-present/5";
                          let statusLabel = <span className="mt-1 text-[10px] font-semibold text-present">P</span>;

                          if (dayData.status === 'HALF_DAY') {
                            bgClass = "bg-late/10";
                            statusLabel = <span className="mt-1 text-[10px] font-semibold text-late">HD</span>;
                          } else if (dayData.status === 'ABSENT') {
                            bgClass = "bg-absent/10";
                            statusLabel = <span className="mt-1 text-[10px] font-semibold text-absent">A</span>;
                          } else if (dayData.status === 'HOLIDAY') {
                            bgClass = "bg-card-hi";
                            statusLabel = <span className="mt-1 text-[10px] font-semibold text-muted">H</span>;
                          } else if (dayData.status === 'WEEKOFF') {
                            bgClass = "bg-card-hi";
                            statusLabel = <span className="mt-1 text-[10px] font-semibold text-muted">W</span>;
                          }

                          return (
                            <td key={day} className={bgClass}>
                              <div className="flex flex-col items-center">
                                <span className="num mb-1 text-[11px] leading-none text-present">{inTime}</span>
                                <span className="num text-[11px] leading-none text-absent">{outTime}</span>
                                {statusLabel}
                              </div>
                            </td>
                          );
                        }

                        if (dayData.status === 'ABSENT') {
                          return (
                            <td key={day} className="bg-absent/10">
                              <span className="font-semibold text-absent">A</span>
                            </td>
                          );
                        }

                        if (dayData.status === 'HALF_DAY') {
                          return (
                            <td key={day} className="bg-late/10">
                              <span className="font-semibold text-late">HD</span>
                            </td>
                          );
                        }

                        if (dayData.status === 'HOLIDAY') {
                          return (
                            <td key={day} className="bg-card-hi">
                              <span className="font-semibold text-muted">H</span>
                            </td>
                          );
                        }

                        if (dayData.status === 'WEEKOFF') {
                          return (
                            <td key={day} className="bg-card-hi">
                              <span className="font-semibold text-muted">W</span>
                            </td>
                          );
                        }

                        return <td key={day} className="text-subtle">-</td>;
                      })}

                      <td className="bg-card-hi">
                        <span className="num rounded-md bg-present/10 px-2 py-1 text-present">{record.totalPresents}</span>
                      </td>
                      <td className="bg-card-hi">
                        <span className="num rounded-md bg-absent/10 px-2 py-1 text-absent">{record.totalAbsents}</span>
                      </td>
                      <td className="bg-card-hi text-right">
                        <span className="num whitespace-nowrap rounded-md bg-acc-2/10 px-2 py-1 text-acc-1">{(record.totalWorkMinutes / 60).toFixed(1)} hrs</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={daysArray.length + 4} className="!p-0">
                      <EmptyState icon={BarChart3} title="No Records Found" hint="There are no attendance records for this month." />
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="space-y-3 p-4 md:hidden">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <p className="text-center text-sm text-muted" role="status">Calculating attendance records...</p>
            </div>
          ) : viewType === 'daily' ? (
            dailyRecords.length > 0 ? (
              <>
                {/* Summary strip */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-present/30 bg-present/10 p-3 text-center">
                    <p className="num text-2xl leading-none text-present">{dailyRecords.filter(r => r.status === 'PRESENT').length}</p>
                    <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted">Present</p>
                  </div>
                  <div className="rounded-xl border border-absent/30 bg-absent/10 p-3 text-center">
                    <p className="num text-2xl leading-none text-absent">{dailyRecords.filter(r => r.status === 'ABSENT').length}</p>
                    <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted">Absent</p>
                  </div>
                  <div className="rounded-xl border border-late/30 bg-late/10 p-3 text-center">
                    <p className="num text-2xl leading-none text-late">{dailyRecords.filter(r => r.lateMinutes > 0 && r.status !== 'ABSENT').length}</p>
                    <p className="mt-1.5 text-[10px] uppercase tracking-wider text-muted">Late</p>
                  </div>
                </div>

                {dailyRecords.map((record) => {
                  const noWork = record.status === 'ABSENT' || record.status === 'HOLIDAY' || record.status === 'WEEKOFF'
                  return (
                    <div key={record.id} className="relative overflow-hidden rounded-2xl border border-line bg-card p-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={record.staff.name} src={staffPhotoUrl(record.staff)} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium leading-tight text-text">{record.staff.name}</p>
                          <p className="mt-0.5 truncate text-xs text-subtle">
                            {record.staff.designation?.name || 'No Role'} • {record.staff.department?.name || 'No Dept'}
                          </p>
                        </div>
                        <StatusPill status={record.status} />
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-xl border border-line bg-ground p-2.5">
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-subtle"><LogIn size={12} className="text-present" aria-hidden="true" />In</p>
                          <p className="num mt-1 whitespace-nowrap text-sm text-text">{timeFmt(record.checkIn)}</p>
                        </div>
                        <div className="rounded-xl border border-line bg-ground p-2.5">
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-subtle"><LogOut size={12} className="text-absent" aria-hidden="true" />Out</p>
                          <p className="num mt-1 whitespace-nowrap text-sm text-text">{timeFmt(record.checkOut)}</p>
                        </div>
                        <div className="rounded-xl border border-line bg-ground p-2.5">
                          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-subtle"><Timer size={12} className="text-acc-1" aria-hidden="true" />Hours</p>
                          <p className="num mt-1 text-sm text-text">{noWork ? '-' : (record.workMinutes / 60).toFixed(1)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        {noWork ? (
                          <span className="text-xs text-subtle">No punches expected</span>
                        ) : record.lateMinutes > 0 ? (
                          <span className="tone-late tint-badge inline-flex h-[22px] items-center rounded-full px-2 text-[11px]"><span className="num mr-1">{record.lateMinutes}</span> mins late</span>
                        ) : (
                          <span className="tone-present tint-badge inline-flex h-[22px] items-center rounded-full px-2 text-[11px]">On time</span>
                        )}
                        <Button
                          variant="secondary"
                          icon={Settings2}
                          onClick={(e) => {
                            e.stopPropagation()
                            openPunchModal(record.staffId, record.staff.name)
                          }}
                        >
                          Punches
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <EmptyState icon={FileText} title="No Records Found" hint="There are no attendance records for this date." />
            )
          ) : monthlyRecords.length > 0 ? (
            <>
              <p className="px-1 text-xs text-subtle">Tap a person to open their month calendar. Tap a day for details.</p>
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
            <EmptyState icon={BarChart3} title="No Records Found" hint="There are no attendance records for this month." />
          )}
        </div>
      </Card>

      {/* Punches Modal */}
      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setViewPunch(null)
        }}
        title="Manage Punches"
      >
        <div className="mb-5">
          <p className="mb-1 text-xs uppercase tracking-wider text-subtle">Staff Member</p>
          <p className="text-lg font-medium text-text">{selectedStaffName}</p>
        </div>

        <div className="space-y-3 rounded-xl border border-line bg-ground p-4">
          <h3 className="text-xs uppercase tracking-wider text-muted">Add Manual Punch</h3>
          <div className="flex gap-2">
            <Input
              type="time"
              aria-label="Punch time"
              className="num min-w-0 flex-1"
              value={newPunchTime}
              onChange={(e) => setNewPunchTime(e.target.value)}
            />
            <Select
              aria-label="Punch type"
              className="w-24"
              value={newPunchType}
              onChange={(e) => setNewPunchType(e.target.value)}
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </Select>
            <Button
              icon={Plus}
              aria-label="Add punch"
              onClick={handleAddPunch}
              disabled={!newPunchTime || isPunchLoading}
            />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <h3 className="flex items-center justify-between text-xs uppercase tracking-wider text-muted">
            <span>Raw Logs</span>
            <span className="num text-acc-1">{date}</span>
          </h3>
          {rawPunches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-6 text-center">
              <p className="text-sm text-subtle">No punches recorded for this date.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rawPunches.map((punch) => (
                <div key={punch.id} className="flex min-h-16 items-center justify-between rounded-xl border border-line bg-ground p-3">
                  <div className="flex items-center gap-3">
                    <PunchThumb punch={punch} name={selectedStaffName} onOpen={() => setViewPunch(punch)} />
                    <PunchTypePill type={punch.type} />
                    <span className="num text-sm text-text">
                      {formatTimeSeconds(new Date(punch.timestamp))}
                    </span>
                  </div>
                  <IconButton
                    icon={Trash2}
                    label="Delete punch"
                    className="size-8 hover:border-absent hover:text-absent"
                    onClick={() => handleDeletePunch(punch.id)}
                    disabled={isPunchLoading}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        {viewPunch?.photoId ? (
          <PhotoLightbox
            src={punchPhotoUrl(viewPunch.photoId)!}
            name={selectedStaffName}
            takenAt={viewPunch.timestamp}
            onClose={() => setViewPunch(null)}
          />
        ) : null}
      </Modal>
    </div>
  )
}
