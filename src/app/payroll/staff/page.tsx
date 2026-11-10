'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Wallet, Search, Edit2, Save, AlertCircle, CheckCircle2, XCircle, Users, ShieldCheck } from 'lucide-react'
import {
  Avatar,
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SectionLabel,
  Select,
  Skeleton,
} from '@/components/ui'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/cn'
import { staffPhotoUrl } from '@/lib/photo-url'
import { EpfoMembersTab } from '@/components/payroll/epfo/EpfoMembersTab'
import { StaffProfileModal } from '@/components/staff/StaffProfileModal'

type PayGroupFilter = 'ALL' | 'BANK_EPF' | 'CASH'

function StaffPayrollContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeMainTab = searchParams.get('tab') === 'epfo' ? 'epfo' : 'salary'

  const [staff, setStaff] = useState<any[]>([])
  const [fullStaffList, setFullStaffList] = useState<any[]>([])
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([])
  const [desigs, setDesigs] = useState<{ id: string; name: string }[]>([])
  const [shifts, setShifts] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<PayGroupFilter>('ALL')

  // Edit in salary table modal
  const [editingStaff, setEditingStaff] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Profile modal state for in-place fix
  const [fixModalOpen, setFixModalOpen] = useState(false)
  const [fixStaff, setFixStaff] = useState<any | null>(null)
  const [fixInitialTab, setFixInitialTab] = useState<'statutory' | 'kyc'>('statutory')
  const [fixHighlightedFields, setFixHighlightedFields] = useState<string[]>([])

  // EPFO summary counts & refresh trigger
  const [epfoPendingCount, setEpfoPendingCount] = useState(0)
  const [epfoRefreshTrigger, setEpfoRefreshTrigger] = useState(0)

  useEffect(() => {
    fetchStaff()
    fetchEpfoPendingCount()
    fetchMeta()
  }, [])

  const fetchMeta = async () => {
    try {
      const [dRes, desRes, shRes, sRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/designations'),
        fetch('/api/shifts'),
        fetch('/api/staff'),
      ])
      if (dRes.ok) setDepts(await dRes.json())
      if (desRes.ok) setDesigs(await desRes.json())
      if (shRes.ok) setShifts(await shRes.json())
      if (sRes.ok) setFullStaffList(await sRes.json())
    } catch {
      // Ignored
    }
  }

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/payroll/staff')
      const data = await res.json()
      setStaff(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEpfoPendingCount = async () => {
    try {
      const res = await fetch('/api/payroll/epfo/members')
      if (res.ok) {
        const data = await res.json()
        const c = data.counts || {}
        const pending =
          (c.NEEDS_REGISTRATION || 0) +
          (c.AWAITING_UAN || 0) +
          (c.NEEDS_EXIT || 0) +
          (c.NEEDS_KYC || 0)
        setEpfoPendingCount(pending)
      }
    } catch {
      // Ignored
    }
  }

  const handleSwitchTab = (tab: 'salary' | 'epfo') => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'epfo') {
      params.set('tab', 'epfo')
    } else {
      params.delete('tab')
    }
    const q = params.toString()
    router.replace(`${pathname}${q ? `?${q}` : ''}`)
  }

  const handleEdit = (s: any) => {
    setSaveSuccess(false)
    setEditingStaff(s)
    setEditForm({
      payGroup: s.payrollInfo?.payGroup || 'BANK_EPF',
      monthlyCtc: s.payrollInfo?.monthlyCtc || 0,
      bankAccount: s.payrollInfo?.bankAccount || '',
      ifsc: s.payrollInfo?.ifsc || '',
      uan: s.payrollInfo?.uan || '',
      nameOnUan: s.payrollInfo?.nameOnUan || '',
      pan: s.payrollInfo?.pan || '',
      aadhaar: s.payrollInfo?.aadhaar || '',
      nameAsPerBank: s.payrollInfo?.nameAsPerBank || '',
      isHigherPensionOpted: !!s.payrollInfo?.isHigherPensionOpted,
      isActiveForPayroll: s.payrollInfo?.isActiveForPayroll !== false,
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/payroll/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: editingStaff.id,
          payrollInfo: editForm,
        }),
      })
      await fetchStaff()
      await fetchEpfoPendingCount()
      setEpfoRefreshTrigger((k) => k + 1)
      setSaveSuccess(true)
      setTimeout(() => {
        setEditingStaff(null)
      }, 800)
    } catch (error) {
      console.error('Failed to save payroll info:', error)
      alert('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenFixProfile = async (
    staffId: string,
    initialTab: 'statutory' | 'kyc',
    missingFields: string[]
  ) => {
    let target = fullStaffList.find((s) => s.id === staffId)
    if (!target) {
      try {
        const res = await fetch('/api/staff')
        if (res.ok) {
          const list = await res.json()
          setFullStaffList(list)
          target = list.find((s: any) => s.id === staffId)
        }
      } catch {
        // Ignored
      }
    }

    if (!target) {
      // Fallback from staff array
      const s = staff.find((x) => x.id === staffId)
      if (s) {
        target = {
          ...s,
          payrollInfo: s.payrollInfo || {},
          employmentPeriods: s.employmentPeriods || [],
        }
      }
    }

    if (target) {
      setFixStaff(target)
      setFixInitialTab(initialTab)
      setFixHighlightedFields(missingFields)
      setFixModalOpen(true)
    }
  }

  const counts = useMemo(() => {
    let bank = 0
    let cash = 0
    for (const s of staff) {
      if (s.payrollInfo?.payGroup === 'CASH') cash++
      else bank++
    }
    return { all: staff.length, bank, cash }
  }, [staff])

  const filteredStaff = staff.filter((s) => {
    const pg = s.payrollInfo?.payGroup === 'CASH' ? 'CASH' : 'BANK_EPF'
    if (groupFilter !== 'ALL' && pg !== groupFilter) return false
    return (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.machineId?.toLowerCase().includes(search.toLowerCase()) ||
      s.employeeCode?.toLowerCase().includes(search.toLowerCase()) ||
      s.payrollInfo?.uan?.includes(search)
    )
  })

  const isCashEdit = editForm.payGroup === 'CASH'
  const estGross = isCashEdit
    ? Math.round(editForm.monthlyCtc || 0)
    : Math.round((editForm.monthlyCtc || 0) / 1.12)
  const empPf = isCashEdit ? 0 : Math.round(estGross * 0.12)
  const estNet = estGross - empPf

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Salary & Compliance Setup"
        subtitle="Configure pay group (Bank/EPF or Cash), monthly CTC, and manage EPFO statutory compliance lifecycle"
      />

      {/* Top Dual Tabs */}
      <div className="flex items-center gap-2 border-b border-line-soft pb-2">
        <button
          type="button"
          onClick={() => handleSwitchTab('salary')}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-xl transition-colors',
            activeMainTab === 'salary'
              ? 'bg-accent/15 text-accent font-semibold shadow-xs'
              : 'text-muted hover:text-text hover:bg-canvas'
          )}
        >
          Salary &amp; Pay Groups
        </button>

        <button
          type="button"
          onClick={() => handleSwitchTab('epfo')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors',
            activeMainTab === 'epfo'
              ? 'bg-accent/15 text-accent font-semibold shadow-xs'
              : 'text-muted hover:text-text hover:bg-canvas'
          )}
        >
          <span>EPFO Members</span>
          {epfoPendingCount > 0 && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
              {epfoPendingCount} pending
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: Salary & Pay Groups */}
      {activeMainTab === 'salary' && (
        <Card className="overflow-hidden !p-0">
          <div className="flex flex-col gap-3 border-b border-line-soft px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <ChipGroup label="Filter by pay group">
              <Chip
                pressed={groupFilter === 'ALL'}
                onClick={() => setGroupFilter('ALL')}
                count={counts.all}
              >
                All Staff
              </Chip>
              <Chip
                pressed={groupFilter === 'BANK_EPF'}
                onClick={() => setGroupFilter('BANK_EPF')}
                dot="accent"
                count={counts.bank}
              >
                Bank / EPF
              </Chip>
              <Chip
                pressed={groupFilter === 'CASH'}
                onClick={() => setGroupFilter('CASH')}
                dot="present"
                count={counts.cash}
              >
                Cash Payroll
              </Chip>
            </ChipGroup>

            <div className="relative w-full lg:max-w-xs">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
                aria-hidden="true"
              />
              <Input
                type="text"
                aria-label="Search staff"
                placeholder="Search name, SAR-ID, UAN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="table-wrap hidden md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th>Pay Group</th>
                  <th className="text-right">Monthly Pay / CTC (₹)</th>
                  <th>Bank Details / Mode</th>
                  <th>UAN</th>
                  <th>Status</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <>
                    {[...Array(5)].map((_, i) => (
                      <tr key={i}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Skeleton className="size-[38px] rounded-xl" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </td>
                        <td><Skeleton className="h-5 w-20" /></td>
                        <td><Skeleton className="ml-auto h-4 w-20" /></td>
                        <td><Skeleton className="h-4 w-28" /></td>
                        <td><Skeleton className="h-4 w-24" /></td>
                        <td><Skeleton className="h-6 w-20 rounded-full" /></td>
                        <td><Skeleton className="mx-auto size-8 rounded-full" /></td>
                      </tr>
                    ))}
                  </>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-subtle">
                      <EmptyState
                        icon={Users}
                        title="No staff members found"
                        hint="Try adjusting your filters or search terms."
                      />
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => {
                    const isBank = (s.payrollInfo?.payGroup || 'BANK_EPF') === 'BANK_EPF'
                    const hasBank = !!s.payrollInfo?.bankAccount
                    const hasUan = !!s.payrollInfo?.uan

                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar
                              src={staffPhotoUrl(s)}
                              name={s.name}
                              size={28}
                            />
                            <div>
                              <div className="font-medium text-text">{s.name}</div>
                              <div className="num text-xs text-subtle">
                                {s.employeeCode || `ID #${s.machineId}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          {isBank ? (
                            <span className="tint-badge tone-accent">Bank / EPF</span>
                          ) : (
                            <span className="tint-badge tone-present">Cash</span>
                          )}
                        </td>

                        <td className="text-right">
                          <div className="num font-semibold text-text">
                            {formatINR(s.payrollInfo?.monthlyCtc || 0)}
                          </div>
                          {isBank && (
                            <div className="text-[11px] text-subtle">
                              Est. Basic: {formatINR(Math.round((s.payrollInfo?.monthlyCtc || 0) / 1.12))}
                            </div>
                          )}
                        </td>

                        <td>
                          {isBank ? (
                            hasBank ? (
                              <div>
                                <div className="num text-xs font-medium text-text">
                                  •••• {s.payrollInfo.bankAccount.slice(-4)}
                                </div>
                                <div className="num text-[11px] text-subtle">
                                  {s.payrollInfo.ifsc}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-absent flex items-center gap-1">
                                <AlertCircle size={12} /> Missing bank info
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-subtle">Cash Envelope</span>
                          )}
                        </td>

                        <td>
                          {isBank ? (
                            hasUan ? (
                              <span className="num text-xs text-text">{s.payrollInfo.uan}</span>
                            ) : (
                              <span className="text-xs text-absent flex items-center gap-1">
                                <AlertCircle size={12} /> Pending UAN
                              </span>
                            )
                          ) : (
                            <span className="text-xs text-subtle">—</span>
                          )}
                        </td>

                        <td>
                          {s.payrollInfo?.isActiveForPayroll !== false ? (
                            <span className="tint-badge tone-present">Active</span>
                          ) : (
                            <span className="tint-badge tone-absent">Suspended</span>
                          )}
                        </td>

                        <td className="text-center">
                          <IconButton
                            icon={Edit2}
                            label={`Edit salary settings for ${s.name}`}
                            onClick={() => handleEdit(s)}
                          />
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="flex flex-col gap-3 p-4 md:hidden">
            {loading ? (
              <>
                <Skeleton className="h-36 rounded-xl" />
                <Skeleton className="h-36 rounded-xl" />
              </>
            ) : filteredStaff.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No staff members found"
                hint="Try adjusting your filters or search terms."
              />
            ) : (
              filteredStaff.map((s) => (
                <div key={s.id} className="flex flex-col gap-4 rounded-xl border border-line bg-canvas p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={s.name} src={staffPhotoUrl(s)} />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium leading-tight text-text">{s.name}</span>
                        <span className="text-[13px] text-subtle">
                          {s.employeeCode ? `${s.employeeCode} · ` : ''}{s.department?.name || 'No Dept'}
                        </span>
                      </div>
                    </div>
                    {s.payrollInfo?.isActiveForPayroll !== false ? (
                      <span className="tone-present tint-badge inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                        <CheckCircle2 size={13} aria-hidden="true" />
                        Active
                      </span>
                    ) : (
                      <span className="tone-absent tint-badge inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                        <XCircle size={13} aria-hidden="true" />
                        Excluded
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-line-soft bg-ground p-3">
                      <span className="mb-1 block text-[11px] text-subtle">Monthly Pay / CTC</span>
                      <span className="num font-medium text-text">{formatINR(s.payrollInfo?.monthlyCtc || 0, { exact: true })}</span>
                      <span className="mt-0.5 block text-[11px] text-subtle">
                        Annual: <span className="num">{formatINR((s.payrollInfo?.monthlyCtc || 0) * 12, { exact: true })}</span>
                      </span>
                    </div>
                    <div className="rounded-lg border border-line-soft bg-ground p-3">
                      <span className="mb-1 block text-[11px] text-subtle">Pay Group</span>
                      <span className="block truncate text-sm text-muted">
                        {s.payrollInfo?.payGroup === 'CASH' ? 'Cash (No PF)' : s.payrollInfo?.bankAccount || 'Bank / EPF'}
                      </span>
                      <span className="num block text-[11px] text-subtle">{s.payrollInfo?.ifsc || ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-line-soft pt-3">
                    <div className="flex flex-col">
                      <span className="mb-1 text-[11px] text-subtle">UAN</span>
                      <span className="num text-sm text-muted">{s.payrollInfo?.uan || 'Not Set'}</span>
                    </div>
                    <IconButton icon={Edit2} label={`Edit salary settings for ${s.name}`} onClick={() => handleEdit(s)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 2: EPFO Compliance Hub */}
      {activeMainTab === 'epfo' && (
        <EpfoMembersTab
          onFixMember={handleOpenFixProfile}
          refreshTrigger={epfoRefreshTrigger}
          onCountsUpdated={(c) => {
            const pending =
              (c.NEEDS_REGISTRATION || 0) +
              (c.AWAITING_UAN || 0) +
              (c.NEEDS_EXIT || 0) +
              (c.NEEDS_KYC || 0)
            setEpfoPendingCount(pending)
          }}
        />
      )}

      {/* In-Place Staff Profile Modal for Missing Statutory Data */}
      {fixStaff && (
        <StaffProfileModal
          staff={fixStaff}
          open={fixModalOpen}
          onClose={() => {
            setFixModalOpen(false)
            setFixStaff(null)
          }}
          onSaved={() => {
            fetchStaff()
            fetchEpfoPendingCount()
            fetchMeta()
            setEpfoRefreshTrigger((k) => k + 1)
          }}
          onDeleted={() => {
            setFixModalOpen(false)
            setFixStaff(null)
            fetchStaff()
            fetchEpfoPendingCount()
            setEpfoRefreshTrigger((k) => k + 1)
          }}
          depts={depts}
          desigs={desigs}
          shifts={shifts}
          initialTab={fixInitialTab}
          highlightedFields={fixHighlightedFields}
        />
      )}

      {/* Salary Table Edit Modal */}
      <Modal
        open={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        title={editingStaff ? `Salary & Bank Setup — ${editingStaff.name}` : 'Salary Setup'}
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-subtle">SAR-ID: {editingStaff?.employeeCode || '—'}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setEditingStaff(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={saveSuccess ? CheckCircle2 : Save}
                onClick={handleSave}
                loading={saving}
              >
                {saveSuccess ? 'Saved!' : 'Save changes'}
              </Button>
            </div>
          </div>
        }
      >
        {editingStaff && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 rounded-xl border border-line-soft bg-canvas p-3">
              <Avatar
                src={staffPhotoUrl(editingStaff)}
                name={editingStaff.name}
                size={38}
              />
              <div>
                <p className="text-sm font-semibold text-text">{editingStaff.name}</p>
                <p className="num text-xs text-subtle">
                  Machine #{editingStaff.machineId} · Joined {editingStaff.joiningDate?.slice(0, 10) || '—'}
                </p>
              </div>
            </div>

            <section className="space-y-3">
              <SectionLabel>Pay group &amp; Monthly compensation</SectionLabel>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Pay Group" htmlFor="payroll-paygroup">
                  <Select
                    id="payroll-paygroup"
                    value={editForm.payGroup}
                    onChange={(e) => setEditForm({ ...editForm, payGroup: e.target.value })}
                  >
                    <option value="BANK_EPF">Bank / EPF (Provident Fund Deductions)</option>
                    <option value="CASH">Cash Payroll (No Statutory Deductions)</option>
                  </Select>
                </Field>

                <Field label="Monthly CTC / Compensation (₹)" htmlFor="payroll-ctc">
                  <Input
                    id="payroll-ctc"
                    type="number"
                    value={editForm.monthlyCtc}
                    onChange={(e) =>
                      setEditForm({ ...editForm, monthlyCtc: parseFloat(e.target.value) || 0 })
                    }
                    className="num font-semibold"
                  />
                </Field>
              </div>

              {!isCashEdit && (
                <Field
                  label="EPS Contribution Scheme"
                  htmlFor="payroll-higher-pension"
                  helper="Standard: 8.33% capped at statutory ceiling (0% surcharge). Higher: uncapped + 1.16% surcharge on excess."
                >
                  <Select
                    id="payroll-higher-pension"
                    value={editForm.isHigherPensionOpted ? 'YES' : 'NO'}
                    onChange={(e) => setEditForm({ ...editForm, isHigherPensionOpted: e.target.value === 'YES' })}
                  >
                    <option value="NO">Standard Member (Capped at statutory ceiling, 0% surcharge)</option>
                    <option value="YES">Higher Pension Optee (POHW, 1.16% surcharge)</option>
                  </Select>
                </Field>
              )}

              <button
                type="button"
                role="switch"
                aria-checked={!!editForm.isActiveForPayroll}
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-ground p-3.5 text-left transition-colors duration-150 hover:border-subtle"
                onClick={() => setEditForm({ ...editForm, isActiveForPayroll: !editForm.isActiveForPayroll })}
              >
                <span
                  className={cn(
                    'grid size-5 flex-none place-items-center rounded transition-colors duration-150',
                    editForm.isActiveForPayroll
                      ? 'bg-acc-1 text-ground'
                      : 'border border-line bg-card-hi text-transparent'
                  )}
                >
                  <CheckCircle2 size={13} aria-hidden="true" />
                </span>
                <span className="flex flex-col">
                  <span className="text-xs font-medium text-text">Active for Payroll</span>
                  <span className="text-[11px] text-subtle">Include this staff in monthly generation</span>
                </span>
              </button>

              <div className="rounded-xl border border-line-soft bg-canvas p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between text-subtle">
                  <span>Calculated Basic Wage (1.12x divisor):</span>
                  <span className="num font-medium text-text">{formatINR(estGross)}</span>
                </div>
                {!isCashEdit && (
                  <>
                    <div className="flex justify-between text-subtle">
                      <span>Employee EPF (12% of Basic):</span>
                      <span className="num font-medium text-absent">-{formatINR(empPf)}</span>
                    </div>
                    <div className="flex justify-between text-subtle">
                      <span>Employer Share (12% of Basic):</span>
                      <span className="num font-medium text-subtle">{formatINR(empPf)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between border-t border-line-soft pt-1 font-semibold text-text">
                  <span>Estimated Net Take-home:</span>
                  <span className="num font-bold text-accent">{formatINR(estNet)}</span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <SectionLabel>Bank &amp; EPFO Identifiers</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Bank Account Number" htmlFor="payroll-account">
                  <Input
                    id="payroll-account"
                    type="text"
                    value={editForm.bankAccount}
                    onChange={(e) => setEditForm({ ...editForm, bankAccount: e.target.value })}
                    className="num"
                  />
                </Field>
                <Field label="IFSC Code" htmlFor="payroll-ifsc">
                  <Input
                    id="payroll-ifsc"
                    type="text"
                    value={editForm.ifsc}
                    onChange={(e) => setEditForm({ ...editForm, ifsc: e.target.value.toUpperCase() })}
                    className="num uppercase"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Name as per Bank" htmlFor="payroll-name-bank">
                    <Input
                      id="payroll-name-bank"
                      type="text"
                      value={editForm.nameAsPerBank}
                      onChange={(e) => setEditForm({ ...editForm, nameAsPerBank: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="UAN (EPFO)" htmlFor="payroll-uan">
                  <Input
                    id="payroll-uan"
                    type="text"
                    value={editForm.uan}
                    onChange={(e) => setEditForm({ ...editForm, uan: e.target.value })}
                    className="num"
                  />
                </Field>
                <Field label="Name on UAN" htmlFor="payroll-name-uan">
                  <Input
                    id="payroll-name-uan"
                    type="text"
                    value={editForm.nameOnUan}
                    onChange={(e) => setEditForm({ ...editForm, nameOnUan: e.target.value })}
                  />
                </Field>
                <Field label="PAN Number" htmlFor="payroll-pan">
                  <Input
                    id="payroll-pan"
                    type="text"
                    value={editForm.pan}
                    onChange={(e) => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })}
                    className="num uppercase"
                  />
                </Field>
                <Field label="Aadhaar" htmlFor="payroll-aadhaar">
                  <Input
                    id="payroll-aadhaar"
                    type="text"
                    value={editForm.aadhaar}
                    onChange={(e) => setEditForm({ ...editForm, aadhaar: e.target.value })}
                    className="num"
                  />
                </Field>
              </div>
            </section>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default function StaffPayrollPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-subtle">Loading payroll setup...</div>}>
      <StaffPayrollContent />
    </Suspense>
  )
}
