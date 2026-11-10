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

  // EPFO summary counts
  const [epfoPendingCount, setEpfoPendingCount] = useState(0)

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
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-subtle">
                      Loading staff records...
                    </td>
                  </tr>
                ) : filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-subtle">
                      <EmptyState
                        title="No staff members found"
                        description="Try adjusting your filters or search terms."
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
                              src={staffPhotoUrl(s.id, s.hasPhoto, s.profilePhotoId)}
                              name={s.name}
                              size="sm"
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
        </Card>
      )}

      {/* TAB 2: EPFO Compliance Hub */}
      {activeMainTab === 'epfo' && (
        <EpfoMembersTab
          onFixMember={handleOpenFixProfile}
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
          }}
          onDeleted={() => {
            setFixModalOpen(false)
            setFixStaff(null)
            fetchStaff()
            fetchEpfoPendingCount()
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
                src={staffPhotoUrl(editingStaff.id, editingStaff.hasPhoto, editingStaff.profilePhotoId)}
                name={editingStaff.name}
                size="md"
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

              <div className="rounded-xl border border-line-soft bg-canvas p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between text-subtle">
                  <span>Calculated Basic Wage (1.12x divisor):</span>
                  <span className="num font-medium text-text">{formatINR(estGross)}</span>
                </div>
                {!isCashEdit && (
                  <div className="flex justify-between text-subtle">
                    <span>Employee EPF (12% of Basic):</span>
                    <span className="num font-medium text-absent">-{formatINR(empPf)}</span>
                  </div>
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
