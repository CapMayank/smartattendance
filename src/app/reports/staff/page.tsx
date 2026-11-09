'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Avatar,
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
} from '@/components/ui'
import {
  Users,
  Download,
  Calendar,
  Building2,
  Clock,
  IdCard,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  UserCheck,
  LogOut as ExitIcon,
} from 'lucide-react'
import Papa from 'papaparse'
import { istDateKey } from '@/lib/dashboard-calc'
import { formatDate } from '@/lib/format'
import { toast } from 'sonner'

type MemberRow = {
  id: string
  name: string
  machineId: string
  employeeCode: string | null
  status: 'ACTIVE' | 'EXITED' | 'NEEDS_JOINING_DATE'
  joiningDate: string | null
  department: string
  designation: string
  payGroup: 'BANK_EPF' | 'CASH'
  role: string
  email: string | null
  mobileNumber: string | null
}

type ExitRow = {
  id: string
  staffId: string
  name: string
  employeeCode: string | null
  machineId: string
  department: string
  designation: string
  startDate: string
  endDate: string
  exitReason: string
  notes: string | null
  currentStatus: string
  tenureDays: number
}

type JoiningRow = {
  id: string
  staffId: string
  name: string
  employeeCode: string | null
  machineId: string
  date: string
  year: number
  department: string
  designation: string
  status: string
  isRejoin: boolean
}

type DeptStat = {
  id: string
  name: string
  totalStaff: number
  activeStaff: number
  sharePercent: number
  designations: { name: string; count: number }[]
}

type ReportData = {
  summary: {
    total: number
    active: number
    exited: number
    bankEpf: number
    cash: number
  }
  members: MemberRow[]
  exits: ExitRow[]
  joinings: JoiningRow[]
  departments: DeptStat[]
}

function formatTenure(days: number): string {
  if (days < 30) return `${days} days`
  const months = Math.floor(days / 30.4375)
  if (months < 12) return `${months} mos`
  const years = Math.floor(months / 12)
  const remMonths = months % 12
  return remMonths > 0 ? `${years} yrs ${remMonths} mos` : `${years} yrs`
}

