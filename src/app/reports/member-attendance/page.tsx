'use client'

import { useState, useEffect } from 'react'
import { Download, Calendar as CalendarIcon, Search, UserCheck, LogIn, LogOut, AlertTriangle } from 'lucide-react'
import Papa from 'papaparse'
import { Avatar, Button, Card, EmptyState, Field, Input, PageHeader, Select, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { staffPhotoUrl } from '@/lib/photo-url'
import { StatusPill } from '@/components/attendance/StatusPill'

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
  profilePhotoId?: string | null
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

// Punch log pill: LogIn/LogOut icon + IN/OUT word + time (present tone for IN, muted for OUT).
function LogPill({ type, timestamp }: { type: string; timestamp: string }) {
  const isIn = type === 'IN'
  const Icon = isIn ? LogIn : LogOut
  return (
    <span
      className={cn(
        'inline-flex h-[24px] items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-[11px]',
        isIn ? 'tone-present tint-badge' : 'tone-muted border border-line bg-card-hi text-muted',
      )}
    >
      <Icon size={12} aria-hidden="true" />
      {type}
      <span className="num">{new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
    </span>
  )
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
    <div className="space-y-5">
      <PageHeader
        title="Member Attendance"
        subtitle="Detailed daily logs for individual staff members."
        actions={
          <Button
            variant="secondary"
            icon={Download}
            onClick={exportCSV}
            disabled={!staffData || dailyRecords.length === 0}
          >
            Export CSV
          </Button>
        }
      />

      <Card className="flex flex-col !p-0">
        {/* Filters */}
        <div className="flex flex-col items-stretch gap-4 border-b border-line-soft px-4 py-4 sm:flex-row sm:items-end sm:px-5">
          <div className="min-w-0 flex-1">
            <Field label="Staff member" htmlFor="member-staff">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                <Select
                  id="member-staff"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="pl-10"
                >
                  <option value="" disabled>Select Staff Member</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.machineId} - {staff.name}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>
          </div>

          <div className="w-full sm:w-56">
            <Field label="Month" htmlFor="member-month">
              <div className="relative">
                <CalendarIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                <Input
                  id="member-month"
                  type="month"
                  className="num pl-10"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
            </Field>
          </div>
        </div>

        {/* Summary Cards */}
        {staffData && !loading && (
          <div className="flex flex-col border-b border-line-soft">
            <div className="flex min-w-0 items-center gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
              <Avatar name={staffData.name} src={staffPhotoUrl(staffData)} />
              <div className="min-w-0">
                <p className="truncate font-medium text-text">{staffData.name}</p>
                <p className="truncate text-xs text-subtle">
                  <span className="num">{staffData.machineId}</span>
                  {' · '}
                  {staffData.designation?.name || 'No Role'} · {staffData.department?.name || 'No Dept'}
                </p>
              </div>
            </div>
            {payrollData && summary.totalPayrollEligibleDays !== payrollData.presentDays && (
              <div role="alert" className="flex items-start gap-3 border-b border-absent/30 bg-absent/10 p-4">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-absent" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-medium text-absent">Days Mismatch Detected</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    The system calculated <strong className="num text-text">{summary.totalPayrollEligibleDays}</strong> present days based on punches, but the generated payroll has been manually set to <strong className="num text-text">{payrollData.presentDays}</strong> present days.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 p-4 sm:p-5 md:grid-cols-6">
              <div className={cn(
                'col-span-2 flex flex-col items-center justify-center rounded-xl border p-4 text-center md:col-span-1',
                payrollData && summary.totalPayrollEligibleDays !== payrollData.presentDays ? 'border-absent/30 bg-absent/10' : 'border-acc-2/30 bg-acc-2/10',
              )}>
                <span className={cn('num mb-1 text-3xl', payrollData && summary.totalPayrollEligibleDays !== payrollData.presentDays ? 'text-absent' : 'text-acc-1')}>{summary.totalPayrollEligibleDays}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted">System Days</span>
              </div>

              {payrollData && (
                <div className="col-span-2 flex flex-col items-center justify-center rounded-xl border border-present/30 bg-present/10 p-4 text-center md:col-span-1">
                  <span className="num mb-1 text-3xl text-present">{payrollData.presentDays}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted">Paid Days</span>
                </div>
              )}

              <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-ground p-4 text-center">
                <span className="num mb-1 text-3xl text-present">{summary.totalPresents}</span>
                <span className="text-xs uppercase tracking-wider text-muted">Presents</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-ground p-4 text-center">
                <span className="num mb-1 text-3xl text-absent">{summary.totalAbsents}</span>
                <span className="text-xs uppercase tracking-wider text-muted">Absents</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-ground p-4 text-center">
                <span className="num mb-1 text-3xl text-late">{summary.totalHalfDays}</span>
                <span className="text-xs uppercase tracking-wider text-muted">Half Days</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-ground p-4 text-center">
                <span className="num mb-1 text-3xl text-late">{summary.totalLateMinutes}</span>
                <span className="text-xs uppercase tracking-wider text-muted">Late (Mins)</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-xl border border-line bg-ground p-4 text-center">
                <span className="num mb-1 text-3xl text-acc-1">{(summary.totalWorkMinutes / 60).toFixed(1)}</span>
                <span className="text-xs uppercase tracking-wider text-muted">Work Hours</span>
              </div>
            </div>
          </div>
        )}

        <div className="table-wrap hidden min-h-[500px] md:block">
          <table className="data-table min-w-[900px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Payroll Day</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th className="text-right">Late / Work Hrs</th>
                <th>Punch Logs</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>
                    <div className="space-y-3 p-4" role="status">
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                      <p className="text-center text-sm text-muted">Fetching member records...</p>
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
                      <td>
                        <div className="flex flex-col">
                          <span className={cn('num whitespace-nowrap', isWeekend ? 'text-acc-1' : 'text-text')}>{dateStr}</span>
                          <span className={cn('mt-1 w-fit rounded px-1.5 py-0.5 text-xs uppercase tracking-widest', isWeekend ? 'bg-acc-3/30 text-acc-1' : 'bg-card-hi text-muted')}>
                            {dayName}
                          </span>
                        </div>
                      </td>
                      <td>
                        <StatusPill status={record.status} />
                        {record.isSandwiched && (
                          <span className="mt-1 block text-[10px] uppercase tracking-wider text-absent">Sandwiched (Unpaid)</span>
                        )}
                      </td>
                      <td>
                        <span className={cn(
                          'num inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
                          record.payrollEligible === 1 ? 'border-acc-2/30 bg-acc-2/10 text-acc-1' :
                          record.payrollEligible === 0.5 ? 'border-late/30 bg-late/10 text-late' :
                          'border-line bg-card-hi text-muted',
                        )}>
                          +{record.payrollEligible} Day
                        </span>
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
                      <td>
                        {(() => {
                          const formattedLogs = formatLogsWithDirection(record.logs);
                          return formattedLogs.length > 0 ? (
                            <div className="flex max-w-xs flex-wrap gap-2">
                              {formattedLogs.map((log) => (
                                <LogPill key={log.id} type={log.type} timestamp={log.timestamp} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-subtle">No Punches</span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="!p-0">
                    <EmptyState icon={UserCheck} title="No Records Found" hint="Select a different staff member or month." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Day Cards */}
        <div className="space-y-3 p-4 md:hidden">
          {loading ? (
            <div className="space-y-3" role="status">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <p className="text-center text-sm text-muted">Fetching member records...</p>
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
                record.status === 'PRESENT' ? 'border-l-present' :
                record.status === 'ABSENT' ? 'border-l-absent' :
                record.status === 'HOLIDAY' ? 'border-l-line' :
                record.status === 'WEEKOFF' ? 'border-l-muted' :
                'border-l-late'

              return (
                <div key={record.id} className={cn('rounded-xl border border-line border-l-4 bg-card p-3.5', accent, isWeekend && 'bg-card-hi')}>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-12 shrink-0 rounded-xl border py-1.5 text-center', isWeekend ? 'border-acc-2/30 bg-acc-2/10' : 'border-line bg-ground')}>
                      <p className={cn('num text-xl leading-none', isWeekend ? 'text-acc-1' : 'text-text')}>{dayNum}</p>
                      <p className="mt-1 text-[9px] uppercase tracking-wider text-subtle">{monthShort}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={record.status} />
                        <span className="text-[10px] uppercase tracking-widest text-subtle">{dayName}</span>
                      </div>
                      {record.isSandwiched && (
                        <p className="mt-1 text-[10px] uppercase tracking-wider text-absent">Sandwiched (Unpaid)</p>
                      )}
                    </div>
                    <span className={cn(
                      'num shrink-0 rounded-lg border px-2 py-1 text-xs',
                      record.payrollEligible === 1 ? 'border-acc-2/30 bg-acc-2/10 text-acc-1' :
                      record.payrollEligible === 0.5 ? 'border-late/30 bg-late/10 text-late' :
                      'border-line bg-card-hi text-muted',
                    )}>
                      +{record.payrollEligible ?? 0}
                    </span>
                  </div>

                  {!noWork && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-line bg-ground px-2.5 py-2">
                        <p className="text-[9px] uppercase tracking-wider text-subtle">In</p>
                        <p className="num whitespace-nowrap text-[13px] text-present">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-ground px-2.5 py-2">
                        <p className="text-[9px] uppercase tracking-wider text-subtle">Out</p>
                        <p className="num whitespace-nowrap text-[13px] text-absent">{record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</p>
                      </div>
                      <div className="rounded-xl border border-line bg-ground px-2.5 py-2">
                        <p className="text-[9px] uppercase tracking-wider text-subtle">Hours</p>
                        <p className="num text-[13px] text-text">{(record.workMinutes / 60).toFixed(1)}</p>
                      </div>
                    </div>
                  )}

                  {!noWork && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {record.lateMinutes > 0 ? (
                        <span className="tone-late tint-badge inline-flex h-[22px] items-center rounded-full px-2 text-[11px]"><span className="num mr-1">{record.lateMinutes}</span> mins late</span>
                      ) : (
                        <span className="tone-present tint-badge inline-flex h-[22px] items-center rounded-full px-2 text-[11px]">On time</span>
                      )}
                      {(() => {
                        const formattedLogs = formatLogsWithDirection(record.logs);
                        return formattedLogs.length > 0 ? formattedLogs.map((log) => (
                          <LogPill key={log.id} type={log.type} timestamp={log.timestamp} />
                        )) : (
                          <span className="text-[10px] text-subtle">No punches</span>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <EmptyState icon={UserCheck} title="No Records Found" hint="Select a different staff member or month." />
          )}
        </div>
      </Card>
    </div>
  )
}
