'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Modal,
  Button,
  Field,
  Input,
  Select,
  Avatar,
  Tabs,
} from '@/components/ui'
import {
  KeyRound,
  Shield,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  LogOut as ExitIcon,
  Trash2,
  Building2,
  Calendar,
  Clock,
  IdCard,
  Camera,
  History,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { istDateKey } from '@/lib/dashboard-calc'
import { formatDate } from '@/lib/format'
import { previewHeadline, transitionRows } from '@/lib/shift-preview-text'
import type { PreviewSummary } from '@/lib/shift-change'
import { staffPhotoUrl } from '@/lib/photo-url'
import { toast } from 'sonner'
import { type IssuedCredential } from './StaffOnboardModal'

const ALWAYS_DAY = '2000-01-01'

type PreviewState = { key: string; status: 'ok' | 'error'; summary?: PreviewSummary; error?: string }
type HistoryRow = { id: string; effectiveFrom: string; shiftId: string | null; shiftName: string | null; source: string }
type PunchPhoto = { id: string; takenAt: string }
type PendingRecalc = { shiftId: string; startDate: string; message: string }

type StaffMember = {
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
    isHigherPensionOpted?: boolean | null
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
  employmentPeriods?: {
    id: string
    startDate: string
    endDate: string | null
    exitReason: string | null
    notes: string | null
  }[]
  attendanceLogsCount?: number
  dailyRecordsCount?: number
  monthlyPayrollsCount?: number
}

type StaffProfileModalProps = {
  staff: StaffMember | null
  open: boolean
  onClose: () => void
  onSaved: (issuedCred?: IssuedCredential | null) => void
  onDeleted: () => void
  depts: { id: string; name: string }[]
  desigs: { id: string; name: string }[]
  shifts: { id: string; name: string }[]
}

export function StaffProfileModal({
  staff,
  open,
  onClose,
  onSaved,
  onDeleted,
  depts,
  desigs,
  shifts,
}: StaffProfileModalProps) {
  const todayKey = istDateKey(new Date())
  const [activeTab, setActiveTab] = useState<'overview' | 'kyc' | 'employment' | 'statutory'>('overview')

  // Form Edit State
  const [formData, setFormData] = useState({
    name: '',
    machineId: '',
    joiningDate: '',
    role: 'EMPLOYEE' as 'EMPLOYEE' | 'APPROVER' | 'ADMIN',
    email: '',
    approvesAllDepartments: true,
    approverDepartmentIds: [] as string[],
    departmentId: '',
    designationId: '',
    shiftId: '',
    // KYC
    mobileNumber: '',
    dob: '',
    gender: '',
    fatherHusbandName: '',
    relationship: 'Father',
    qualification: '',
    nationality: 'INDIAN',
    // Statutory
    payGroup: 'BANK_EPF' as 'BANK_EPF' | 'CASH',
    isHigherPensionOpted: false,
    bankAccount: '',
    ifsc: '',
    nameAsPerBank: '',
    pan: '',
    aadhaar: '',
    uan: '',
  })

  // Shift Change Preview State
  const [originalShiftId, setOriginalShiftId] = useState('')
  const [shiftStartDate, setShiftStartDate] = useState(todayKey)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [shiftHistory, setShiftHistory] = useState<HistoryRow[] | null>(null)
  const [pendingRecalc, setPendingRecalc] = useState<PendingRecalc | null>(null)

  // Status & Lifecycle Actions
  const [exitModalOpen, setExitModalOpen] = useState(false)
  const [exitForm, setExitForm] = useState({
    lastWorkingDay: todayKey,
    exitReason: 'RESIGNATION',
    notes: '',
  })
  const [lifecycleBusy, setLifecycleBusy] = useState(false)

  // Delete Guard State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Saving state
  const [saving, setSaving] = useState(false)
  const [resettingPassword, setResettingPassword] = useState(false)

  // Photo state
  const [photoBusy, setPhotoBusy] = useState(false)

  // Initialize form when staff changes
  useEffect(() => {
    if (staff) {
      const assignedDeptIds = (staff.user?.approverDepartments ?? []).map((d) => d.departmentId)
      const currentShiftId = staff.shiftId ?? ''
      setOriginalShiftId(currentShiftId)
      setShiftStartDate(todayKey)
      setPreview(null)
      setPendingRecalc(null)
      setExitModalOpen(false)
      setDeleteConfirmOpen(false)

      setFormData({
        name: staff.name,
        machineId: staff.machineId,
        joiningDate: staff.joiningDate?.slice(0, 10) ?? '',
        role: staff.user?.role ?? 'EMPLOYEE',
        email: staff.user?.email || staff.payrollInfo?.email || '',
        approvesAllDepartments:
          staff.user?.approvesAllDepartments !== undefined
            ? staff.user.approvesAllDepartments
            : assignedDeptIds.length === 0,
        approverDepartmentIds: assignedDeptIds,
        departmentId: staff.department?.id || (staff.department?.name ? depts.find((d) => d.name === staff.department?.name)?.id || '' : ''),
        designationId: staff.designation?.id || (staff.designation?.name ? desigs.find((d) => d.name === staff.designation?.name)?.id || '' : ''),
        shiftId: currentShiftId,
        mobileNumber: staff.payrollInfo?.mobileNumber || '',
        dob: staff.payrollInfo?.dob ? String(staff.payrollInfo.dob).slice(0, 10) : '',
        gender: staff.payrollInfo?.gender || '',
        fatherHusbandName: staff.payrollInfo?.fatherHusbandName || '',
        relationship: staff.payrollInfo?.relationship || 'Father',
        qualification: staff.payrollInfo?.qualification || '',
        nationality: staff.payrollInfo?.nationality || 'INDIAN',
        payGroup: staff.payrollInfo?.payGroup ?? 'BANK_EPF',
        isHigherPensionOpted: staff.payrollInfo?.isHigherPensionOpted ?? false,
        bankAccount: staff.payrollInfo?.bankAccount || '',
        ifsc: staff.payrollInfo?.ifsc || '',
        nameAsPerBank: staff.payrollInfo?.nameAsPerBank || '',
        pan: staff.payrollInfo?.pan || '',
        aadhaar: staff.payrollInfo?.aadhaar || '',
        uan: staff.payrollInfo?.uan || '',
      })
    }
  }, [staff, depts, desigs, todayKey])

  // Fetch shift history
  useEffect(() => {
    if (staff && open) {
      let cancelled = false
      fetch(`/api/staff/${staff.id}/shift-history`)
        .then((r) => (r.ok ? r.json() : null))
        .then((rows) => {
          if (!cancelled && Array.isArray(rows)) setShiftHistory(rows)
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }
  }, [staff, open])

  // Shift Change Preview Debounce
  const shiftChanged = staff !== null && formData.shiftId !== originalShiftId
  const previewKey = `${formData.shiftId}|${shiftStartDate}`
  const currentPreview = preview && preview.key === previewKey ? preview : null
  const previewLoading = shiftChanged && !currentPreview

  useEffect(() => {
    if (!staff || !shiftChanged || !shiftStartDate || shiftStartDate < ALWAYS_DAY) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/staff/${staff.id}/shift`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shiftId: formData.shiftId || null, effectiveFrom: shiftStartDate, dryRun: true }),
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok && data && typeof data.recalculatedDays === 'number') setPreview({ key: previewKey, status: 'ok', summary: data })
        else setPreview({ key: previewKey, status: 'error', error: data?.error || 'Could not load shift preview' })
      } catch {
        if (!cancelled) setPreview({ key: previewKey, status: 'error', error: 'Could not load preview' })
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [staff, shiftChanged, formData.shiftId, shiftStartDate, previewKey])

  if (!staff) return null

  const periods = staff.employmentPeriods ?? []
  const hasOpenPeriod = periods.some((p) => !p.endDate)
  const isExited = periods.length > 0 ? !hasOpenPeriod : !!staff.user?.disabledAt
  const status = isExited ? 'EXITED' : 'ACTIVE'

  const applyShiftChange = async (): Promise<boolean> => {
    const res = await fetch(`/api/staff/${staff.id}/shift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId: formData.shiftId || null, effectiveFrom: shiftStartDate }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      toast.error(data?.error || 'Failed to apply shift change')
      return false
    }
    if (data.recalculated === false) {
      setPendingRecalc({
        shiftId: formData.shiftId,
        startDate: shiftStartDate,
        message: data.error
          ? `Shift updated, but past attendance days could not be recalculated: ${data.error}`
          : 'Shift updated, but past days were not recalculated.',
      })
      return false
    }
    return true
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      if (shiftChanged && !(await applyShiftChange())) return

      const payload = {
        id: staff.id,
        name: formData.name.trim(),
        machineId: formData.machineId.trim(),
        joiningDate: formData.joiningDate || undefined,
        role: formData.role,
        email: formData.email.trim() || null,
        approvesAllDepartments: formData.role === 'APPROVER' ? formData.approvesAllDepartments : undefined,
        approverDepartmentIds:
          formData.role === 'APPROVER' && !formData.approvesAllDepartments ? formData.approverDepartmentIds : undefined,
        departmentId: formData.departmentId || null,
        designationId: formData.designationId || null,
        payGroup: formData.payGroup,
        isHigherPensionOpted: formData.isHigherPensionOpted,
        mobileNumber: formData.mobileNumber.trim() || null,
        dob: formData.dob || null,
        gender: formData.gender || null,
        fatherHusbandName: formData.fatherHusbandName.trim() || null,
        relationship: formData.relationship || null,
        qualification: formData.qualification.trim() || null,
        nationality: formData.nationality || null,
        bankAccount: formData.bankAccount.trim() || null,
        ifsc: formData.ifsc.trim() || null,
        nameAsPerBank: formData.nameAsPerBank.trim() || null,
        pan: formData.pan.trim() || null,
        aadhaar: formData.aadhaar.trim() || null,
        uan: formData.uan.trim() || null,
      }

      const res = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(`${formData.name} profile updated successfully`)
        const issued: IssuedCredential | null =
          data?.temporaryPassword && data?.employeeCode
            ? {
                name: formData.name,
                machineId: formData.machineId,
                employeeCode: data.employeeCode,
                temporaryPassword: data.temporaryPassword,
              }
            : null
        onSaved(issued)
        onClose()
      } else {
        toast.error(data?.error || 'Failed to update profile')
      }
    } catch {
      toast.error('Network error during update')
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    setResettingPassword(true)
    try {
      const res = await fetch(`/api/staff/${staff.id}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_PASSWORD', joiningDate: todayKey }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.temporaryPassword) {
        toast.success(`Temporary password issued for ${staff.name}`)
        onSaved({
          name: staff.name,
          machineId: staff.machineId,
          employeeCode: data.employeeCode || staff.employeeCode || '',
          temporaryPassword: data.temporaryPassword,
        })
      } else {
        toast.error(data?.error || 'Failed to issue temporary password')
      }
    } catch {
      toast.error('Failed to issue password')
    } finally {
      setResettingPassword(false)
    }
  }

  const handleExitStaff = async () => {
    setLifecycleBusy(true)
    try {
      const res = await fetch(`/api/staff/${staff.id}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'EXIT',
          lastWorkingDay: exitForm.lastWorkingDay,
          exitReason: exitForm.exitReason,
          notes: exitForm.notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success(`${staff.name} recorded as exited and login disabled`)
        setExitModalOpen(false)
        onSaved()
        onClose()
      } else {
        toast.error(data?.error || 'Failed to record exit')
      }
    } catch {
      toast.error('Network error recording exit')
    } finally {
      setLifecycleBusy(false)
    }
  }

  const handleRemovePhoto = async () => {
    setPhotoBusy(true)
    try {
      const res = await fetch(`/api/staff/${staff.id}/photo`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Profile picture removed')
        onSaved()
      } else {
        toast.error('Failed to remove picture')
      }
    } catch {
      toast.error('Failed to remove picture')
    } finally {
      setPhotoBusy(false)
    }
  }

  const handleDeleteRecord = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/staff?id=${staff.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (res.ok) {
        toast.success('Erroneous staff record deleted')
        setDeleteConfirmOpen(false)
        onDeleted()
        onClose()
      } else {
        toast.error(data?.error || 'Cannot delete staff member')
      }
    } catch {
      toast.error('Failed to delete staff member')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Teacher &amp; Staff Profile"
        subtitle={staff ? `${staff.name} · ${staff.employeeCode ? `ID ${staff.employeeCode}` : `Machine #${staff.machineId}`}` : undefined}
        size="2xl"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} loading={saving} disabled={saving}>
              Save Profile Changes
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header Card: Identity, Badges & Action shortcuts */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card-hi p-4">
            <div className="flex items-center gap-3.5">
              <Avatar name={staff.name} src={staffPhotoUrl(staff)} size={38} />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-text">{staff.name}</h3>
                  {staff.employeeCode ? (
                    <span className="num rounded-md border border-line bg-card px-2 py-0.5 text-xs font-semibold text-acc-1">
                      {staff.employeeCode}
                    </span>
                  ) : (
                    <span className="tint-badge tone-late rounded-md px-2 py-0.5 text-xs font-medium">
                      No SAR ID yet
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                      status === 'ACTIVE' ? 'tint-badge tone-present' : 'tint-badge tone-absent'
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                  <span>Machine #{staff.machineId}</span>
                  <span>·</span>
                  <span>{staff.department?.name || 'No Dept'}</span>
                  <span>·</span>
                  <span>{staff.designation?.name || 'Unassigned Role'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {staff.hasPhoto && (
                <Button variant="secondary" size="sm" onClick={handleRemovePhoto} disabled={photoBusy}>
                  Remove Photo
                </Button>
              )}
              {status === 'ACTIVE' && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={KeyRound}
                  onClick={handleResetPassword}
                  loading={resettingPassword}
                >
                  Reset Password
                </Button>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <Tabs
            tabs={[
              { id: 'overview', label: 'Overview & Access' },
              { id: 'kyc', label: 'Personal & KYC' },
              { id: 'employment', label: 'Employment & Shift' },
              { id: 'statutory', label: 'Banking & Statutory' },
            ]}
            value={activeTab}
            onChange={(t) => setActiveTab(t as any)}
          />

          {/* TAB 1: OVERVIEW & ACCESS */}
          {activeTab === 'overview' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full Name" htmlFor="profile-name">
                  <Input
                    id="profile-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Biometric Machine ID" htmlFor="profile-machine">
                  <Input
                    id="profile-machine"
                    type="text"
                    value={formData.machineId}
                    onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                    required
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Joining Date"
                  htmlFor="profile-joining"
                  helper={
                    !staff.employeeCode
                      ? 'Setting a joining date will auto-generate their permanent SAR ID.'
                      : undefined
                  }
                >
                  <Input
                    id="profile-joining"
                    type="date"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  />
                </Field>

                <Field label="Portal Access Role" htmlFor="profile-role">
                  <Select
                    id="profile-role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as 'EMPLOYEE' | 'APPROVER' | 'ADMIN',
                      })
                    }
                  >
                    <option value="EMPLOYEE">Employee (My Portal)</option>
                    <option value="APPROVER">Approver</option>
                    <option value="ADMIN">Administrator (Full Access)</option>
                  </Select>
                </Field>
              </div>

              <Field label="Login / Contact Email" htmlFor="profile-email">
                <Input
                  id="profile-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@sarvodaya.edu"
                />
              </Field>

              {formData.role === 'APPROVER' && (
                <div className="rounded-xl border border-line-soft bg-canvas p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium text-text">Approver Department Scope</p>
                      <p className="text-xs text-subtle">
                        Specify departments this approver has authority to oversee.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-text">
                      <input
                        type="checkbox"
                        className="size-4 accent-acc-2"
                        checked={formData.approvesAllDepartments}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            approvesAllDepartments: e.target.checked,
                            approverDepartmentIds: e.target.checked ? [] : formData.approverDepartmentIds,
                          })
                        }
                      />
                      All departments
                    </label>
                  </div>
                  {!formData.approvesAllDepartments && depts.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2 border-t border-line-soft pt-2.5">
                      {depts.map((d) => {
                        const checked = formData.approverDepartmentIds.includes(d.id)
                        return (
                          <label
                            key={d.id}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1 text-xs text-text"
                          >
                            <input
                              type="checkbox"
                              className="size-3.5 accent-acc-2"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...formData.approverDepartmentIds, d.id]
                                  : formData.approverDepartmentIds.filter((id) => id !== d.id)
                                setFormData({ ...formData, approverDepartmentIds: next })
                              }}
                            />
                            {d.name}
                          </label>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Status Management Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-canvas p-3">
                <div>
                  <p className="text-[13px] font-medium text-text">Employment Status: {status}</p>
                  <p className="text-xs text-subtle">
                    {status === 'ACTIVE'
                      ? 'Mark as exited when staff member resigns or completes their contract.'
                      : 'Reactivate former member to start a new employment tenure.'}
                  </p>
                </div>
                {status === 'ACTIVE' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ExitIcon}
                    onClick={() => setExitModalOpen(true)}
                  >
                    Record Exit
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={RotateCcw}
                    onClick={() => {
                      onClose()
                      window.location.href = `/staff?rejoin=${staff.id}`
                    }}
                  >
                    Reactivate Staff Member
                  </Button>
                )}
              </div>

              {/* Danger Zone: Confined Deletion for Mistake Entries */}
              <div className="rounded-xl border border-absent/30 bg-absent/5 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-[13px] font-semibold text-absent">Danger Zone — Erroneous Entry Removal</h4>
                    <p className="text-xs text-subtle">
                      Only available for accidental/wrong entries with zero attendance logs or payroll history.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    onClick={() => setDeleteConfirmOpen(true)}
                  >
                    Delete Mistake Entry
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PERSONAL & KYC */}
          {activeTab === 'kyc' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Mobile Number" htmlFor="kyc-mobile">
                  <Input
                    id="kyc-mobile"
                    type="tel"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    placeholder="10-digit mobile number"
                  />
                </Field>
                <Field label="Date of Birth (DOB)" htmlFor="kyc-dob">
                  <Input
                    id="kyc-dob"
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Gender" htmlFor="kyc-gender">
                  <Select
                    id="kyc-gender"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Select Gender...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
                <Field label="Nationality" htmlFor="kyc-nationality">
                  <Input
                    id="kyc-nationality"
                    type="text"
                    value={formData.nationality}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Father / Husband Name" htmlFor="kyc-guardian">
                  <Input
                    id="kyc-guardian"
                    type="text"
                    value={formData.fatherHusbandName}
                    onChange={(e) => setFormData({ ...formData, fatherHusbandName: e.target.value })}
                    placeholder="Full guardian name"
                  />
                </Field>
                <Field label="Relationship" htmlFor="kyc-relation">
                  <Select
                    id="kyc-relation"
                    value={formData.relationship}
                    onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  >
                    <option value="Father">Father</option>
                    <option value="Husband">Husband</option>
                    <option value="Mother">Mother</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
              </div>

              <Field label="Highest Educational Qualification" htmlFor="kyc-qualification">
                <Input
                  id="kyc-qualification"
                  type="text"
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                  placeholder="e.g. M.Sc, B.Ed, D.El.Ed"
                />
              </Field>
            </div>
          )}

          {/* TAB 3: EMPLOYMENT & SHIFT */}
          {activeTab === 'employment' && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Department" htmlFor="emp-dept">
                  <Select
                    id="emp-dept"
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  >
                    <option value="">No Department</option>
                    {depts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Designation" htmlFor="emp-desig">
                  <Select
                    id="emp-desig"
                    value={formData.designationId}
                    onChange={(e) => setFormData({ ...formData, designationId: e.target.value })}
                  >
                    <option value="">No Role</option>
                    {desigs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Assigned Shift" htmlFor="emp-shift">
                <Select
                  id="emp-shift"
                  value={formData.shiftId}
                  onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                >
                  <option value="">No Shift</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>

              {shiftChanged && (
                <div className="space-y-3 rounded-xl border border-line bg-card-hi p-3.5">
                  <Field
                    label="Effective From Date"
                    htmlFor="shift-start"
                    helper="Past days on or after this date will be recalculated with the new shift parameters."
                  >
                    <Input
                      id="shift-start"
                      type="date"
                      min={ALWAYS_DAY}
                      value={shiftStartDate}
                      onChange={(e) => setShiftStartDate(e.target.value)}
                    />
                  </Field>

                  {previewLoading ? (
                    <p className="text-xs text-muted">Calculating transition impact...</p>
                  ) : currentPreview?.status === 'error' ? (
                    <p className="text-xs text-absent">{currentPreview.error}</p>
                  ) : currentPreview?.summary ? (
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-text">{previewHeadline(currentPreview.summary)}</p>
                      {transitionRows(currentPreview.summary.transitions).length > 0 && (
                        <ul className="space-y-0.5 text-muted">
                          {transitionRows(currentPreview.summary.transitions).map((r) => (
                            <li key={r.label}>
                              {r.label}: <span className="num font-medium text-text">{r.count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Employment Periods Timeline */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <History size={15} className="text-muted" />
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Employment Tenure Timeline
                  </h4>
                </div>
                {periods.length > 0 ? (
                  <div className="space-y-2">
                    {periods.map((p, idx) => (
                      <div
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-canvas p-2.5 text-xs"
                      >
                        <div>
                          <span className="font-medium text-text">
                            Tenure #{periods.length - idx}: {formatDate(p.startDate)} → {p.endDate ? formatDate(p.endDate) : 'Present (Active)'}
                          </span>
                          {p.exitReason && (
                            <p className="text-subtle">
                              Reason: {p.exitReason} {p.notes ? `(${p.notes})` : ''}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded px-2 py-0.5 text-[10.5px] font-medium ${
                            !p.endDate ? 'tint-badge tone-present' : 'tint-badge tone-absent'
                          }`}
                        >
                          {!p.endDate ? 'Active Period' : 'Ended Period'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-line-soft bg-canvas p-3 text-xs text-subtle">
                    No discrete employment periods recorded yet.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: BANKING & STATUTORY */}
          {activeTab === 'statutory' && (
            <div className="space-y-4 pt-1">
              <Field label="Pay Group Mode" htmlFor="stat-paygroup">
                <Select
                  id="stat-paygroup"
                  value={formData.payGroup}
                  onChange={(e) => setFormData({ ...formData, payGroup: e.target.value as 'BANK_EPF' | 'CASH' })}
                >
                  <option value="BANK_EPF">Bank / EPF (Provident Fund Included)</option>
                  <option value="CASH">Cash Payroll (No PF deductions)</option>
                </Select>
              </Field>

              {formData.payGroup === 'BANK_EPF' && (
                <Field
                  label="Pension Scheme (EPS Mode)"
                  htmlFor="stat-higher-pension"
                  helper="Joint option under Para 11 of EPS 1995. Applies 1.16% surcharge on wages above ceiling from employer share."
                >
                  <Select
                    id="stat-higher-pension"
                    value={formData.isHigherPensionOpted ? 'YES' : 'NO'}
                    onChange={(e) => setFormData({ ...formData, isHigherPensionOpted: e.target.value === 'YES' })}
                  >
                    <option value="NO">Standard Member (Capped at statutory ceiling, 0% surcharge)</option>
                    <option value="YES">Opted for Pension on Higher Wages (Uncapped, 1.16% surcharge)</option>
                  </Select>
                </Field>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Bank Account Number" htmlFor="stat-account">
                  <Input
                    id="stat-account"
                    type="text"
                    value={formData.bankAccount}
                    onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                    placeholder="Account number"
                  />
                </Field>
                <Field label="IFSC Code" htmlFor="stat-ifsc">
                  <Input
                    id="stat-ifsc"
                    type="text"
                    value={formData.ifsc}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                    placeholder="e.g. SBIN0001234"
                  />
                </Field>
              </div>

              <Field label="Name As Per Bank Account" htmlFor="stat-bankname">
                <Input
                  id="stat-bankname"
                  type="text"
                  value={formData.nameAsPerBank}
                  onChange={(e) => setFormData({ ...formData, nameAsPerBank: e.target.value })}
                  placeholder="Full name as printed in passbook"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="PAN Number" htmlFor="stat-pan">
                  <Input
                    id="stat-pan"
                    type="text"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                  />
                </Field>
                <Field label="Aadhaar Number" htmlFor="stat-aadhaar">
                  <Input
                    id="stat-aadhaar"
                    type="text"
                    value={formData.aadhaar}
                    onChange={(e) => setFormData({ ...formData, aadhaar: e.target.value })}
                    placeholder="12-digit UID"
                  />
                </Field>
                <Field label="Universal Account Number (UAN)" htmlFor="stat-uan">
                  <Input
                    id="stat-uan"
                    type="text"
                    value={formData.uan}
                    onChange={(e) => setFormData({ ...formData, uan: e.target.value })}
                    placeholder="12-digit EPF UAN"
                  />
                </Field>
              </div>

              <div className="rounded-xl border border-line-soft bg-canvas p-3 text-xs text-subtle">
                <p className="font-medium text-text">Salary &amp; CTC Configuration Notice</p>
                <p className="mt-0.5">
                  Monthly CTC, allowance slabs, and PF employer contributions are configured separately in{' '}
                  <b className="text-text">Salary Setup</b> (`/payroll/staff`) to ensure unified ledger compliance.
                </p>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Record Exit Sub-Modal */}
      <Modal
        open={exitModalOpen}
        onClose={() => setExitModalOpen(false)}
        title={`Record Staff Exit: ${staff.name}`}
        footer={
          <div className="flex w-full justify-between gap-2">
            <Button variant="secondary" onClick={() => setExitModalOpen(false)} disabled={lifecycleBusy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleExitStaff} loading={lifecycleBusy}>
              Confirm Exit &amp; Disable Login
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-subtle">
            Recording an exit closes the active employment period and disables system portal access while preserving all
            attendance and payroll records.
          </p>

          <Field label="Last Working Day" htmlFor="exit-date">
            <Input
              id="exit-date"
              type="date"
              value={exitForm.lastWorkingDay}
              onChange={(e) => setExitForm({ ...exitForm, lastWorkingDay: e.target.value })}
              required
            />
          </Field>

          <Field label="Exit Reason" htmlFor="exit-reason">
            <Select
              id="exit-reason"
              value={exitForm.exitReason}
              onChange={(e) => setExitForm({ ...exitForm, exitReason: e.target.value })}
            >
              <option value="RESIGNATION">Resignation</option>
              <option value="END_OF_CONTRACT">End of Contract</option>
              <option value="RETIREMENT">Retirement</option>
              <option value="TERMINATION">Termination</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>

          <Field label="Notes / Remarks" htmlFor="exit-notes">
            <Input
              id="exit-notes"
              type="text"
              value={exitForm.notes}
              onChange={(e) => setExitForm({ ...exitForm, notes: e.target.value })}
              placeholder="e.g. Relocated to hometown"
            />
          </Field>
        </div>
      </Modal>

      {/* Delete Confirmation Modal (Guarded) */}
      <Modal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Confirm Deletion of Erroneous Record"
        footer={
          <div className="flex w-full justify-between gap-2">
            <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteRecord} loading={deleting}>
              Permanently Delete Record
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-absent/30 bg-absent/10 p-3 text-xs text-absent">
            <AlertTriangle size={18} className="shrink-0" />
            <p>
              Are you sure you want to permanently delete <b>{staff.name}</b> (Machine #{staff.machineId})?
            </p>
          </div>
          <p className="text-xs text-subtle">
            This action cannot be undone. It is strictly for correcting mistaken entries that have no associated attendance
            punches or payroll runs. If this member worked even one day, use <b>Record Exit</b> instead.
          </p>
        </div>
      </Modal>
    </>
  )
}