export default function StaffReportsPage() {
  const router = useRouter()
  const todayKey = istDateKey(new Date())

  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'members' | 'exits' | 'joinings' | 'departments'>('members')

  // Filters for Members tab
  const [memberSearch, setMemberSearch] = useState('')
  const [memberDeptFilter, setMemberDeptFilter] = useState('ALL')
  const [memberStatusFilter, setMemberStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXITED'>('ALL')

  // Filters for Exits tab
  const [exitSearch, setExitSearch] = useState('')

  // Filters for Joinings tab
  const [selectedJoiningYear, setSelectedJoiningYear] = useState<string>('ALL')

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        const res = await fetch('/api/reports/staff')
        if (res.ok) {
          const json = await res.json()
          setData(json)
        } else {
          toast.error('Failed to load staff reports data')
        }
      } catch (err) {
        console.error('Failed fetching staff report data:', err)
        toast.error('Network error loading reports')
      } finally {
        setLoading(false)
      }
    }
    fetchReportData()
  }, [])

  // Unique joining years
  const availableYears = useMemo(() => {
    if (!data?.joinings) return []
    const set = new Set<number>()
    data.joinings.forEach((j) => set.add(j.year))
    return Array.from(set).sort((a, b) => b - a)
  }, [data])

  // Filtered Members
  const filteredMembers = useMemo(() => {
    if (!data?.members) return []
    const q = memberSearch.trim().toLowerCase()
    return data.members.filter((m) => {
      if (memberDeptFilter !== 'ALL' && m.department !== memberDeptFilter) return false
      if (memberStatusFilter !== 'ALL' && m.status !== memberStatusFilter) return false
      if (!q) return true
      return (
        m.name.toLowerCase().includes(q) ||
        (m.employeeCode ?? '').toLowerCase().includes(q) ||
        m.machineId.toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [data, memberSearch, memberDeptFilter, memberStatusFilter])

  // Filtered Exits
  const filteredExits = useMemo(() => {
    if (!data?.exits) return []
    const q = exitSearch.trim().toLowerCase()
    return data.exits.filter((e) => {
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        (e.employeeCode ?? '').toLowerCase().includes(q) ||
        e.exitReason.toLowerCase().includes(q) ||
        (e.notes ?? '').toLowerCase().includes(q)
      )
    })
  }, [data, exitSearch])

  // Filtered Joinings
  const filteredJoinings = useMemo(() => {
    if (!data?.joinings) return []
    if (selectedJoiningYear === 'ALL') return data.joinings
    const y = parseInt(selectedJoiningYear, 10)
    return data.joinings.filter((j) => j.year === y)
  }, [data, selectedJoiningYear])

  // Joining Metrics for selected year
  const joiningMetrics = useMemo(() => {
    const list = filteredJoinings
    const total = list.length
    const active = list.filter((j) => j.status === 'ACTIVE').length
    const retentionRate = total > 0 ? Math.round((active / total) * 100) : 0
    return { total, active, retentionRate }
  }, [filteredJoinings])

  // Contextual CSV Export
  const exportCurrentTabCsv = () => {
    if (!data) return
    let csvRows: any[] = []
    let filename = `Sarvodaya_Staff_${activeTab}_${todayKey}.csv`

    if (activeTab === 'members') {
      csvRows = filteredMembers.map((m) => ({
        'Employee ID': m.employeeCode || '-',
        'Name': m.name,
        'Machine ID': m.machineId,
        'Status': m.status,
        'Department': m.department,
        'Role': m.designation,
        'Pay Group': m.payGroup,
        'Joining Date': m.joiningDate ? formatDate(m.joiningDate) : '-',
        'Email': m.email || '-',
        'Mobile': m.mobileNumber || '-',
      }))
    } else if (activeTab === 'exits') {
      csvRows = filteredExits.map((e) => ({
        'Employee ID': e.employeeCode || '-',
        'Name': e.name,
        'Department': e.department,
        'Stint Start Date': formatDate(e.startDate),
        'Last Working Day': formatDate(e.endDate),
        'Tenure': formatTenure(e.tenureDays),
        'Exit Reason': e.exitReason,
        'Notes': e.notes || '-',
      }))
    } else if (activeTab === 'joinings') {
      csvRows = filteredJoinings.map((j) => ({
        'Year': j.year,
        'Joining Date': formatDate(j.date),
        'Employee ID': j.employeeCode || '-',
        'Name': j.name,
        'Department': j.department,
        'Role': j.designation,
        'Tenure Type': j.isRejoin ? 'Rejoin / 2nd Tenure' : 'Initial Hire',
        'Current Status': j.status,
      }))
    } else if (activeTab === 'departments') {
      csvRows = data.departments.map((d) => ({
        'Department': d.name,
        'Active Headcount': d.activeStaff,
        'Total Assigned': d.totalStaff,
        'Share of School (%)': `${d.sharePercent}%`,
        'Designation Breakdown': d.designations.map((des) => `${des.name}: ${des.count}`).join('; '),
      }))
    }

    const csv = Papa.unparse(csvRows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff &amp; Headcount Reports"
        subtitle="Comprehensive roster analytics, historical leavers, annual recruitment metrics, and department distributions"
        actions={
          <Button variant="secondary" icon={Download} onClick={exportCurrentTabCsv} disabled={loading || !data}>
            Export Tab CSV
          </Button>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Total Roster</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-text">
              {loading ? <Skeleton className="h-7 w-12" /> : data?.summary.total}
            </span>
            <span className="text-xs text-subtle">all-time records</span>
          </div>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-present">Active Staff</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-present">
              {loading ? <Skeleton className="h-7 w-12" /> : data?.summary.active}
            </span>
            <span className="text-xs text-subtle">currently on duty</span>
          </div>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-absent">Exited Staff</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-absent">
              {loading ? <Skeleton className="h-7 w-12" /> : data?.summary.exited}
            </span>
            <span className="text-xs text-subtle">former members</span>
          </div>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-acc-1">Bank EPF / Cash</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="num text-2xl font-bold text-text">
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                `${data?.summary.bankEpf} / ${data?.summary.cash}`
              )}
            </span>
            <span className="text-xs text-subtle">pay group split</span>
          </div>
        </Card>
      </div>

      {/* Main Content Area */}
      <Card className="overflow-hidden !p-0">
        <div className="border-b border-line-soft px-4 pt-3">
          <Tabs
            tabs={[
              { id: 'members', label: 'All Members' },
              { id: 'exits', label: 'Exited Members' },
              { id: 'joinings', label: 'Joinings by Year' },
              { id: 'departments', label: 'Department Distribution' },
            ]}
            value={activeTab}
            onChange={(t) => setActiveTab(t as any)}
          />
        </div>

        {/* TAB 1: ALL MEMBERS */}
        {activeTab === 'members' && (
          <div className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={memberDeptFilter}
                  onChange={(e) => setMemberDeptFilter(e.target.value)}
                  className="w-44 text-xs"
                >
                  <option value="ALL">All Departments</option>
                  {data?.departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </Select>

                <Select
                  value={memberStatusFilter}
                  onChange={(e) => setMemberStatusFilter(e.target.value as any)}
                  className="w-36 text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="EXITED">Exited Only</option>
                </Select>
              </div>

              <div className="relative w-full sm:w-64">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                <Input
                  type="search"
                  placeholder="Search roster..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Employee ID &amp; Machine</th>
                    <th>Status</th>
                    <th>Department / Role</th>
                    <th>Pay Group</th>
                    <th>Joining Date</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7}>
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : filteredMembers.length > 0 ? (
                    filteredMembers.map((m) => (
                      <tr key={m.id} className={m.status === 'EXITED' ? 'opacity-65' : undefined}>
                        <td>
                          <span className="font-medium text-text">{m.name}</span>
                        </td>
                        <td>
                          <div className="flex flex-col items-start gap-0.5">
                            <span className="num rounded border border-line bg-card-hi px-1.5 py-0.5 text-xs font-semibold text-acc-1">
                              {m.employeeCode || 'No SAR ID'}
                            </span>
                            <span className="num text-[11px] text-subtle">Machine #{m.machineId}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              m.status === 'ACTIVE' ? 'tint-badge tone-present' : 'tint-badge tone-absent'
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col gap-0.5 text-xs">
                            <span className="text-text">{m.department}</span>
                            <span className="text-subtle">{m.designation}</span>
                          </div>
                        </td>
                        <td>
                          <span className="rounded bg-canvas px-1.5 py-0.5 text-[11px] text-muted">
                            {m.payGroup}
                          </span>
                        </td>
                        <td>
                          <span className="num text-xs text-text">{m.joiningDate ? formatDate(m.joiningDate) : '-'}</span>
                        </td>
                        <td>
                          <div className="flex flex-col text-[11px] text-subtle">
                            {m.email && <span>{m.email}</span>}
                            {m.mobileNumber && <span>{m.mobileNumber}</span>}
                            {!m.email && !m.mobileNumber && <span>-</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState icon={Users} title="No members match filters" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: EXITED MEMBERS */}
        {activeTab === 'exits' && (
          <div className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-subtle">
                Historical log of past departures, reasons, tenure duration, and 1-click reactivation.
              </p>
              <div className="relative w-full sm:w-64">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                <Input
                  type="search"
                  placeholder="Search exits..."
                  value={exitSearch}
                  onChange={(e) => setExitSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Former Member</th>
                    <th>Department</th>
                    <th>Stint Period</th>
                    <th>Tenure Duration</th>
                    <th>Exit Reason &amp; Notes</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : filteredExits.length > 0 ? (
                    filteredExits.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-medium text-text">{e.name}</span>
                            <span className="num text-xs text-subtle">
                              {e.employeeCode ? `${e.employeeCode} · ` : ''}Machine #{e.machineId}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-text">{e.department}</span>
                        </td>
                        <td>
                          <span className="num text-xs text-muted">
                            {formatDate(e.startDate)} → {formatDate(e.endDate)}
                          </span>
                        </td>
                        <td>
                          <span className="num rounded bg-card-hi px-2 py-0.5 text-xs font-semibold text-text">
                            {formatTenure(e.tenureDays)}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col text-xs">
                            <span className="font-medium text-text">{e.exitReason}</span>
                            {e.notes && <span className="text-subtle">{e.notes}</span>}
                          </div>
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={RotateCcw}
                              onClick={() => router.push(`/staff?rejoin=${e.staffId}`)}
                            >
                              Reactivate
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState icon={ExitIcon} title="No exited member records" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: JOININGS BY YEAR */}
        {activeTab === 'joinings' && (
          <div className="space-y-4 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-text">Select Recruitment Year:</span>
                <Select
                  value={selectedJoiningYear}
                  onChange={(e) => setSelectedJoiningYear(e.target.value)}
                  className="w-36 text-xs"
                >
                  <option value="ALL">All Years</option>
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      Year {y}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Recruitment metrics banner */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card-hi px-3.5 py-2 text-xs">
                <span>
                  New Joiners:{' '}
                  <b className="num text-text">{joiningMetrics.total}</b>
                </span>
                <span>·</span>
                <span>
                  Retained Active:{' '}
                  <b className="num text-present">{joiningMetrics.active}</b>
                </span>
                <span>·</span>
                <span>
                  Retention Rate:{' '}
                  <b className="num text-acc-1">{joiningMetrics.retentionRate}%</b>
                </span>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Joining Date</th>
                    <th>Employee ID</th>
                    <th>Member Name</th>
                    <th>Department &amp; Role</th>
                    <th>Stint Type</th>
                    <th>Current Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6}>
                          <Skeleton className="h-8 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : filteredJoinings.length > 0 ? (
                    filteredJoinings.map((j) => (
                      <tr key={j.id}>
                        <td>
                          <span className="num font-medium text-text">{formatDate(j.date)}</span>
                        </td>
                        <td>
                          <span className="num text-xs font-semibold text-acc-1">
                            {j.employeeCode || '-'}
                          </span>
                        </td>
                        <td>
                          <span className="font-medium text-text">{j.name}</span>
                        </td>
                        <td>
                          <div className="flex flex-col text-xs">
                            <span className="text-text">{j.department}</span>
                            <span className="text-subtle">{j.designation}</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                              j.isRejoin ? 'bg-acc-2/10 text-acc-1' : 'bg-canvas text-muted'
                            }`}
                          >
                            {j.isRejoin ? 'Rejoin / 2nd Tenure' : 'Initial Hire'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              j.status === 'ACTIVE' ? 'tint-badge tone-present' : 'tint-badge tone-absent'
                            }`}
                          >
                            {j.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState icon={Calendar} title="No joinings for this period" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DEPARTMENT DISTRIBUTION */}
        {activeTab === 'departments' && (
          <div className="space-y-4 p-4">
            <p className="text-xs text-subtle">
              Staffing breakdown and active headcount proportion across academic departments and administrative wings.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data?.departments.map((dept) => (
                <div key={dept.id} className="rounded-2xl border border-line bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line-soft pb-2.5">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-acc-1" />
                      <h4 className="font-semibold text-text text-sm">{dept.name}</h4>
                    </div>
                    <span className="num rounded-md bg-card-hi px-2.5 py-0.5 text-xs font-bold text-acc-1">
                      {dept.activeStaff} Active ({dept.sharePercent}%)
                    </span>
                  </div>

                  {/* Share Progress Bar */}
                  <div className="space-y-1">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-canvas border border-line-soft">
                      <div
                        className="h-full bg-acc-1 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(dept.sharePercent, 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-subtle">{dept.totalStaff} total registered records</span>
                  </div>

                  {/* Designation Breakdown */}
                  {dept.designations.length > 0 && (
                    <div className="pt-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Designation Breakdown
                      </span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {dept.designations.map((des) => (
                          <span
                            key={des.name}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card-hi px-2 py-1 text-xs text-muted"
                          >
                            <span>{des.name}</span>
                            <span className="num font-bold text-text">{des.count}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
