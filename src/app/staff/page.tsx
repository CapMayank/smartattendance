'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/ui'
import { formatPing } from '@/lib/format'
import {
  Plus,
  Users,
  Camera,
  Upload,
  Download,
  FileSpreadsheet,
  Trash2,
  Pencil,
  Calendar,
  KeyRound,
  Copy,
  Check,
  Shield,
  UserCheck,
  AlertTriangle,
  LogOut as ExitIcon,
  RotateCcw,
  Search,
} from 'lucide-react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { istDateKey } from '@/lib/dashboard-calc'
import { previewHeadline, transitionRows } from '@/lib/shift-preview-text'
import type { PreviewSummary } from '@/lib/shift-change'
import { triggerPhotoCleanup } from '@/lib/photo-cleanup-client'
import { staffPhotoUrl } from '@/lib/photo-url'

const ALWAYS_DAY = '2000-01-01'

type PreviewState = { key: string; status: 'ok' | 'error'; summary?: PreviewSummary; error?: string }
type HistoryRow = { id: string; effectiveFrom: string; shiftId: string | null; shiftName: string | null; source: string }
type PunchPhoto = { id: string; takenAt: string }
type PendingRecalc = { shiftId: string; startDate: string; message: string }

const SOURCE_LABELS: Record<string, string> = { MANUAL: 'Manual', SUGGESTION: 'Suggestion', INITIAL: 'Initial' }

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
  department?: { name: string }
  designation?: { name: string }
  shift?: { name: string; startTime: string; endTime: string }
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
    payGroup: 'BANK_EPF' | 'CASH'
  } | null
  employmentPeriods?: EmploymentPeriodRow[]
}

type IssuedCredential = {
  name: string
  machineId?: string
  employeeCode: string
  temporaryPassword: string
}

