'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  KeyRound,
  UserPlus,
  Users,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Download,
  AlertCircle,
  FileUp,
  CheckCircle,
} from 'lucide-react'
import { IntimeMark, SchoolBadge } from '@/components/brand/Brand'
import { APP_NAME, APP_TAGLINE } from '@/lib/brand'
import { Button, Card, Field, Input, Select } from '@/components/ui'
import Papa from 'papaparse'

type AdminUser = {
  id: string
  name: string | null
  email: string | null
  staffId: string | null
}

type StaffItem = {
  id: string
  name: string
  machineId: string
  employeeCode: string | null
  joiningDate: string | null
}

type StaffOnboardingRecord = {
  machineId: string
  joiningDate: string
  payGroup?: string
}

type GeneratedCredential = {
  name: string
  machineId: string
  employeeCode: string
  temporaryPassword?: string
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Loaded from GET /api/setup
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [existingStaff, setExistingStaff] = useState<StaffItem[]>([])

  // Wizard State
  // Step 1: Secret Key
  const [secret, setSecret] = useState('')

  // Step 2: Admin Profile
  const [adminAction, setAdminAction] = useState<'LINK' | 'CREATE'>('CREATE')
  const [selectedAdminUserId, setSelectedAdminUserId] = useState('')
  const [selectedExistingStaffId, setSelectedExistingStaffId] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminMachineId, setAdminMachineId] = useState('')
  const [adminJoiningDate, setAdminJoiningDate] = useState('2024-01-01')
  const [adminPayGroup, setAdminPayGroup] = useState('BANK_EPF')
  // Fresh installs have no administrator login yet, so the wizard creates one.
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('')
  const [verifying, setVerifying] = useState(false)
  const needsAdminAccount = adminUsers.length === 0

  // Step 3: Staff Batch Onboarding
  const [staffJoiningDates, setStaffJoiningDates] = useState<StaffOnboardingRecord[]>([])
  const [csvFileName, setCsvFileName] = useState('')

  // Step 4: Completion Output
  const [isCompleted, setIsCompleted] = useState(false)
  const [generatedCredentials, setGeneratedCredentials] = useState<GeneratedCredential[]>([])

  // Fetch initial setup status
  useEffect(() => {
    async function fetchSetupState() {
      try {
        const res = await fetch('/api/setup')
        if (!res.ok) {
          throw new Error('Failed to fetch setup state')
        }
        const data = await res.json()
        if (data.setupCompleted) {
          router.replace('/')
          return
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Error communicating with setup server')
      } finally {
        setLoading(false)
      }
    }

    fetchSetupState()
  }, [router])

  // Step 1: Verify the secret with the server, which then returns the data the wizard needs
  const handleVerifySecret = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')
    if (!secret.trim()) {
      setErrorMessage('Please enter the setup secret code.')
      return
    }
    setVerifying(true)
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secret.trim(), action: 'VERIFY' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Could not verify the setup secret code.')
      }
      const admins: AdminUser[] = data.adminUsers || []
      setAdminUsers(admins)
      setExistingStaff(data.existingStaff || [])
      if (admins.length > 0) {
        const unlinked = admins.find((u) => !u.staffId)
        setSelectedAdminUserId(unlinked ? unlinked.id : admins[0].id)
        if (unlinked?.name) setAdminName(unlinked.name)
      } else {
        setSelectedAdminUserId('')
      }
      setStep(2)
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not verify the setup secret code.')
    } finally {
      setVerifying(false)
    }
  }

  // Step 2: Advance to Step 3
  const handleAdminStep = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (needsAdminAccount) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
        setErrorMessage('Please enter a valid administrator email address.')
        return
      }
      if (adminPassword.length < 8) {
        setErrorMessage('The administrator password must be at least 8 characters.')
        return
      }
      if (adminPassword !== adminPasswordConfirm) {
        setErrorMessage('The administrator passwords do not match.')
        return
      }
    } else if (!selectedAdminUserId) {
      setErrorMessage('Please select an Administrator user to link or configure.')
      return
    }

    if (adminAction === 'LINK') {
      if (!selectedExistingStaffId) {
        setErrorMessage('Please select an existing staff profile to link.')
        return
      }
    } else {
      if (!adminName.trim() || !adminMachineId.trim() || !adminJoiningDate.trim()) {
        setErrorMessage('Please enter the Admin full name, Machine ID, and joining date.')
        return
      }
    }

    setStep(3)
  }

  // Handle CSV file upload for batch staff joining dates
  const handleCsvUpload = (file: File) => {
    setErrorMessage('')
    setCsvFileName(file.name)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: StaffOnboardingRecord[] = []
        for (const row of results.data as Record<string, string>[]) {
          const mId = row.machineId || row.MachineId || row['Machine ID'] || row['machine_id']
          const jDate = row.joiningDate || row.JoiningDate || row['Joining Date'] || row['joining_date']
          const pGroup = row.payGroup || row.PayGroup || row['Pay Group'] || 'BANK_EPF'

          if (mId && jDate) {
            rows.push({
              machineId: String(mId).trim(),
              joiningDate: String(jDate).trim(),
              payGroup: pGroup ? String(pGroup).trim() : 'BANK_EPF',
            })
          }
        }

        if (rows.length === 0) {
          setErrorMessage('No valid rows found in CSV. Expected columns: machineId, joiningDate, payGroup.')
        } else {
          setStaffJoiningDates(rows)
        }
      },
      error: (error) => {
        setErrorMessage(`Failed to parse CSV: ${error.message}`)
      },
    })
  }

  // Step 4: Submit Final Setup to API
  const handleFinalSubmit = async () => {
    setErrorMessage('')
    setSubmitting(true)

    try {
      const payload: Record<string, unknown> = {
        secret: secret.trim(),
        adminAction,
      }
      if (needsAdminAccount) {
        payload.adminAccount = { email: adminEmail.trim(), password: adminPassword }
      } else {
        payload.adminUserId = selectedAdminUserId
      }

      if (adminAction === 'LINK') {
        payload.existingStaffId = selectedExistingStaffId
      } else {
        payload.adminProfile = {
          name: adminName.trim(),
          machineId: adminMachineId.trim(),
          joiningDate: adminJoiningDate.trim(),
          payGroup: adminPayGroup,
        }
      }

      if (staffJoiningDates.length > 0) {
        payload.staffJoiningDates = staffJoiningDates
      }

      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete setup.')
      }

      setIsCompleted(true)
      if (data.generatedCredentials && data.generatedCredentials.length > 0) {
        setGeneratedCredentials(data.generatedCredentials)
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during setup.')
    } finally {
      setSubmitting(false)
    }
  }

  // Download prefilled CSV template with existing staff
  const handleDownloadTemplate = () => {
    const templateData = existingStaff.map((s) => ({
      machineId: s.machineId,
      name: s.name,
      joiningDate: s.joiningDate || '',
      payGroup: 'BANK_EPF',
    }))
    const csvContent = Papa.unparse(templateData)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'staff-joining-dates-template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download Generated Credentials CSV
  const handleDownloadCredentialsCsv = () => {
    if (generatedCredentials.length === 0) return
    const csvContent = Papa.unparse(generatedCredentials)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `intime-staff-credentials-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ground px-4">
        <div className="text-sm text-muted">Checking system setup status...</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ground px-4 py-12">
      <div className="mb-6 flex flex-col items-center text-center">
        <IntimeMark size={48} className="mb-3" />
        <h1 className="text-2xl font-semibold text-text">{APP_NAME} Upgrade Bootstrap</h1>
        <p className="mt-1 text-sm text-muted">{APP_TAGLINE} • Initial System Setup</p>
      </div>

      <Card className="w-full max-w-[620px] p-8 shadow-xl">
        {/* Step Indicator Header */}
        {!isCompleted && (
          <div className="mb-8 flex items-center justify-between border-b border-line-soft pb-4">
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 1 ? 'text-primary' : 'text-muted'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === 1 ? 'bg-primary text-black font-semibold' : 'bg-surface text-muted'}`}>
                1
              </span>
              Secret
            </div>
            <div className="h-0.5 w-6 bg-line-soft" />
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 2 ? 'text-primary' : 'text-muted'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === 2 ? 'bg-primary text-black font-semibold' : 'bg-surface text-muted'}`}>
                2
              </span>
              Admin
            </div>
            <div className="h-0.5 w-6 bg-line-soft" />
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 3 ? 'text-primary' : 'text-muted'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === 3 ? 'bg-primary text-black font-semibold' : 'bg-surface text-muted'}`}>
                3
              </span>
              Staff
            </div>
            <div className="h-0.5 w-6 bg-line-soft" />
            <div className={`flex items-center gap-2 text-sm font-medium ${step === 4 ? 'text-primary' : 'text-muted'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${step === 4 ? 'bg-primary text-black font-semibold' : 'bg-surface text-muted'}`}>
                4
              </span>
              Review
            </div>
          </div>
        )}

        {/* Global Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-center gap-2 rounded-[10px] border border-absent/30 bg-absent/10 px-3.5 py-2.5 text-sm text-absent"
          >
            <AlertCircle size={16} aria-hidden="true" className="flex-none" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Secret Key Verification */}
        {step === 1 && (
          <form onSubmit={handleVerifySecret} className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-base font-medium text-text">
                <KeyRound size={18} className="text-primary" />
                <h2>Step 1: Enter Setup Secret Code</h2>
              </div>
              <p className="mt-1 text-xs text-muted">
                Initial system configuration requires the server setup secret code configured in your environment.
              </p>
            </div>

            <Field label="Setup Secret Code" htmlFor="setup-secret">
              <Input
                id="setup-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Enter SETUP_SECRET key"
                autoComplete="off"
                required
              />
            </Field>

            <div className="pt-2">
              <Button type="submit" variant="primary" className="w-full" disabled={verifying}>
                {verifying ? 'Verifying…' : 'Verify & Continue'} <ArrowRight size={16} className="ml-1.5" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 2: Primary Admin Profile Linking or Creation */}
        {step === 2 && (
          <form onSubmit={handleAdminStep} className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-base font-medium text-text">
                <UserPlus size={18} className="text-primary" />
                <h2>Step 2: Admin Profile Configuration</h2>
              </div>
              <p className="mt-1 text-xs text-muted">
                Link an administrator account to a staff member record and generate their employee code.
              </p>
            </div>

            {needsAdminAccount ? (
              <div className="space-y-4">
                <p className="text-xs text-muted">
                  No administrator account exists yet. Create the login you will use to sign in.
                </p>
                <Field label="Administrator Email" htmlFor="admin-email">
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@school.org"
                    required
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Password (min 8 characters)" htmlFor="admin-password">
                    <Input
                      id="admin-password"
                      type="password"
                      autoComplete="new-password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Confirm Password" htmlFor="admin-password-confirm">
                    <Input
                      id="admin-password-confirm"
                      type="password"
                      autoComplete="new-password"
                      value={adminPasswordConfirm}
                      onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                      required
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <Field label="Select Administrator User" htmlFor="admin-user-select">
                <Select
                  id="admin-user-select"
                  value={selectedAdminUserId}
                  onChange={(e) => setSelectedAdminUserId(e.target.value)}
                >
                  {adminUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || 'Unnamed Admin'} ({user.email || 'No email'}) {user.staffId ? '• [Already Linked]' : '• [Unlinked]'}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="flex gap-4 border-y border-line-soft py-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
                <input
                  type="radio"
                  name="adminAction"
                  checked={adminAction === 'CREATE'}
                  onChange={() => setAdminAction('CREATE')}
                  className="accent-primary"
                />
                Create New Staff Profile
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-text">
                <input
                  type="radio"
                  name="adminAction"
                  checked={adminAction === 'LINK'}
                  onChange={() => setAdminAction('LINK')}
                  className="accent-primary"
                />
                Link to Existing Staff
              </label>
            </div>

            {adminAction === 'CREATE' ? (
              <div className="space-y-4">
                <Field label="Admin Full Name" htmlFor="admin-name">
                  <Input
                    id="admin-name"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Ramesh Patel"
                    required
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="Biometric Machine ID" htmlFor="admin-machine-id">
                    <Input
                      id="admin-machine-id"
                      value={adminMachineId}
                      onChange={(e) => setAdminMachineId(e.target.value)}
                      placeholder="e.g. 999"
                      required
                    />
                  </Field>

                  <Field label="Joining Date (YYYY-MM-DD)" htmlFor="admin-joining-date">
                    <Input
                      id="admin-joining-date"
                      type="date"
                      value={adminJoiningDate}
                      onChange={(e) => setAdminJoiningDate(e.target.value)}
                      required
                    />
                  </Field>
                </div>

                <Field label="Payroll Group" htmlFor="admin-pay-group">
                  <Select
                    id="admin-pay-group"
                    value={adminPayGroup}
                    onChange={(e) => setAdminPayGroup(e.target.value)}
                  >
                    <option value="BANK_EPF">BANK_EPF (Direct Deposit & EPF)</option>
                    <option value="CASH">CASH</option>
                  </Select>
                </Field>
              </div>
            ) : (
              <Field label="Existing Staff Profile" htmlFor="existing-staff-select">
                <Select
                  id="existing-staff-select"
                  value={selectedExistingStaffId}
                  onChange={(e) => setSelectedExistingStaffId(e.target.value)}
                >
                  <option value="">-- Choose Existing Staff Member --</option>
                  {existingStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      Machine #{staff.machineId} • {staff.name} {staff.employeeCode ? `(${staff.employeeCode})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft size={16} className="mr-1.5" /> Back
              </Button>
              <Button type="submit" variant="primary">
                Next: Staff Onboarding <ArrowRight size={16} className="ml-1.5" />
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: Initial Staff Onboarding (Optional) */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-base font-medium text-text">
                <Users size={18} className="text-primary" />
                <h2>Step 3: Initial Staff Joining Dates (Optional)</h2>
              </div>
              <p className="mt-1 text-xs text-muted">
                Assign joining dates to imported staff members to generate sequential employee codes (SAR-YYYY-NNN) and initial login credentials.
              </p>
            </div>

            <div className="rounded-[10px] border border-line-soft bg-surface/50 p-4">
              <div className="flex items-center gap-3">
                <FileUp size={24} className="text-primary flex-none" />
                <div className="flex-1 text-xs text-muted">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-text">Staff Onboarding CSV</div>
                    {existingStaff.length > 0 && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleDownloadTemplate}
                      >
                        <Download size={14} className="mr-1.5" /> Download Prefilled Template
                      </Button>
                    )}
                  </div>
                  <div className="mt-1">
                    Download the prefilled template above, fill in the <code className="text-primary">joiningDate</code> (YYYY-MM-DD), and upload it below.
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleCsvUpload(file)
                  }}
                  className="text-xs text-muted file:mr-2 file:rounded-[8px] file:border-0 file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-text hover:file:bg-line"
                />
                {csvFileName && (
                  <div className="mt-2 text-xs text-primary">
                    Loaded {staffJoiningDates.length} staff records from {csvFileName}
                  </div>
                )}
              </div>
            </div>

            {existingStaff.length > 0 && staffJoiningDates.length === 0 && (
              <div className="rounded-[10px] border border-line-soft p-3">
                <div className="mb-2 text-xs font-medium text-text">
                  Existing Imported Staff ({existingStaff.length} found)
                </div>
                <div className="max-h-40 overflow-y-auto overscroll-contain space-y-1 text-xs text-muted">
                  {existingStaff.slice(0, 8).map((s) => (
                    <div key={s.id} className="flex justify-between py-1 border-b border-line-soft/40">
                      <span>Machine #{s.machineId} • {s.name}</span>
                      <span className="text-subtle">{s.employeeCode || 'No Code Yet'}</span>
                    </div>
                  ))}
                  {existingStaff.length > 8 && (
                    <div className="pt-1 text-center text-subtle">...and {existingStaff.length - 8} more</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="secondary" onClick={() => setStep(2)}>
                <ArrowLeft size={16} className="mr-1.5" /> Back
              </Button>
              <Button type="button" variant="primary" onClick={() => setStep(4)}>
                Review & Lock <ArrowRight size={16} className="ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Review, Confirmation & Completion */}
        {step === 4 && !isCompleted && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 text-base font-medium text-text">
                <ShieldCheck size={18} className="text-primary" />
                <h2>Step 4: Review & Lock Setup</h2>
              </div>
              <p className="mt-1 text-xs text-muted">
                Please review your configuration. Completing setup will lock this wizard permanently.
              </p>
            </div>

            <div className="rounded-[10px] border border-line-soft bg-surface/30 p-4 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-line-soft">
                <span className="text-muted">Admin Action:</span>
                <span className="font-medium text-text">
                  {adminAction === 'CREATE' ? 'Create New Profile' : 'Link Existing Staff Profile'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-line-soft">
                <span className="text-muted">Target Administrator:</span>
                <span className="font-medium text-text">
                  {needsAdminAccount ? `${adminEmail.trim()} (new account)` : adminUsers.find((u) => u.id === selectedAdminUserId)?.email || selectedAdminUserId}
                </span>
              </div>
              {adminAction === 'CREATE' ? (
                <>
                  <div className="flex justify-between py-1 border-b border-line-soft">
                    <span className="text-muted">Staff Name & Machine ID:</span>
                    <span className="font-medium text-text">{adminName} (Machine #{adminMachineId})</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-line-soft">
                    <span className="text-muted">Joining Date:</span>
                    <span className="font-medium text-text">{adminJoiningDate}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between py-1 border-b border-line-soft">
                  <span className="text-muted">Linked Staff ID:</span>
                  <span className="font-medium text-text">{selectedExistingStaffId}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-muted">Staff Onboarded in Batch:</span>
                <span className="font-medium text-text">{staffJoiningDates.length} staff members</span>
              </div>
            </div>

            <div className="rounded-[10px] border border-line-soft bg-surface/20 p-3 text-xs text-muted flex items-start gap-2">
              <AlertCircle size={16} className="text-muted flex-none mt-0.5" />
              <span>
                Once locked, <code className="text-primary">SETUP_COMPLETED</code> will be enabled in system settings, and future requests to this wizard will automatically redirect to the home dashboard.
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="secondary" onClick={() => setStep(3)} disabled={submitting}>
                <ArrowLeft size={16} className="mr-1.5" /> Back
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={submitting}
                onClick={handleFinalSubmit}
              >
                Complete Setup & Lock System
              </Button>
            </div>
          </div>
        )}

        {/* COMPLETION SUCCESS SCREEN */}
        {isCompleted && (
          <div className="space-y-6 text-center">
            <div className="flex flex-col items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-present/20 text-present mb-3">
                <CheckCircle size={28} />
              </div>
              <h2 className="text-lg font-semibold text-text">Setup Completed & Gate Locked!</h2>
              <p className="mt-1 text-xs text-muted">
                Initial bootstrap configuration has been written to the database. All routing gates are now secured.
              </p>
            </div>

            {generatedCredentials.length > 0 && (
              <div className="rounded-[10px] border border-line-soft bg-surface/30 p-4 text-left">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">
                    Generated User Credentials ({generatedCredentials.length})
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-7 text-xs"
                    onClick={handleDownloadCredentialsCsv}
                  >
                    <Download size={12} className="mr-1" /> Download CSV
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto overscroll-contain space-y-1.5 text-xs text-muted">
                  {generatedCredentials.slice(0, 5).map((c, idx) => (
                    <div key={idx} className="flex justify-between py-1 border-b border-line-soft/40">
                      <span>{c.name} ({c.employeeCode})</span>
                      <span className="font-mono text-primary">{c.temporaryPassword}</span>
                    </div>
                  ))}
                  {generatedCredentials.length > 5 && (
                    <div className="pt-1 text-center text-subtle">
                      ...and {generatedCredentials.length - 5} more in download CSV
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="button"
                variant="primary"
                className="w-full"
                onClick={() => {
                  window.location.href = '/'
                }}
              >
                Proceed to Dashboard <ArrowRight size={16} className="ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 border-t border-line-soft pt-5">
          <SchoolBadge centered />
        </div>
      </Card>
    </div>
  )
}

