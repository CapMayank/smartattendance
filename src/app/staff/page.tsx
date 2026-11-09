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
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/ui'
import {
  UserPlus,
  Upload,
  Download,
  Users,
  Calendar,
  KeyRound,
  Copy,
  Check,
  Shield,
  UserCheck,
  AlertTriangle,
  Pencil,
  Search,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'
import { istDateKey } from '@/lib/dashboard-calc'
import { formatDate } from '@/lib/format'
import { triggerPhotoCleanup } from '@/lib/photo-cleanup-client'
import { staffPhotoUrl } from '@/lib/photo-url'
import {
  StaffOnboardModal,
  type ExitedStaffItem,
  type IssuedCredential,
} from '@/components/staff/StaffOnboardModal'
import { StaffBulkImportModal } from '@/components/staff/StaffBulkImportModal'
import { StaffProfileModal } from '@/components/staff/StaffProfileModal'

type EmploymentPeriodRow = {
  id: string
  startDate: string
  endDate: string | null
  exitReason: string | null
  notes: string | null
}

type Staff = {
  id: string
  machineId: string
  employeeCode?: string | null
  joiningDate?: string | null
  name: string
  shiftId?: string | null
  hasPhoto?: boolean
  profilePhotoId?: string | null
  department?: { id?: string; name: string } | null
  designation?: { id?: string; name: string } | null
  shift?: { id?: string; name: string; startTime: string; endTime: string } | null
  user?: {
    id: string
    email: string | null
    role: 'ADMIN' | 'APPROVER' | 'EMPLOYEE'
    disabledAt: string | null
    mustChangePassword: boolean
    approvesAllDepartments?: boolean
    approverDepartments?: { departmentId: string }[]
  } | null
  payrollInfo?: {
    payGroup?: 'BANK_EPF' | 'CASH'
    mobileNumber?: string | null
    dob?: string | null
    gender?: string | null
    fatherHusbandName?: string | null
    relationship?: string | null
    qualification?: string | null
    nationality?: string | null
    bankAccount?: string | null
    ifsc?: string | null
    nameAsPerBank?: string | null
    pan?: string | null
    aadhaar?: string | null
    uan?: string | null
    email?: string | null
  } | null
  employmentPeriods?: EmploymentPeriodRow[]
}

type FilterMode = 'active' | 'all' | 'needs_onboarding' | 'exited' | 'admins'

function getStaffLifecycleStatus(staff: Staff): 'ACTIVE' | 'EXITED' | 'NEEDS_JOINING_DATE' {
  const periods = staff.employmentPeriods ?? []
  if (periods.length > 0) {
    const hasOpen = periods.some((p) => !p.endDate)
    return hasOpen ? 'ACTIVE' : 'EXITED'
  }
  if (staff.user?.disabledAt) return 'EXITED'
  if (staff.employeeCode || staff.joiningDate) return 'ACTIVE'
  return 'NEEDS_JOINING_DATE'
}

function toInputDate(isoOrNull?: string | null): string {
  if (!isoOrNull) return ''
  return isoOrNull.slice(0, 10)
}

export default function StaffPage() {
  const router = useRouter()
  const todayKey = istDateKey(new Date())

  const [staffList, setStaffList] = useState<Staff[]>([])
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([])
  const [desigs, setDesigs] = useState<{ id: string; name: string }[]>([])
  const [shifts, setShifts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)

  // Default to 'active' as requested
  const [filterMode, setFilterMode] = useState<FilterMode>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Modals state
  const [onboardModalOpen, setOnboardModalOpen] = useState(false)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [profileModalStaff, setProfileModalStaff] = useState<Staff | null>(null)
  const [initialRejoinStaffId, setInitialRejoinStaffId] = useState<string | null>(null)

  // Issued credentials modal state
  const [issuedCredentials, setIssuedCredentials] = useState<IssuedCredential[] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [resettingStaffId, setResettingStaffId] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const [sRes, dRes, desRes, shRes] = await Promise.all([
        fetch('/api/staff'),
        fetch('/api/departments'),
        fetch('/api/designations'),
        fetch('/api/shifts'),
      ])
      if (sRes.ok) setStaffList(await sRes.json())
      if (dRes.ok) setDepts(await dRes.json())
      if (desRes.ok) setDesigs(await desRes.json())
      if (shRes.ok) setShifts(await shRes.json())
    } catch (e) {
      console.error('Failed to load staff directory:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    triggerPhotoCleanup()
  }, [])

  // Check URL query parameters for ?rejoin=<id>
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const rejoinId = urlParams.get('rejoin')
      if (rejoinId) {
        setInitialRejoinStaffId(rejoinId)
        setOnboardModalOpen(true)
      }
    }
  }, [])

  const exitedStaffList: ExitedStaffItem[] = useMemo(() => {
    return staffList.filter((s) => getStaffLifecycleStatus(s) === 'EXITED')
  }, [staffList])

  const counts = useMemo(() => {
    let active = 0
    let needsOnboarding = 0
    let exited = 0
    let admins = 0
    for (const s of staffList) {
      const status = getStaffLifecycleStatus(s)
      if (status === 'ACTIVE') active++
      else if (status === 'NEEDS_JOINING_DATE') needsOnboarding++
      else if (status === 'EXITED') exited++
      if (s.user?.role === 'ADMIN' || s.user?.role === 'APPROVER') admins++
    }
    return { all: staffList.length, active, needsOnboarding, exited, admins }
  }, [staffList])

  const filteredStaff = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return staffList.filter((s) => {
      const status = getStaffLifecycleStatus(s)
      const role = s.user?.role ?? 'EMPLOYEE'

      if (filterMode === 'active' && status !== 'ACTIVE') return false
      if (filterMode === 'needs_onboarding' && status !== 'NEEDS_JOINING_DATE') return false
      if (filterMode === 'exited' && status !== 'EXITED') return false
      if (filterMode === 'admins' && role !== 'ADMIN' && role !== 'APPROVER') return false

      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.machineId.toLowerCase().includes(q) ||
        (s.employeeCode ?? '').toLowerCase().includes(q) ||
        (s.user?.email ?? '').toLowerCase().includes(q) ||
        (s.department?.name ?? '').toLowerCase().includes(q)
      )
    })
  }, [staffList, filterMode, searchQuery])

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredStaff.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredStaff.map((s) => s.id))
    }
  }

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((sid) => sid !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const handleBulkAssignShift = async (shiftId: string) => {
    if (!shiftId) return
    const shiftName = shifts.find((s) => s.id === shiftId)?.name ?? 'the selected shift'
    if (!confirm(`Assign ${selectedIds.length} staff to ${shiftName}? It takes effect today.`)) return

    try {
      const res = await fetch('/api/staff/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds, shiftId }),
      })
      if (res.ok) {
        setSelectedIds([])
        fetchData()
        toast.success(`${selectedIds.length} staff assigned to ${shiftName}`)
      } else {
        toast.error('Failed to assign shift')
      }
    } catch {
      toast.error('Network error during shift assignment')
    }
  }

  const exportSelectedCsv = () => {
    const selectedStaff = staffList.filter((s) => selectedIds.includes(s.id))
    const header = 'Name,Machine ID,Employee ID,Department,Role,Shift,Pay Group,Joining Date\n'
    const rows = selectedStaff
      .map(
        (s) =>
          `"${s.name.replace(/"/g, '""')}","${s.machineId}","${s.employeeCode || ''}","${s.department?.name || ''}","${s.designation?.name || ''}","${s.shift?.name || ''}","${s.payrollInfo?.payGroup || 'BANK_EPF'}","${s.joiningDate || ''}"`
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `selected_staff_${todayKey}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleResetTempPassword = async (staff: Staff) => {
    setResettingStaffId(staff.id)
    try {
      const res = await fetch(`/api/staff/${staff.id}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_PASSWORD', joiningDate: todayKey }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.temporaryPassword) {
        await fetchData()
        setIssuedCredentials([
          {
            name: staff.name,
            machineId: staff.machineId,
            employeeCode: data.employeeCode || staff.employeeCode || '',
            temporaryPassword: data.temporaryPassword,
          },
        ])
        toast.success(`Issued new temporary password for ${staff.name}`)
      } else {
        toast.error(data?.error || 'Failed to issue temporary password')
      }
    } catch {
      toast.error('Failed to issue temporary password')
    } finally {
      setResettingStaffId(null)
    }
  }

  const downloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Name,Machine ID,Joining Date,Department,Designation,Shift,Pay Group\nJohn Doe,1001,2026-04-01,Teaching,Senior Teacher,General Shift,BANK_EPF\nJane Smith,1002,2026-04-01,Administration,Coordinator,General Shift,CASH'
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'staff_onboarding_template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadCredentialsCsv = (creds: IssuedCredential[]) => {
    const header = 'Name,Machine ID,Employee ID,One-Time Temporary Password\n'
    const rows = creds
      .map(
        (c) =>
          `"${(c.name || '').replace(/"/g, '""')}","${c.machineId || ''}","${c.employeeCode}","${c.temporaryPassword}"`
      )
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `issued_credentials_${todayKey}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const copyCredentialRow = async (c: IssuedCredential, idx: number) => {
    const text = `Employee Name: ${c.name}\nEmployee ID: ${c.employeeCode}\nTemporary Password: ${c.temporaryPassword}`
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(idx)
      toast.success('Copied credentials to clipboard')
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff Directory &amp; Access"
        subtitle="Manage active school teachers, biometric machine IDs, system roles, and complete profile records"
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              icon={Download}
              onClick={downloadTemplate}
            >
              Template
            </Button>
            <Button
              variant="secondary"
              icon={Upload}
              onClick={() => setBulkModalOpen(true)}
            >
              Import CSV
            </Button>
            <Button
              icon={UserPlus}
              onClick={() => {
                setInitialRejoinStaffId(null)
                setOnboardModalOpen(true)
              }}
            >
              Onboard Staff
            </Button>
          </div>
        }
      />

      {/* Directory Table Card */}
      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col justify-between gap-3 border-b border-line-soft p-4 lg:flex-row lg:items-center">
          <ChipGroup label="Filter staff directory">
            <Chip
              pressed={filterMode === 'active'}
              onClick={() => setFilterMode('active')}
              dot="present"
              count={counts.active}
            >
              Active
            </Chip>
            {counts.needsOnboarding > 0 && (
              <Chip
                pressed={filterMode === 'needs_onboarding'}
                onClick={() => setFilterMode('needs_onboarding')}
                dot="late"
                count={counts.needsOnboarding}
              >
                Needs joining date
              </Chip>
            )}
            <Chip
              pressed={filterMode === 'admins'}
              onClick={() => setFilterMode('admins')}
              dot="accent"
              count={counts.admins}
            >
              Admins &amp; Approvers
            </Chip>
            {counts.exited > 0 && (
              <Chip
                pressed={filterMode === 'exited'}
                onClick={() => setFilterMode('exited')}
                dot="absent"
                count={counts.exited}
              >
                Exited
              </Chip>
            )}
            <Chip
              pressed={filterMode === 'all'}
              onClick={() => setFilterMode('all')}
              count={counts.all}
            >
              All Records
            </Chip>
          </ChipGroup>

          <div className="relative w-full lg:w-72">
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, SAR ID, machine..."
              aria-label="Search staff"
              className="pl-9"
            />
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-b border-line-soft bg-card-hi px-5 py-3 sm:flex-row">
            <span className="num shrink-0 text-[13px] text-text">{selectedIds.length} staff selected</span>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <Select
                aria-label="Bulk assign shift"
                onChange={(e) => handleBulkAssignShift(e.target.value)}
                value=""
                className="w-full sm:w-auto"
              >
                <option value="" disabled>
                  Bulk Assign Shift...
                </option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>

              <Button
                variant="secondary"
                icon={Download}
                onClick={exportSelectedCsv}
                className="w-full sm:w-auto"
              >
                Export Selected
              </Button>
            </div>
          </div>
        )}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    aria-label="Select all staff"
                    className="size-4 cursor-pointer accent-acc-2"
                    checked={filteredStaff.length > 0 && selectedIds.length === filteredStaff.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Staff Member</th>
                <th>Employee ID &amp; Machine</th>
                <th>Access &amp; Status</th>
                <th>Department / Role</th>
                <th>Pay Group &amp; Shift</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td>
                        <Skeleton className="size-4" />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Skeleton className="size-[38px] rounded-xl" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                      </td>
                      <td>
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td>
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td>
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td>
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td>
                        <Skeleton className="ml-auto h-8 w-28" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : filteredStaff.length > 0 ? (
                filteredStaff.map((staff) => {
                  const status = getStaffLifecycleStatus(staff)
                  const role = staff.user?.role ?? 'EMPLOYEE'
                  const payGroup = staff.payrollInfo?.payGroup ?? 'BANK_EPF'
                  const stintCount = staff.employmentPeriods?.length ?? 1

                  return (
                    <tr key={staff.id} className={status === 'EXITED' ? 'opacity-65' : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${staff.name}`}
                          className="size-4 cursor-pointer accent-acc-2"
                          checked={selectedIds.includes(staff.id)}
                          onChange={() => toggleSelect(staff.id)}
                        />
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={staff.name} src={staffPhotoUrl(staff)} size={38} />
                          <div className="flex flex-col">
                            <span className="font-medium text-text">{staff.name}</span>
                            {staff.user?.email ? (
                              <span className="text-xs text-subtle">{staff.user.email}</span>
                            ) : (
                              <span className="text-xs text-subtle">
                                {staff.joiningDate ? `Joined ${formatDate(staff.joiningDate)}` : 'No joining date set'}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          {staff.employeeCode ? (
                            <span className="num inline-flex items-center rounded-md border border-line bg-card-hi px-2 py-0.5 text-[12.5px] font-medium text-acc-1">
                              {staff.employeeCode}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setProfileModalStaff(staff)}
                              className="tint-badge tone-late inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium"
                            >
                              <AlertTriangle size={12} aria-hidden="true" />
                              Set joining date
                            </button>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="num text-xs text-subtle">Machine #{staff.machineId}</span>
                            {stintCount > 1 && (
                              <span className="rounded bg-acc-2/10 px-1 text-[10px] font-semibold text-acc-1">
                                {stintCount}x Tenure
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={
                              role === 'ADMIN'
                                ? 'tint-badge tone-accent inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium'
                                : role === 'APPROVER'
                                  ? 'tint-badge tone-leave inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium'
                                  : 'inline-flex items-center gap-1 rounded-full border border-line bg-card-hi px-2.5 py-0.5 text-xs text-muted'
                            }
                          >
                            {role === 'ADMIN' ? (
                              <Shield size={12} aria-hidden="true" />
                            ) : (
                              <UserCheck size={12} aria-hidden="true" />
                            )}
                            {role === 'ADMIN' ? 'Admin' : role === 'APPROVER' ? 'Approver' : 'Employee'}
                          </span>

                          {status === 'EXITED' ? (
                            <span className="tint-badge tone-absent inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium">
                              Exited
                            </span>
                          ) : status === 'ACTIVE' ? (
                            <span className="tint-badge tone-present inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium">
                              Active
                            </span>
                          ) : null}

                          {staff.user?.mustChangePassword && status !== 'EXITED' && (
                            <span
                              title="Using temporary password until first sign-in"
                              className="rounded-full border border-line-soft bg-canvas px-2 py-0.5 text-[11px] text-subtle"
                            >
                              Temp PW
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-text">
                            {staff.department?.name || <span className="text-subtle">No Dept</span>}
                          </span>
                          <span className="text-xs text-subtle">{staff.designation?.name || 'Unassigned Role'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <span className="rounded-md border border-line-soft bg-canvas px-2 py-0.5 text-[11px] font-medium text-muted">
                            {payGroup === 'CASH' ? 'CASH' : 'BANK / EPF'}
                          </span>
                          {staff.shift ? (
                            <span className="text-xs text-muted">{staff.shift.name}</span>
                          ) : (
                            <span className="text-xs text-subtle">No Shift</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <IconButton
                            icon={KeyRound}
                            label={`Issue or reset temporary password for ${staff.name}`}
                            className="size-8 hover:border-acc-2 hover:text-acc-1"
                            disabled={resettingStaffId === staff.id || status === 'EXITED'}
                            onClick={() => handleResetTempPassword(staff)}
                          />
                          <IconButton
                            icon={Calendar}
                            label="View Attendance"
                            className="size-8"
                            onClick={() => router.push(`/reports/member-attendance?staffId=${staff.id}`)}
                          />
                          <IconButton
                            icon={Pencil}
                            label="View & Edit Full Profile"
                            className="size-8 hover:border-acc-2 hover:text-acc-1"
                            onClick={() => setProfileModalStaff(staff)}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={Users}
                      title={
                        filterMode === 'active'
                          ? 'No active staff members'
                          : filterMode === 'exited'
                            ? 'No exited staff members'
                            : 'No matching staff members'
                      }
                      hint="Click 'Onboard Staff' above or adjust your search filter."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Onboard Modal (New Hire & Rejoin) */}
      <StaffOnboardModal
        open={onboardModalOpen}
        onClose={() => {
          setOnboardModalOpen(false)
          setInitialRejoinStaffId(null)
        }}
        onSuccess={(creds, msg) => {
          fetchData()
          toast.success(msg)
          if (creds) {
            setIssuedCredentials([creds])
          }
        }}
        exitedStaffList={exitedStaffList}
        depts={depts}
        desigs={desigs}
        shifts={shifts}
        initialRejoinStaffId={initialRejoinStaffId}
      />

      {/* Bulk CSV Modal */}
      <StaffBulkImportModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        onSuccess={(creds) => {
          fetchData()
          if (creds && creds.length > 0) {
            setIssuedCredentials(creds)
          }
        }}
      />

      {/* Profile & Access Modal */}
      <StaffProfileModal
        staff={profileModalStaff}
        open={profileModalStaff !== null}
        onClose={() => setProfileModalStaff(null)}
        onSaved={(creds) => {
          fetchData()
          if (creds) {
            setIssuedCredentials([creds])
          }
        }}
        onDeleted={() => {
          fetchData()
        }}
        depts={depts}
        desigs={desigs}
        shifts={shifts}
      />

      {/* Issued One-Time Temporary Credentials Modal */}
      <Modal
        open={issuedCredentials !== null}
        onClose={() => setIssuedCredentials(null)}
        title="One-Time Login Credentials Issued"
        footer={
          <>
            {issuedCredentials && issuedCredentials.length > 0 && (
              <Button variant="secondary" icon={Download} onClick={() => downloadCredentialsCsv(issuedCredentials)}>
                Download CSV
              </Button>
            )}
            <Button onClick={() => setIssuedCredentials(null)}>Done</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-acc-2/30 bg-acc-2/10 p-3 text-[13px] text-text">
            Share the <b>Employee ID</b> and <b>One-Time Temporary Password</b> below with the employee. They will be
            prompted to set their personal password upon first sign-in at <span className="num">/login</span>.
          </div>

          {issuedCredentials && (
            <div className="max-h-[50vh] space-y-2.5 overflow-y-auto">
              {issuedCredentials.map((cred, idx) => (
                <div
                  key={`${cred.employeeCode}-${idx}`}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-line bg-canvas p-3.5 sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="font-medium text-text">{cred.name}</div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span>
                        Employee ID:{' '}
                        <b className="num rounded bg-card-hi px-1.5 py-0.5 text-acc-1">{cred.employeeCode}</b>
                      </span>
                      <span>
                        Temp Password:{' '}
                        <b className="num rounded border border-line bg-card-hi px-2 py-0.5 text-[13px] tracking-wider text-present">
                          {cred.temporaryPassword}
                        </b>
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={copiedIndex === idx ? Check : Copy}
                    onClick={() => copyCredentialRow(cred, idx)}
                  >
                    {copiedIndex === idx ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