type FilterMode = 'all' | 'active' | 'needs_onboarding' | 'exited' | 'admins'

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
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([])
  const [desigs, setDesigs] = useState<{ id: string; name: string }[]>([])
  const [shifts, setShifts] = useState<{ id: string; name: string }[]>([])

  const todayKey = istDateKey(new Date())

  const [formData, setFormData] = useState({
    name: '',
    machineId: '',
    joiningDate: todayKey,
    payGroup: 'BANK_EPF' as 'BANK_EPF' | 'CASH',
    role: 'EMPLOYEE' as 'EMPLOYEE' | 'APPROVER' | 'ADMIN',
    email: '',
    departmentId: '',
    designationId: '',
    shiftId: '',
    approvesAllDepartments: true,
    approverDepartmentIds: [] as string[],
  })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState({
    name: '',
    machineId: '',
    joiningDate: '',
    payGroup: 'BANK_EPF' as 'BANK_EPF' | 'CASH',
    role: 'EMPLOYEE' as 'EMPLOYEE' | 'APPROVER' | 'ADMIN',
    email: '',
    departmentId: '',
    designationId: '',
    shiftId: '',
    approvesAllDepartments: true,
    approverDepartmentIds: [] as string[],
  })

  // Lifecycle state inside Edit modal
  const [exitOpen, setExitOpen] = useState(false)
  const [exitForm, setExitForm] = useState({
    lastWorkingDay: todayKey,
    exitReason: 'RESIGNATION',
    notes: '',
  })
  const [rejoinDate, setRejoinDate] = useState(todayKey)
  const [lifecycleBusy, setLifecycleBusy] = useState(false)
  const [resettingStaffId, setResettingStaffId] = useState<string | null>(null)

  // Issued credentials modal state
  const [issuedCredentials, setIssuedCredentials] = useState<IssuedCredential[] | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const [originalShiftId, setOriginalShiftId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [history, setHistory] = useState<{ staffId: string; rows: HistoryRow[] | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingRecalc, setPendingRecalc] = useState<PendingRecalc | null>(null)

  const [photos, setPhotos] = useState<{ staffId: string; items: PunchPhoto[] | null } | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [viewPhoto, setViewPhoto] = useState<PunchPhoto | null>(null)
  const editingStaff = staffList.find((s) => s.id === editingId) ?? null

  const shiftChanged = editingId !== null && editData.shiftId !== originalShiftId
  const previewKey = `${editData.shiftId}|${startDate}`
  const currentPreview = preview && preview.key === previewKey ? preview : null
  const previewLoading = shiftChanged && !currentPreview
  const canSave = !saving && !pendingRecalc && (!shiftChanged || currentPreview?.status === 'ok')

  const startEditing = (staff: Staff) => {
    const currentShiftId = staff.shiftId ?? ''
    setOriginalShiftId(currentShiftId)
    setStartDate(istDateKey(new Date()))
    setPreview(null)
    setPendingRecalc(null)
    setSaving(false)
    setExitOpen(false)
    setExitForm({
      lastWorkingDay: todayKey,
      exitReason: 'RESIGNATION',
      notes: '',
    })
    setRejoinDate(todayKey)
    setEditingId(staff.id)
    const assignedDeptIds = (staff.user?.approverDepartments ?? []).map((d) => d.departmentId)
    setEditData({
      name: staff.name,
      machineId: staff.machineId,
      joiningDate: toInputDate(staff.joiningDate),
      payGroup: staff.payrollInfo?.payGroup ?? 'BANK_EPF',
      role: staff.user?.role ?? 'EMPLOYEE',
      email: staff.user?.email ?? '',
      departmentId: staff.department?.name ? depts.find((d) => d.name === staff.department?.name)?.id || '' : '',
      designationId: staff.designation?.name ? desigs.find((d) => d.name === staff.designation?.name)?.id || '' : '',
      shiftId: currentShiftId,
      approvesAllDepartments:
        staff.user?.approvesAllDepartments !== undefined
          ? staff.user.approvesAllDepartments
          : assignedDeptIds.length === 0,
      approverDepartmentIds: assignedDeptIds,
    })
  }

  const saveOtherFields = async () => {
    const { shiftId: _shiftId, ...rest } = editData
    void _shiftId
    const res = await fetch('/api/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId,
        ...rest,
        joiningDate: rest.joiningDate || undefined,
      }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      const staffName = editData.name
      const staffMachineId = editData.machineId
      setEditingId(null)
      setPendingRecalc(null)
      fetchData()
      toast.success('Staff member updated successfully')
      if (data?.temporaryPassword && data?.employeeCode) {
        setIssuedCredentials([
          {
            name: staffName,
            machineId: staffMachineId,
            employeeCode: data.employeeCode,
            temporaryPassword: data.temporaryPassword,
          },
        ])
      }
    } else {
      if (shiftChanged) fetchData()
      toast.error(data?.error || 'Failed to update staff member')
    }
  }

  const applyShift = async (shiftId: string, effectiveFrom: string): Promise<boolean> => {
    const res = await fetch(`/api/staff/${editingId}/shift`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shiftId: shiftId || null, effectiveFrom }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) {
      toast.error(data?.error || 'Failed to change shift')
      return false
    }
    if (data.recalculated === false) {
      fetchData()
      setPendingRecalc({
        shiftId,
        startDate: effectiveFrom,
        message: data.error
          ? `The new shift is saved, but past days were not recalculated: ${data.error}`
          : 'The new shift is saved, but past days were not recalculated.',
      })
      return false
    }
    return true
  }

  const saveEdit = async () => {
    if (!canSave) return
    setSaving(true)
    try {
      if (shiftChanged && !(await applyShift(editData.shiftId, startDate))) return
      await saveOtherFields()
    } finally {
      setSaving(false)
    }
  }

  const retryRecalculate = async () => {
    if (!pendingRecalc || saving) return
    setSaving(true)
    try {
      if (await applyShift(pendingRecalc.shiftId, pendingRecalc.startDate)) await saveOtherFields()
    } finally {
      setSaving(false)
    }
  }

  const fetchData = async () => {
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
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])
  useEffect(() => {
    triggerPhotoCleanup()
  }, [])

  // Shift history for the open edit modal
  useEffect(() => {
    if (!editingId) return
    let cancelled = false
    fetch(`/api/staff/${editingId}/shift-history`)
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!cancelled) setHistory({ staffId: editingId, rows: Array.isArray(rows) ? rows : null })
      })
      .catch(() => {
        if (!cancelled) setHistory({ staffId: editingId, rows: null })
      })
    return () => {
      cancelled = true
    }
  }, [editingId])

  // Dry-run preview whenever the shift or start date changes (debounced, stale replies ignored)
  useEffect(() => {
    if (!editingId || editData.shiftId === originalShiftId || !startDate || startDate < ALWAYS_DAY) return
    let cancelled = false
    const key = `${editData.shiftId}|${startDate}`
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/staff/${editingId}/shift`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shiftId: editData.shiftId || null, effectiveFrom: startDate, dryRun: true }),
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (res.ok && data && typeof data.recalculatedDays === 'number') setPreview({ key, status: 'ok', summary: data })
        else setPreview({ key, status: 'error', error: data?.error || 'Could not load the preview' })
      } catch {
        if (!cancelled) setPreview({ key, status: 'error', error: 'Could not load the preview' })
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [editingId, editData.shiftId, originalShiftId, startDate])

  // Recent punch photos for the open edit modal
  useEffect(() => {
    if (!editingId) return
    let cancelled = false
    fetch(`/api/staff/${editingId}/photos?limit=12`)
      .then((r) => (r.ok ? r.json() : null))
      .then((rows) => {
        if (!cancelled) setPhotos({ staffId: editingId, items: Array.isArray(rows) ? rows : null })
      })
      .catch(() => {
        if (!cancelled) setPhotos({ staffId: editingId, items: null })
      })
    return () => {
      cancelled = true
    }
  }, [editingId])

  const changeProfilePhoto = async (pin: boolean) => {
    if (!editingId || photoBusy) return
    setPhotoBusy(true)
    const failMsg = pin ? 'Failed to set profile picture' : 'Failed to remove picture'
    try {
      const res = pin
        ? await fetch(`/api/staff/${editingId}/photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoId: viewPhoto?.id }),
          })
        : await fetch(`/api/staff/${editingId}/photo`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error(failMsg)
        return
      }
      toast.success(pin ? 'Profile picture updated' : 'Profile picture removed')
      setViewPhoto(null)
    } catch {
      toast.error(failMsg)
      return
    } finally {
      setPhotoBusy(false)
    }
    try {
      await fetchData()
    } catch {
      /* the list refreshes on the next load */
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.machineId || !formData.joiningDate) return

    const payload = {
      name: formData.name,
      machineId: formData.machineId,
      joiningDate: formData.joiningDate,
      payGroup: formData.payGroup,
      role: formData.role,
      email: formData.email.trim() || null,
      departmentId: formData.departmentId || null,
      designationId: formData.designationId || null,
      shiftId: formData.shiftId || null,
      approvesAllDepartments: formData.role === 'APPROVER' ? formData.approvesAllDepartments : undefined,
      approverDepartmentIds:
        formData.role === 'APPROVER' && !formData.approvesAllDepartments ? formData.approverDepartmentIds : undefined,
    }

    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json().catch(() => null)
    if (res.ok && data) {
      const createdName = formData.name
      const createdMachineId = formData.machineId
      setFormData({
        name: '',
        machineId: '',
        joiningDate: todayKey,
        payGroup: 'BANK_EPF',
        role: 'EMPLOYEE',
        email: '',
        departmentId: '',
        designationId: '',
        shiftId: '',
        approvesAllDepartments: true,
        approverDepartmentIds: [],
      })
      fetchData()
      toast.success('Staff member added & login credentials generated')
      if (data.temporaryPassword && data.employeeCode) {
        setIssuedCredentials([
          {
            name: createdName,
            machineId: createdMachineId,
            employeeCode: data.employeeCode,
            temporaryPassword: data.temporaryPassword,
          },
        ])
      }
    } else {
      toast.error(data?.error || 'Failed to add staff member')
    }
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

  const handleExitStaff = async () => {
    if (!editingStaff || lifecycleBusy) return
    setLifecycleBusy(true)
    try {
      const res = await fetch(`/api/staff/${editingStaff.id}/lifecycle`, {
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
        toast.success(`${editingStaff.name} marked as exited and login disabled`)
        setEditingId(null)
        setExitOpen(false)
        fetchData()
      } else {
        toast.error(data?.error || 'Failed to record exit')
      }
    } finally {
      setLifecycleBusy(false)
    }
  }

  const handleRejoinStaff = async () => {
    if (!editingStaff || lifecycleBusy) return
    setLifecycleBusy(true)
    try {
      const res = await fetch(`/api/staff/${editingStaff.id}/lifecycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'REJOIN',
          joiningDate: rejoinDate,
          departmentId: editData.departmentId || null,
          designationId: editData.designationId || null,
          shiftId: editData.shiftId || null,
          payGroup: editData.payGroup,
        }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data) {
        toast.success(`${editingStaff.name} rejoined and login re-enabled`)
        const staffName = editingStaff.name
        const staffMachine = editingStaff.machineId
        const empCode = editingStaff.employeeCode || ''
        setEditingId(null)
        fetchData()
        if (data.temporaryPassword) {
          setIssuedCredentials([
            {
              name: staffName,
              machineId: staffMachine,
              employeeCode: empCode,
              temporaryPassword: data.temporaryPassword,
            },
          ])
        }
      } else {
        toast.error(data?.error || 'Failed to rejoin staff member')
      }
    } finally {
      setLifecycleBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return
    const res = await fetch(`/api/staff?id=${id}`, { method: 'DELETE' })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      fetchData()
      toast.success('Staff member deleted')
    } else {
      toast.error(data?.error || 'Failed to delete staff member')
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} staff members?`)) return
    const res = await fetch('/api/staff/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds }),
    })
    const data = await res.json().catch(() => null)
    if (res.ok) {
      setSelectedIds([])
      fetchData()
      toast.success(`${selectedIds.length} staff members deleted`)
    } else {
      toast.error(data?.error || 'Failed to delete staff members')
    }
  }

  const handleBulkAssignShift = async (shiftId: string) => {
    if (!shiftId) return
    const shiftName = shifts.find((s) => s.id === shiftId)?.name ?? 'the selected shift'
    if (!confirm(`Assign ${selectedIds.length} staff to ${shiftName}? It applies from today; earlier days keep their shift.`)) return
    const res = await fetch('/api/staff/bulk', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selectedIds, shiftId }),
    })
    if (res.ok) {
      setSelectedIds([])
      fetchData()
      toast.success(`${selectedIds.length} staff members assigned to new shift`)
    } else {
      toast.error('Failed to assign shift')
    }
  }

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

  const downloadTemplate = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,Name,Machine ID,Joining Date,Department,Designation,Shift,Pay Group\nJohn Doe,1001,2026-04-01,Teaching,Senior Teacher,General Shift,BANK_EPF\nJane Smith,1002,2026-04-01,Administration,Coordinator,General Shift,CASH'
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', 'staff_template.csv')
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
    link.setAttribute('download', `intime_issued_credentials_${todayKey}.csv`)
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/staff/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: results.data }),
          })
          const data = await res.json().catch(() => null)
          if (res.ok && data) {
            toast.success(`Successfully imported ${data.processedCount} staff members!`)
            fetchData()
            if (Array.isArray(data.generatedCredentials) && data.generatedCredentials.length > 0) {
              setIssuedCredentials(data.generatedCredentials)
            }
          } else {
            const firstErr = Array.isArray(data?.errors) && data.errors.length > 0
              ? `Row ${data.errors[0].row} (Machine #${data.errors[0].machineId}): ${data.errors[0].error}`
              : data?.error || 'Failed to import data. Please check the format.'
            toast.error(firstErr)
          }
        } catch {
          toast.error('An error occurred during import.')
        } finally {
          setUploading(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        }
      },
      error: () => {
        toast.error('Failed to parse CSV file.')
        setUploading(false)
      },
    })
  }

  const editingStatus = editingStaff ? getStaffLifecycleStatus(editingStaff) : 'ACTIVE'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Staff & Access"
        subtitle="Unified directory of school members, SAR-YYYY-NNN employee IDs, system roles, and login credentials"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Onboard new staff member"
            caption="Automatically assigns an Employee ID (SAR-YYYY-NNN) and generates a one-time login password"
          />
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Full name" htmlFor="new-name">
                <Input
                  id="new-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Rajesh Sharma"
                  required
                />
              </Field>
              <Field label="Biometric Machine ID" htmlFor="new-machine">
                <Input
                  id="new-machine"
                  type="text"
                  value={formData.machineId}
                  onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                  placeholder="e.g. 101"
                  required
                />
              </Field>
              <Field label="Joining date" htmlFor="new-joining-date">
                <Input
                  id="new-joining-date"
                  type="date"
                  value={formData.joiningDate}
                  onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Pay group" htmlFor="new-pay-group">
                <Select
                  id="new-pay-group"
                  value={formData.payGroup}
                  onChange={(e) => setFormData({ ...formData, payGroup: e.target.value as 'BANK_EPF' | 'CASH' })}
                >
                  <option value="BANK_EPF">Bank / EPF</option>
                  <option value="CASH">Cash</option>
                </Select>
              </Field>
              <Field label="Portal access role" htmlFor="new-role">
                <Select
                  id="new-role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value as 'EMPLOYEE' | 'APPROVER' | 'ADMIN' })
                  }
                >
                  <option value="EMPLOYEE">Employee (My Portal)</option>
                  <option value="APPROVER">Approver</option>
                  <option value="ADMIN">Administrator (Full Access)</option>
                </Select>
              </Field>
              <Field label="Email (optional)" htmlFor="new-email">
                <Input
                  id="new-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Optional email login"
                />
              </Field>
            </div>

            {formData.role === 'APPROVER' && (
              <div className="rounded-xl border border-line-soft bg-canvas p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-medium text-text">Approver department scope</p>
                    <p className="text-xs text-subtle">
                      Choose whether this Approver can view attendance across all departments or specific ones.
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="Department" htmlFor="new-dept">
                <Select
                  id="new-dept"
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                >
                  <option value="">No Dept...</option>
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
                  value={formData.designationId}
                  onChange={(e) => setFormData({ ...formData, designationId: e.target.value })}
                >
                  <option value="">No Designation...</option>
                  {desigs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Shift" htmlFor="new-shift">
                <Select
                  id="new-shift"
                  value={formData.shiftId}
                  onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
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

            <Button type="submit" icon={Plus} className="w-full">
              Add Staff &amp; Issue Credentials
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <span className="grid size-11 flex-none place-items-center rounded-xl border border-line bg-card-hi text-muted">
                <FileSpreadsheet size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-[15px] font-medium text-text">Bulk CSV onboarding</h2>
                <p className="mt-0.5 text-[13px] text-subtle">
                  Import staff with joining dates to auto-issue Employee IDs and temporary passwords.
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-line-soft bg-canvas p-3 text-[12.5px] text-muted">
              <p className="font-medium text-text">How employee login works</p>
              <ul className="mt-1.5 list-inside list-disc space-y-1 text-subtle">
                <li>
                  Every member gets an ID like <span className="num text-text">SAR-2026-001</span>.
                </li>
                <li>
                  Click the <b className="text-text">Key</b> icon on any row to view or reset their temporary password.
                </li>
                <li>Employees must set a personal password on first sign-in.</li>
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Button variant="secondary" icon={Download} onClick={downloadTemplate}>
              Download CSV Template
            </Button>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-line px-4 text-[13.5px] font-medium text-muted transition-colors duration-150 hover:border-subtle hover:text-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-acc-2 has-disabled:cursor-not-allowed has-disabled:opacity-50">
              <Upload size={16} aria-hidden="true" /> {uploading ? 'Uploading...' : 'Upload CSV File'}
              <input
                type="file"
                accept=".csv"
                className="sr-only"
                onChange={handleFileUpload}
                ref={fileInputRef}
                disabled={uploading}
              />
            </label>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col justify-between gap-3 border-b border-line-soft p-4 lg:flex-row lg:items-center">
          <ChipGroup label="Filter staff directory">
            <Chip pressed={filterMode === 'all'} onClick={() => setFilterMode('all')} count={counts.all}>
              All
            </Chip>
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
          </ChipGroup>

          <div className="relative w-full lg:w-72">
            <Search
              size={15}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle"
            />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, SAR-ID, machine ID..."
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

              <Button variant="danger" icon={Trash2} onClick={handleBulkDelete} className="w-full sm:w-auto">
                Bulk Delete
              </Button>
              <p className="w-full text-xs text-subtle">A bulk shift applies from today. Earlier days keep their shift.</p>
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
                <th>Staff member</th>
                <th>Employee ID &amp; Machine</th>
                <th>Access &amp; Status</th>
                <th>Department / Role</th>
                <th>Pay group &amp; Shift</th>
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
                          <Avatar name={staff.name} src={staffPhotoUrl(staff)} />
                          <div className="flex flex-col">
                            <span className="font-medium text-text">{staff.name}</span>
                            {staff.user?.email ? (
                              <span className="text-xs text-subtle">{staff.user.email}</span>
                            ) : (
                              <span className="text-xs text-subtle">
                                {staff.joiningDate ? `Joined ${toInputDate(staff.joiningDate)}` : 'No joining date set'}
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
                              onClick={() => startEditing(staff)}
                              className="tint-badge tone-late inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium"
                            >
                              <AlertTriangle size={12} aria-hidden="true" />
                              Set joining date
                            </button>
                          )}
                          <span className="num text-xs text-subtle">Machine #{staff.machineId}</span>
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
                            label="Edit Staff & Access"
                            className="size-8"
                            onClick={() => startEditing(staff)}
                          />
                          <IconButton
                            icon={Trash2}
                            label="Delete Staff"
                            className="size-8 hover:border-absent hover:text-absent"
                            onClick={() => handleDelete(staff.id)}
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
                      title="No matching staff members"
                      hint="Add your first staff member using the form above or adjust your search filter."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Edit Staff & Access Modal */}
      <Modal
        open={editingId !== null}
        onClose={() => setEditingId(null)}
        title="Edit staff & access"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!canSave} loading={saving}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editingStaff && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-canvas p-3">
              <div className="flex items-center gap-3">
                <Avatar name={editingStaff.name} src={staffPhotoUrl(editingStaff)} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{editingStaff.name}</span>
                    {editingStaff.employeeCode ? (
                      <span className="num rounded-md border border-line bg-card-hi px-2 py-0.5 text-xs font-medium text-acc-1">
                        {editingStaff.employeeCode}
                      </span>
                    ) : (
                      <span className="tint-badge tone-late rounded-md px-2 py-0.5 text-xs">No Employee ID yet</span>
                    )}
                  </div>
                  <p className="text-xs text-subtle">
                    {editingStaff.hasPhoto ? 'Profile picture active' : 'No profile picture yet'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {editingStaff.hasPhoto && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => changeProfilePhoto(false)}
                    disabled={photoBusy}
                  >
                    Remove picture
                  </Button>
                )}
                {editingStatus !== 'EXITED' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={KeyRound}
                    onClick={() => handleResetTempPassword(editingStaff)}
                    disabled={resettingStaffId === editingStaff.id}
                  >
                    Reset Temp Password
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="edit-name">
              <Input
                id="edit-name"
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              />
            </Field>
            <Field label="Biometric Machine ID" htmlFor="edit-machine">
              <Input
                id="edit-machine"
                type="text"
                value={editData.machineId}
                onChange={(e) => setEditData({ ...editData, machineId: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Joining date"
              htmlFor="edit-joining"
              helper={
                !editingStaff?.employeeCode
                  ? 'Setting a joining date will generate their SAR-YYYY-NNN ID and temporary password.'
                  : undefined
              }
            >
              <Input
                id="edit-joining"
                type="date"
                value={editData.joiningDate}
                onChange={(e) => setEditData({ ...editData, joiningDate: e.target.value })}
              />
            </Field>
            <Field label="Pay group" htmlFor="edit-paygroup">
              <Select
                id="edit-paygroup"
                value={editData.payGroup}
                onChange={(e) => setEditData({ ...editData, payGroup: e.target.value as 'BANK_EPF' | 'CASH' })}
              >
                <option value="BANK_EPF">Bank / EPF</option>
                <option value="CASH">Cash</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Portal access role" htmlFor="edit-role">
              <Select
                id="edit-role"
                value={editData.role}
                onChange={(e) =>
                  setEditData({ ...editData, role: e.target.value as 'EMPLOYEE' | 'APPROVER' | 'ADMIN' })
                }
              >
                <option value="EMPLOYEE">Employee (My Portal)</option>
                <option value="APPROVER">Approver</option>
                <option value="ADMIN">Administrator (Full Access)</option>
              </Select>
            </Field>
            <Field label="Email address (optional)" htmlFor="edit-email">
              <Input
                id="edit-email"
                type="email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                placeholder="Optional email login"
              />
            </Field>
          </div>

          {editData.role === 'APPROVER' && (
            <div className="rounded-xl border border-line-soft bg-canvas p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-text">Approver department scope</p>
                  <p className="text-xs text-subtle">
                    Restrict this Approver to specific departments or allow all departments.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-text">
                  <input
                    type="checkbox"
                    className="size-4 accent-acc-2"
                    checked={editData.approvesAllDepartments}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        approvesAllDepartments: e.target.checked,
                        approverDepartmentIds: e.target.checked ? [] : editData.approverDepartmentIds,
                      })
                    }
                  />
                  All departments
                </label>
              </div>
              {!editData.approvesAllDepartments && depts.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-2 border-t border-line-soft pt-2.5">
                  {depts.map((d) => {
                    const checked = editData.approverDepartmentIds.includes(d.id)
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
                              ? [...editData.approverDepartmentIds, d.id]
                              : editData.approverDepartmentIds.filter((id) => id !== d.id)
                            setEditData({ ...editData, approverDepartmentIds: next })
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Department" htmlFor="edit-dept">
              <Select
                id="edit-dept"
                value={editData.departmentId}
                onChange={(e) => setEditData({ ...editData, departmentId: e.target.value })}
              >
                <option value="">No Dept</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Designation" htmlFor="edit-desig">
              <Select
                id="edit-desig"
                value={editData.designationId}
                onChange={(e) => setEditData({ ...editData, designationId: e.target.value })}
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

          <Field label="Assigned shift" htmlFor="edit-shift">
            <Select
              id="edit-shift"
              value={editData.shiftId}
              onChange={(e) => setEditData({ ...editData, shiftId: e.target.value })}
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
            <div className="space-y-3">
              <Field label="Starts on" htmlFor="edit-shift-start" helper="Days before this date keep their current shift.">
                <Input
                  id="edit-shift-start"
                  type="date"
                  min={ALWAYS_DAY}
                  value={startDate}
                  disabled={saving || pendingRecalc !== null}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </Field>
              <div className="rounded-xl border border-line-soft bg-card-hi p-3 text-[13px]" aria-live="polite">
                {!startDate || startDate < ALWAYS_DAY ? (
                  <p role="alert" className="text-absent">
                    Choose a start date on or after {ALWAYS_DAY}.
                  </p>
                ) : previewLoading ? (
                  <p className="text-muted">Loading preview...</p>
                ) : currentPreview?.status === 'error' ? (
                  <p role="alert" className="text-absent">
                    {currentPreview.error}
                  </p>
                ) : currentPreview?.summary ? (
                  <div className="space-y-1">
                    {startDate > todayKey ? (
                      <p className="text-text">
                        Takes effect on <span className="num">{startDate}</span>; nothing is recalculated yet.
                      </p>
                    ) : (
                      <>
                        <p className="num text-text">{previewHeadline(currentPreview.summary)}</p>
                        {transitionRows(currentPreview.summary.transitions).length > 0 && (
                          <ul className="space-y-0.5 text-muted">
                            {transitionRows(currentPreview.summary.transitions).map((r) => (
                              <li key={r.label}>
                                {r.label}: <span className="num text-text">{r.count}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {currentPreview.summary.lockedSkippedDays > 0 && (
                          <p className="text-muted">
                            <span className="num">{currentPreview.summary.lockedSkippedDays}</span> locked{' '}
                            {currentPreview.summary.lockedSkippedDays === 1 ? 'day' : 'days'} left alone
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              {pendingRecalc && (
                <div
                  role="alert"
                  className="space-y-2 rounded-xl border border-late bg-card-hi p-3 text-[13px] text-text"
                >
                  <p>{pendingRecalc.message}</p>
                  <Button variant="secondary" size="sm" onClick={retryRecalculate} loading={saving}>
                    Recalculate
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Employment Lifecycle Controls */}
          {editingStaff && editingStaff.employeeCode && (
            <div className="rounded-xl border border-line bg-canvas p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-text">Employment lifecycle</p>
                  <p className="text-xs text-subtle">
                    {editingStatus === 'EXITED'
                      ? 'This staff member has exited and their portal sign-in is disabled.'
                      : 'Record an exit when a staff member resigns, retires, or completes their contract.'}
                  </p>
                </div>
                {editingStatus !== 'EXITED' && !exitOpen && (
                  <Button variant="danger" size="sm" icon={ExitIcon} onClick={() => setExitOpen(true)}>
                    Record Exit
                  </Button>
                )}
              </div>

              {editingStatus !== 'EXITED' && exitOpen && (
                <div className="mt-3 space-y-3 border-t border-line-soft pt-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Last working day" htmlFor="exit-date">
                      <Input
                        id="exit-date"
                        type="date"
                        value={exitForm.lastWorkingDay}
                        onChange={(e) => setExitForm({ ...exitForm, lastWorkingDay: e.target.value })}
                      />
                    </Field>
                    <Field label="Exit reason" htmlFor="exit-reason">
                      <Select
                        id="exit-reason"
                        value={exitForm.exitReason}
                        onChange={(e) => setExitForm({ ...exitForm, exitReason: e.target.value })}
                      >
                        <option value="RESIGNATION">Resignation</option>
                        <option value="RETIREMENT">Retirement</option>
                        <option value="CONTRACT_END">Contract End</option>
                        <option value="TERMINATION">Termination</option>
                        <option value="ABSCONDING">Absconding</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Notes (optional)" htmlFor="exit-notes">
                    <Input
                      id="exit-notes"
                      type="text"
                      value={exitForm.notes}
                      onChange={(e) => setExitForm({ ...exitForm, notes: e.target.value })}
                      placeholder="Handover completed..."
                    />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setExitOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={ExitIcon}
                      onClick={handleExitStaff}
                      loading={lifecycleBusy}
                    >
                      Confirm Exit &amp; Disable Login
                    </Button>
                  </div>
                </div>
              )}

              {editingStatus === 'EXITED' && (
                <div className="mt-3 flex flex-col gap-3 border-t border-line-soft pt-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Field label="Rejoin date" htmlFor="rejoin-date">
                      <Input
                        id="rejoin-date"
                        type="date"
                        value={rejoinDate}
                        onChange={(e) => setRejoinDate(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={RotateCcw}
                    onClick={handleRejoinStaff}
                    loading={lifecycleBusy}
                  >
                    Rejoin &amp; Issue Temp Password
                  </Button>
                </div>
              )}
            </div>
          )}

          <div>
            <p className="mb-2 text-[13px] font-medium text-text">Recent punches</p>
            {!photos || photos.staffId !== editingId ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden="true">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full" />
                ))}
              </div>
            ) : photos.items === null ? (
              <p className="text-[13px] text-muted">Punch photos could not be loaded.</p>
            ) : photos.items.length === 0 ? (
              <EmptyState icon={Camera} title="No punch photos yet" />
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {photos.items.map((p) => {
                  const label = formatPing(new Date(p.takenAt), new Date())
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        aria-label={`View punch photo from ${label}`}
                        onClick={() => setViewPhoto(p)}
                        className="flex min-h-10 w-full flex-col items-center gap-1 rounded-lg border border-line-soft bg-card p-1 text-[11.5px] text-muted transition-colors hover:border-subtle hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc-2"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/photos/${p.id}`}
                          alt=""
                          width={160}
                          height={160}
                          loading="lazy"
                          className="aspect-square w-full rounded-md object-cover"
                        />
                        <span className="num">{label}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-[13px] font-medium text-text">Shift history</p>
            {!history || history.staffId !== editingId ? (
              <Skeleton className="h-4 w-40" />
            ) : history.rows === null ? (
              <p className="text-[13px] text-muted">Shift history could not be loaded.</p>
            ) : history.rows.length === 0 ? (
              <p className="text-[13px] text-muted">No changes yet — current shift applies to all days.</p>
            ) : (
              <ul className="divide-y divide-line-soft rounded-xl border border-line-soft text-[13px]">
                {history.rows.map((h) => (
                  <li key={h.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
                    <span className="num text-muted">{h.effectiveFrom <= ALWAYS_DAY ? 'Always' : h.effectiveFrom}</span>
                    <span className="min-w-0 flex-1 truncate text-text">{h.shiftName ?? 'No shift'}</span>
                    <span className="rounded-full border border-line-soft px-2 py-0.5 text-xs text-subtle">
                      {SOURCE_LABELS[h.source] ?? h.source}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

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
            prompted to set their own personal password as soon as they sign in at <span className="num">/login</span>.
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

      <Modal
        open={viewPhoto !== null}
        onClose={() => setViewPhoto(null)}
        title={viewPhoto ? `Punch photo, ${formatPing(new Date(viewPhoto.takenAt), new Date())}` : 'Punch photo'}
        footer={
          <>
            <Button onClick={() => changeProfilePhoto(true)} disabled={photoBusy} loading={photoBusy}>
              Use as profile picture
            </Button>
          </>
        }
      >
        {viewPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/photos/${viewPhoto.id}`}
            alt={`Punch photo of ${editingStaff?.name ?? 'staff member'} at ${formatPing(new Date(viewPhoto.takenAt), new Date())}`}
            className="mx-auto max-h-[60vh] w-full rounded-xl object-contain"
          />
        )}
      </Modal>
    </div>
  )
}
