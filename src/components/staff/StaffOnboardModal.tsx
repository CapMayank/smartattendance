'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Modal,
  Button,
  Field,
  Input,
  Select,
  Avatar,
} from '@/components/ui'
import {
  UserPlus,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Search,
  Building2,
  Clock,
  IdCard,
} from 'lucide-react'
import { istDateKey } from '@/lib/dashboard-calc'
import { toast } from 'sonner'
import { staffPhotoUrl } from '@/lib/photo-url'

export type ExitedStaffItem = {
  id: string
  name: string
  machineId: string
  employeeCode?: string | null
  joiningDate?: string | null
  department?: { id?: string; name: string } | null
  designation?: { id?: string; name: string } | null
  shift?: { id?: string; name: string } | null
  payrollInfo?: { payGroup?: 'BANK_EPF' | 'CASH' } | null
  employmentPeriods?: {
    id: string
    startDate: string
    endDate: string | null
    exitReason: string | null
    notes: string | null
  }[]
}

export type IssuedCredential = {
  name: string
  machineId?: string
  employeeCode: string
  temporaryPassword: string
}

type StaffOnboardModalProps = {
  open: boolean
  onClose: () => void
  onSuccess: (cred: IssuedCredential | null, message: string) => void
  exitedStaffList: ExitedStaffItem[]
  depts: { id: string; name: string }[]
  desigs: { id: string; name: string }[]
  shifts: { id: string; name: string }[]
  initialRejoinStaffId?: string | null
}

