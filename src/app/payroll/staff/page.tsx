'use client'

import { useState, useEffect, useMemo } from 'react'
import { Wallet, Search, Edit2, Save, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { Avatar, Button, Card, Chip, ChipGroup, EmptyState, Field, IconButton, Input, Modal, PageHeader, SectionLabel, Select, Skeleton } from '@/components/ui'
import { formatINR } from '@/lib/format'
import { cn } from '@/lib/cn'
import { staffPhotoUrl } from '@/lib/photo-url'

type PayGroupFilter = 'ALL' | 'BANK_EPF' | 'CASH'

export default function StaffPayrollPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<PayGroupFilter>('ALL')
  const [editingStaff, setEditingStaff] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    fetchStaff()
  }, [])

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
      isActiveForPayroll: s.payrollInfo?.isActiveForPayroll !== false
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
          payrollInfo: editForm
        })
      })
      await fetchStaff()
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

  const counts = useMemo(() => {
    let bank = 0
    let cash = 0
    for (const s of staff) {
      if (s.payrollInfo?.payGroup === 'CASH') cash++
      else bank++
    }
    return { all: staff.length, bank, cash }
  }, [staff])

  const filteredStaff = staff.filter(s => {
    const pg = s.payrollInfo?.payGroup === 'CASH' ? 'CASH' : 'BANK_EPF'
    if (groupFilter !== 'ALL' && pg !== groupFilter) return false
    return (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.machineId?.toLowerCase().includes(search.toLowerCase()) ||
      s.employeeCode?.toLowerCase().includes(search.toLowerCase()) ||
      s.payrollInfo?.uan?.includes(search)
    )
  })

  const isCashEdit = editForm.payGroup === 'CASH';
  const estGross = isCashEdit ? Math.round(editForm.monthlyCtc || 0) : Math.round((editForm.monthlyCtc || 0) / 1.12);
  const empPf = isCashEdit ? 0 : Math.round(estGross * 0.12);
  const estNet = estGross - empPf;

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader title="Salary setup" subtitle="Configure pay group (Bank/EPF or Cash), monthly salary/CTC, and statutory banking details" />

      {/* Main Content Area */}
      <Card className="overflow-hidden !p-0">
        <div className="flex flex-col gap-3 border-b border-line-soft px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <ChipGroup label="Filter by pay group">
            <Chip pressed={groupFilter === 'ALL'} onClick={() => setGroupFilter('ALL')} count={counts.all}>
              All Staff
            </Chip>
            <Chip pressed={groupFilter === 'BANK_EPF'} onClick={() => setGroupFilter('BANK_EPF')} dot="accent" count={counts.bank}>
              Bank / EPF
            </Chip>
            <Chip pressed={groupFilter === 'CASH'} onClick={() => setGroupFilter('CASH')} dot="present" count={counts.cash}>
              Cash Payroll
            </Chip>
          </ChipGroup>

          <div className="relative w-full lg:max-w-xs">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
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
                  <td colSpan={7} className="whitespace-normal">
                    <EmptyState icon={AlertCircle} title="No matching staff found in directory." />
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => {
                  const isCash = s.payrollInfo?.payGroup === 'CASH'
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} src={staffPhotoUrl(s)} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-text">{s.name}</span>
                              {s.employeeCode && (
                                <span className="num rounded border border-line bg-card-hi px-1.5 py-0.5 text-[11px] text-acc-1">
                                  {s.employeeCode}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-subtle">
                              {s.department?.name || 'No Dept'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            isCash
                              ? 'tint-badge tone-present inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium'
                              : 'tint-badge tone-accent inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium'
                          }
                        >
                          {isCash ? 'Cash (No PF)' : 'Bank / EPF'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="num font-medium text-text">
                          {formatINR(s.payrollInfo?.monthlyCtc || 0, { exact: true })}
                        </div>
                        <div className="mt-0.5 text-[11px] text-subtle">
                          Annual: <span className="num">{formatINR((s.payrollInfo?.monthlyCtc || 0) * 12, { exact: true })}</span>
                        </div>
                      </td>
                      <td>
                        {isCash ? (
                          <span className="inline-flex rounded-md border border-line-soft bg-canvas px-2 py-0.5 text-xs text-muted">
                            Paid in cash
                          </span>
                        ) : (
                          <>
                            <div className="num text-muted">
                              {s.payrollInfo?.bankAccount || 'Not Set'}
                            </div>
                            <div className="mt-0.5 flex flex-col gap-0.5">
                              <span className="num text-xs text-subtle">{s.payrollInfo?.ifsc || 'No IFSC'}</span>
                              {s.payrollInfo?.nameAsPerBank && (
                                <span className="w-fit rounded bg-card-hi px-1.5 py-0.5 text-[11px] text-muted">
                                  {s.payrollInfo.nameAsPerBank}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                      <td>
                        {isCash ? (
                          <span className="text-xs text-subtle">Exempt (Cash)</span>
                        ) : (
                          <>
                            <div className="num text-muted">
                              {s.payrollInfo?.uan || 'Not Set'}
                            </div>
                            {s.payrollInfo?.nameOnUan && (
                              <div className="mt-1 w-fit rounded bg-card-hi px-1.5 py-0.5 text-[11px] text-muted">
                                {s.payrollInfo.nameOnUan}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        {s.payrollInfo?.isActiveForPayroll !== false ? (
                          <span className="tone-present tint-badge inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                            <CheckCircle2 size={13} aria-hidden="true" />
                            Active
                          </span>
                        ) : (
                          <span className="tone-absent tint-badge inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                            <XCircle size={13} aria-hidden="true" />
                            Excluded
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <IconButton
                          icon={Edit2}
                          label="Edit Payroll Details"
                          onClick={() => handleEdit(s)}
                          className="mx-auto size-8"
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
            <EmptyState icon={AlertCircle} title="No Staff Found" hint="No matching staff found in directory." />
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
                    <span className="mt-0.5 block text-[11px] text-subtle">Annual: <span className="num">{formatINR((s.payrollInfo?.monthlyCtc || 0) * 12, { exact: true })}</span></span>
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
                  <IconButton icon={Edit2} label="Edit Payroll Details" onClick={() => handleEdit(s)} />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        open={!!editingStaff}
        onClose={() => setEditingStaff(null)}
        title="Edit configuration"
        footer={
          <>
            {saveSuccess && (
              <span className="mr-auto flex items-center gap-1.5 text-sm text-present">
                <CheckCircle2 size={16} aria-hidden="true" />
                Saved Successfully
              </span>
            )}
            <Button
              variant="secondary"
              onClick={() => setEditingStaff(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || saveSuccess}
              loading={saving}
              icon={saveSuccess ? CheckCircle2 : Save}
              className={saveSuccess ? 'bg-present text-ground hover:bg-present' : undefined}
            >
              {saving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Configuration'}
            </Button>
          </>
        }
      >
        {editingStaff && (
          <div className="space-y-6">
            <p className="text-[13px] text-subtle">
              Updating details for <span className="font-medium text-text">{editingStaff.name}</span>
              {editingStaff.employeeCode ? ` (${editingStaff.employeeCode})` : ''}
            </p>

            {/* Financial Section */}
            <section className="space-y-4">
              <SectionLabel>Financial Basics</SectionLabel>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Pay Group" htmlFor="payroll-pay-group">
                  <Select
                    id="payroll-pay-group"
                    value={editForm.payGroup || 'BANK_EPF'}
                    onChange={(e) => setEditForm({ ...editForm, payGroup: e.target.value })}
                  >
                    <option value="BANK_EPF">Bank / EPF Payroll</option>
                    <option value="CASH">Cash Payroll (No EPF)</option>
                  </Select>
                </Field>

                <Field
                  label={isCashEdit ? 'Monthly Cash Salary (₹)' : 'Fixed Monthly CTC (₹)'}
                  htmlFor="payroll-monthly-ctc"
                >
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle" aria-hidden="true">₹</span>
                    <Input
                      id="payroll-monthly-ctc"
                      type="number"
                      value={editForm.monthlyCtc === 0 ? '' : editForm.monthlyCtc}
                      onChange={(e) => setEditForm({...editForm, monthlyCtc: e.target.value === '' ? '' : parseFloat(e.target.value) || 0})}
                      className="num pl-8"
                    />
                  </div>
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
                onClick={() => setEditForm({...editForm, isActiveForPayroll: !editForm.isActiveForPayroll})}
              >
                <span className={cn(
                  'grid size-5 flex-none place-items-center rounded transition-colors duration-150',
                  editForm.isActiveForPayroll ? 'bg-acc-2 text-text' : 'border border-line bg-card-hi'
                )}>
                  {editForm.isActiveForPayroll && <CheckCircle2 size={14} aria-hidden="true" />}
                </span>
                <span className="flex-1">
                  <span className="block text-sm text-text">Active for Payroll</span>
                  <span className="block text-xs text-subtle">Include this staff in monthly generation</span>
                </span>
              </button>

              {/* Dynamic Preview Receipt */}
              <div className="rounded-xl border border-line-soft bg-ground p-4">
                <p className="mb-3 flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.09em] text-acc-1">
                  <Wallet size={12} aria-hidden="true" />
                  31-Day Estimate ({isCashEdit ? 'Cash Payroll' : 'Bank / EPF'})
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-muted">
                    <span>Gross Wage</span>
                    <span className="num text-text">{formatINR(estGross)}</span>
                  </div>
                  {!isCashEdit && (
                    <>
                      <div className="flex items-center justify-between text-muted">
                        <span>Employee PF <span className="text-[11px] text-subtle">(12%)</span></span>
                        <span className="num text-absent">-{formatINR(empPf)}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted">
                        <span>Employer Share <span className="text-[11px] text-subtle">(12%)</span></span>
                        <span className="num text-subtle">{formatINR(empPf)}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-dashed border-line pt-3">
                  <span className="text-sm text-muted">Net Payment</span>
                  <span className="num text-2xl font-medium text-present">{formatINR(estNet)}</span>
                </div>
              </div>
            </section>

            {/* Bank & Statutory Section */}
            <section className="space-y-4">
              <SectionLabel>Bank & Statutory</SectionLabel>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Bank Account" htmlFor="payroll-bank-account">
                  <Input
                    id="payroll-bank-account"
                    type="text"
                    value={editForm.bankAccount}
                    onChange={(e) => setEditForm({...editForm, bankAccount: e.target.value})}
                    className="num"
                  />
                </Field>
                <Field label="IFSC Code" htmlFor="payroll-ifsc">
                  <Input
                    id="payroll-ifsc"
                    type="text"
                    value={editForm.ifsc}
                    onChange={(e) => setEditForm({...editForm, ifsc: e.target.value.toUpperCase()})}
                    className="num uppercase"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Name as per Bank" htmlFor="payroll-name-bank">
                    <Input
                      id="payroll-name-bank"
                      type="text"
                      value={editForm.nameAsPerBank}
                      onChange={(e) => setEditForm({...editForm, nameAsPerBank: e.target.value})}
                    />
                  </Field>
                </div>
                <Field label="UAN (EPFO)" htmlFor="payroll-uan">
                  <Input
                    id="payroll-uan"
                    type="text"
                    value={editForm.uan}
                    onChange={(e) => setEditForm({...editForm, uan: e.target.value})}
                    className="num"
                  />
                </Field>
                <Field label="Name on UAN" htmlFor="payroll-name-uan">
                  <Input
                    id="payroll-name-uan"
                    type="text"
                    value={editForm.nameOnUan}
                    onChange={(e) => setEditForm({...editForm, nameOnUan: e.target.value})}
                  />
                </Field>
                <Field label="PAN Number" htmlFor="payroll-pan">
                  <Input
                    id="payroll-pan"
                    type="text"
                    value={editForm.pan}
                    onChange={(e) => setEditForm({...editForm, pan: e.target.value.toUpperCase()})}
                    className="num uppercase"
                  />
                </Field>
                <Field label="Aadhaar" htmlFor="payroll-aadhaar">
                  <Input
                    id="payroll-aadhaar"
                    type="text"
                    value={editForm.aadhaar}
                    onChange={(e) => setEditForm({...editForm, aadhaar: e.target.value})}
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