export function StaffOnboardModal({
  open,
  onClose,
  onSuccess,
  exitedStaffList,
  depts,
  desigs,
  shifts,
  initialRejoinStaffId,
}: StaffOnboardModalProps) {
  const todayKey = istDateKey(new Date())

  // Mode: 'NEW' or 'REJOIN'
  const [mode, setMode] = useState<'NEW' | 'REJOIN'>('NEW')
  const [submitting, setSubmitting] = useState(false)

  // Rejoin State
  const [rejoinSearch, setRejoinSearch] = useState('')
  const [selectedExitedStaffId, setSelectedExitedStaffId] = useState<string>('')
  const [rejoinMachineId, setRejoinMachineId] = useState('')
  const [rejoinDate, setRejoinDate] = useState(todayKey)
  const [rejoinDeptId, setRejoinDeptId] = useState('')
  const [rejoinDesigId, setRejoinDesigId] = useState('')
  const [rejoinShiftId, setRejoinShiftId] = useState('')
  const [rejoinPayGroup, setRejoinPayGroup] = useState<'BANK_EPF' | 'CASH'>('BANK_EPF')

  // New Hire State
  const [newForm, setNewForm] = useState({
    name: '',
    machineId: '',
    joiningDate: todayKey,
    payGroup: 'BANK_EPF' as 'BANK_EPF' | 'CASH',
    role: 'EMPLOYEE' as 'EMPLOYEE' | 'APPROVER' | 'ADMIN',
    email: '',
    mobileNumber: '',
    dob: '',
    gender: '',
    fatherHusbandName: '',
    qualification: '',
    departmentId: '',
    designationId: '',
    shiftId: '',
    approvesAllDepartments: true,
    approverDepartmentIds: [] as string[],
  })

  // Pre-select initial rejoin staff if supplied
  useEffect(() => {
    if (initialRejoinStaffId) {
      setMode('REJOIN')
      setSelectedExitedStaffId(initialRejoinStaffId)
    }
  }, [initialRejoinStaffId])

  const selectedExitedStaff = useMemo(() => {
    return exitedStaffList.find((s) => s.id === selectedExitedStaffId) ?? null
  }, [exitedStaffList, selectedExitedStaffId])

  // When exited staff is selected, pre-fill rejoin fields
  useEffect(() => {
    if (selectedExitedStaff) {
      setRejoinMachineId(selectedExitedStaff.machineId)
      setRejoinDeptId(selectedExitedStaff.department?.id || '')
      setRejoinDesigId(selectedExitedStaff.designation?.id || '')
      setRejoinShiftId(selectedExitedStaff.shift?.id || '')
      setRejoinPayGroup(selectedExitedStaff.payrollInfo?.payGroup ?? 'BANK_EPF')
    }
  }, [selectedExitedStaff])

  const filteredExitedList = useMemo(() => {
    const q = rejoinSearch.trim().toLowerCase()
    if (!q) return exitedStaffList
    return exitedStaffList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.employeeCode ?? '').toLowerCase().includes(q) ||
        s.machineId.toLowerCase().includes(q)
    )
  }, [exitedStaffList, rejoinSearch])

  const lastPeriod = selectedExitedStaff?.employmentPeriods?.[0]

  const handleRejoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedExitedStaff) {
      toast.error('Please select an exited staff member to reactivate')
      return
    }

    if (!rejoinDate) {
      toast.error('Please provide a valid rejoining date')
      return
    }

    if (lastPeriod?.endDate && rejoinDate <= lastPeriod.endDate) {
      toast.error(`Rejoining date must be strictly after their exit date (${lastPeriod.endDate})`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/staff/${selectedExitedStaff.id}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJOIN',
          joiningDate: rejoinDate,
          machineId: rejoinMachineId.trim() || undefined,
          departmentId: rejoinDeptId || null,
          designationId: rejoinDesigId || null,
          shiftId: rejoinShiftId || null,
          payGroup: rejoinPayGroup,
        }),
      })

      const data = await res.json().catch(() => null)
      if (res.ok && data) {
        const creds: IssuedCredential | null = data.temporaryPassword
          ? {
              name: selectedExitedStaff.name,
              machineId: rejoinMachineId.trim() || selectedExitedStaff.machineId,
              employeeCode: selectedExitedStaff.employeeCode || '',
              temporaryPassword: data.temporaryPassword,
            }
          : null
        onSuccess(creds, `${selectedExitedStaff.name} reactivated and new tenure created`)
        onClose()
      } else {
        toast.error(data?.error || 'Failed to reactivate staff member')
      }
    } catch {
      toast.error('Network error during reactivation')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newForm.name || !newForm.machineId || !newForm.joiningDate) {
      toast.error('Full name, Biometric Machine ID, and Joining Date are required')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        name: newForm.name.trim(),
        machineId: newForm.machineId.trim(),
        joiningDate: newForm.joiningDate,
        payGroup: newForm.payGroup,
        role: newForm.role,
        email: newForm.email.trim() || null,
        mobileNumber: newForm.mobileNumber.trim() || null,
        dob: newForm.dob || null,
        gender: newForm.gender || null,
        fatherHusbandName: newForm.fatherHusbandName.trim() || null,
        qualification: newForm.qualification.trim() || null,
        departmentId: newForm.departmentId || null,
        designationId: newForm.designationId || null,
        shiftId: newForm.shiftId || null,
        approvesAllDepartments: newForm.role === 'APPROVER' ? newForm.approvesAllDepartments : undefined,
        approverDepartmentIds:
          newForm.role === 'APPROVER' && !newForm.approvesAllDepartments ? newForm.approverDepartmentIds : undefined,
      }

      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)
      if (res.ok && data) {
        const creds: IssuedCredential | null =
          data.temporaryPassword && data.employeeCode
            ? {
                name: newForm.name.trim(),
                machineId: newForm.machineId.trim(),
                employeeCode: data.employeeCode,
                temporaryPassword: data.temporaryPassword,
              }
            : null
        onSuccess(creds, 'Staff member added & temporary credentials issued')
        onClose()
      } else {
        toast.error(data?.error || 'Failed to onboard staff member')
      }
    } catch {
      toast.error('Network error during staff creation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Onboard Staff Member"
      subtitle="Register new personnel or reactivate a returning teacher"
      size="xl"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {mode === 'REJOIN' ? (
            <Button
              onClick={handleRejoinSubmit}
              disabled={!selectedExitedStaff || submitting}
              loading={submitting}
              icon={RotateCcw}
            >
              Reactivate &amp; Issue Credentials
            </Button>
          ) : (
            <Button onClick={handleNewSubmit} disabled={submitting} loading={submitting} icon={UserPlus}>
              Onboard Staff Member
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Top Segmented Choice: New vs Returning */}
        <div className="rounded-2xl border border-line bg-card-hi p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Has this person previously worked here?
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('NEW')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all ${
                mode === 'NEW'
                  ? 'border-acc-2 bg-card text-text shadow-sm'
                  : 'border-transparent text-muted hover:border-line hover:text-text'
              }`}
            >
              <UserPlus size={16} aria-hidden="true" className={mode === 'NEW' ? 'text-acc-1' : 'text-subtle'} />
              <span>No, New Staff Member</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('REJOIN')}
              className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all ${
                mode === 'REJOIN'
                  ? 'border-acc-2 bg-card text-text shadow-sm'
                  : 'border-transparent text-muted hover:border-line hover:text-text'
              }`}
            >
              <RotateCcw size={16} aria-hidden="true" className={mode === 'REJOIN' ? 'text-acc-1' : 'text-subtle'} />
              <span>Yes, Returning Staff (Rejoin)</span>
            </button>
          </div>
        </div>

        {/* FLOW A: RETURNING STAFF */}
        {mode === 'REJOIN' && (
          <form onSubmit={handleRejoinSubmit} className="space-y-4">
            <div className="rounded-xl border border-line-soft bg-canvas p-3 text-xs text-muted">
              <p className="font-medium text-text">Reactivating a former member</p>
              <p className="mt-0.5 text-subtle">
                Preserves all their previous attendance history and employment tenure periods under their original{' '}
                <span className="num text-text">SAR-YYYY-NNN</span> ID while assigning a new employment period and active login.
              </p>
            </div>

            {/* Select former member */}
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-text">Select Former Staff Member</label>
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                <Input
                  type="search"
                  placeholder="Filter exited staff by name, SAR ID, or machine..."
                  value={rejoinSearch}
                  onChange={(e) => setRejoinSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {filteredExitedList.length > 0 ? (
                <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-line bg-card p-1.5">
                  {filteredExitedList.map((s) => {
                    const isSelected = s.id === selectedExitedStaffId
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedExitedStaffId(s.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                          isSelected ? 'bg-card-hi border border-acc-2/40 text-text' : 'hover:bg-card-hi text-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar name={s.name} src={staffPhotoUrl(s)} />
                          <div>
                            <span className="block font-medium text-text text-[13px]">{s.name}</span>
                            <span className="text-xs text-subtle">
                              Machine #{s.machineId} · {s.department?.name || 'No Dept'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="num rounded border border-line bg-canvas px-1.5 py-0.5 text-[11px] font-medium text-acc-1">
                            {s.employeeCode || 'No SAR ID'}
                          </span>
                          {s.employmentPeriods?.[0]?.endDate && (
                            <span className="block text-[11px] text-subtle">
                              Exited {s.employmentPeriods[0].endDate}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-xl border border-line-soft bg-canvas p-3 text-center text-xs text-subtle">
                  No exited members match your search.
                </p>
              )}
            </div>

            {/* Selected Member Preview & Re-employment Parameters */}
            {selectedExitedStaff && (
              <div className="space-y-4 rounded-xl border border-line bg-card p-4">
                <div className="flex items-center justify-between border-b border-line-soft pb-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Reactivating</span>
                    <h3 className="text-base font-semibold text-text">{selectedExitedStaff.name}</h3>
                  </div>
                  <span className="num rounded-md border border-line bg-card-hi px-2.5 py-1 text-xs font-semibold text-acc-1">
                    {selectedExitedStaff.employeeCode}
                  </span>
                </div>

                {lastPeriod && (
                  <div className="rounded-lg bg-canvas p-2.5 text-xs text-muted">
                    <span className="font-medium text-text">Previous Exit Details:</span> Exited on{' '}
                    <span className="num font-semibold text-text">{lastPeriod.endDate}</span> ({lastPeriod.exitReason})
                    {lastPeriod.notes && <span className="text-subtle"> — {lastPeriod.notes}</span>}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    label="Biometric Machine ID"
                    htmlFor="rejoin-machine"
                    helper="Pre-filled with their former slot. Change if reallocated."
                  >
                    <Input
                      id="rejoin-machine"
                      type="text"
                      value={rejoinMachineId}
                      onChange={(e) => setRejoinMachineId(e.target.value)}
                      required
                    />
                  </Field>
                  <Field
                    label="New Joining Date"
                    htmlFor="rejoin-date"
                    helper={`Must be strictly after ${lastPeriod?.endDate ?? 'last exit'}`}
                  >
                    <Input
                      id="rejoin-date"
                      type="date"
                      value={rejoinDate}
                      onChange={(e) => setRejoinDate(e.target.value)}
                      required
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Department" htmlFor="rejoin-dept">
                    <Select id="rejoin-dept" value={rejoinDeptId} onChange={(e) => setRejoinDeptId(e.target.value)}>
                      <option value="">No Dept...</option>
                      {depts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Designation" htmlFor="rejoin-desig">
                    <Select id="rejoin-desig" value={rejoinDesigId} onChange={(e) => setRejoinDesigId(e.target.value)}>
                      <option value="">No Role...</option>
                      {desigs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Assigned Shift" htmlFor="rejoin-shift">
                    <Select id="rejoin-shift" value={rejoinShiftId} onChange={(e) => setRejoinShiftId(e.target.value)}>
                      <option value="">No Shift...</option>
                      {shifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field label="Pay Group" htmlFor="rejoin-paygroup">
                  <Select
                    id="rejoin-paygroup"
                    value={rejoinPayGroup}
                    onChange={(e) => setRejoinPayGroup(e.target.value as 'BANK_EPF' | 'CASH')}
                  >
                    <option value="BANK_EPF">Bank / EPF</option>
                    <option value="CASH">Cash</option>
                  </Select>
                </Field>
              </div>
            )}
          </form>
        )}

        {/* FLOW B: NEW HIRE */}
        {mode === 'NEW' && (
          <form onSubmit={handleNewSubmit} className="space-y-4">
            <div className="rounded-xl border border-line-soft bg-canvas p-3 text-xs text-muted">
              <p className="font-medium text-text">New member onboarding</p>
              <p className="mt-0.5 text-subtle">
                Creates their permanent employee record, auto-generates a sequence-based Employee ID (e.g. SAR-2026-001),
                and creates a one-time temporary password for first sign-in.
              </p>
            </div>

            {/* Section 1: Basic Identity & Biometrics */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Identity &amp; Biometrics</span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Full name" htmlFor="new-name">
                  <Input
                    id="new-name"
                    type="text"
                    value={newForm.name}
                    onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                    placeholder="e.g. Rajesh Sharma"
                    required
                  />
                </Field>
                <Field label="Biometric Machine ID" htmlFor="new-machine">
                  <Input
                    id="new-machine"
                    type="text"
                    value={newForm.machineId}
                    onChange={(e) => setNewForm({ ...newForm, machineId: e.target.value })}
                    placeholder="e.g. 101"
                    required
                  />
                </Field>
                <Field label="Joining date" htmlFor="new-joining-date">
                  <Input
                    id="new-joining-date"
                    type="date"
                    value={newForm.joiningDate}
                    onChange={(e) => setNewForm({ ...newForm, joiningDate: e.target.value })}
                    required
                  />
                </Field>
              </div>
            </div>

            {/* Section 2: Department, Role & Shift */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle">Department &amp; Access</span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Department" htmlFor="new-dept">
                  <Select
                    id="new-dept"
                    value={newForm.departmentId}
                    onChange={(e) => setNewForm({ ...newForm, departmentId: e.target.value })}
                  >
                    <option value="">No Department...</option>
                    {depts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Designation" htmlFor="new-desig">
                  <Select
                    id="new-desig"
                    value={newForm.designationId}
                    onChange={(e) => setNewForm({ ...newForm, designationId: e.target.value })}
                  >
                    <option value="">No Role...</option>
                    {desigs.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Assigned Shift" htmlFor="new-shift">
                  <Select
                    id="new-shift"
                    value={newForm.shiftId}
                    onChange={(e) => setNewForm({ ...newForm, shiftId: e.target.value })}
                  >
                    <option value="">No Shift...</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Portal Access Role" htmlFor="new-role">
                  <Select
                    id="new-role"
                    value={newForm.role}
                    onChange={(e) =>
                      setNewForm({ ...newForm, role: e.target.value as 'EMPLOYEE' | 'APPROVER' | 'ADMIN' })
                    }
                  >
                    <option value="EMPLOYEE">Employee (My Portal)</option>
                    <option value="APPROVER">Approver</option>
                    <option value="ADMIN">Administrator (Full Access)</option>
                  </Select>
                </Field>
                <Field label="Pay Group" htmlFor="new-pay-group">
                  <Select
                    id="new-pay-group"
                    value={newForm.payGroup}
                    onChange={(e) => setNewForm({ ...newForm, payGroup: e.target.value as 'BANK_EPF' | 'CASH' })}
                  >
                    <option value="BANK_EPF">Bank / EPF</option>
                    <option value="CASH">Cash</option>
                  </Select>
                </Field>
              </div>

              {newForm.role === 'APPROVER' && (
                <div className="rounded-xl border border-line-soft bg-canvas p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-medium text-text">Approver Department Scope</p>
                      <p className="text-xs text-subtle">
                        Select whether this approver oversees all departments or designated ones.
                      </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-text">
                      <input
                        type="checkbox"
                        className="size-4 accent-acc-2"
                        checked={newForm.approvesAllDepartments}
                        onChange={(e) =>
                          setNewForm({
                            ...newForm,
                            approvesAllDepartments: e.target.checked,
                            approverDepartmentIds: e.target.checked ? [] : newForm.approverDepartmentIds,
                          })
                        }
                      />
                      All departments
                    </label>
                  </div>
                  {!newForm.approvesAllDepartments && depts.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-2 border-t border-line-soft pt-2.5">
                      {depts.map((d) => {
                        const checked = newForm.approverDepartmentIds.includes(d.id)
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
                                  ? [...newForm.approverDepartmentIds, d.id]
                                  : newForm.approverDepartmentIds.filter((id) => id !== d.id)
                                setNewForm({ ...newForm, approverDepartmentIds: next })
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
            </div>

            {/* Section 3: Contact & Personal Details */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-subtle">
                Personal &amp; Contact (Optional)
              </span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Personal / Login Email" htmlFor="new-email">
                  <Input
                    id="new-email"
                    type="email"
                    value={newForm.email}
                    onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </Field>
                <Field label="Mobile Number" htmlFor="new-mobile">
                  <Input
                    id="new-mobile"
                    type="tel"
                    value={newForm.mobileNumber}
                    onChange={(e) => setNewForm({ ...newForm, mobileNumber: e.target.value })}
                    placeholder="10-digit mobile number"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Date of Birth" htmlFor="new-dob">
                  <Input
                    id="new-dob"
                    type="date"
                    value={newForm.dob}
                    onChange={(e) => setNewForm({ ...newForm, dob: e.target.value })}
                  />
                </Field>
                <Field label="Gender" htmlFor="new-gender">
                  <Select
                    id="new-gender"
                    value={newForm.gender}
                    onChange={(e) => setNewForm({ ...newForm, gender: e.target.value })}
                  >
                    <option value="">Select Gender...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </Select>
                </Field>
                <Field label="Father / Husband Name" htmlFor="new-guardian">
                  <Input
                    id="new-guardian"
                    type="text"
                    value={newForm.fatherHusbandName}
                    onChange={(e) => setNewForm({ ...newForm, fatherHusbandName: e.target.value })}
                    placeholder="Guardian full name"
                  />
                </Field>
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
