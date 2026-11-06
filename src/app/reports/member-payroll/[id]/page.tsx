'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, FileText, Calendar as CalendarIcon, Wallet, AlertTriangle, ExternalLink, Loader2, PencilLine } from 'lucide-react'
import { Button, Card, CardHeader, EmptyState, IconButton, PageHeader, SectionLabel, StatusBadge } from '@/components/ui'
import { cn } from '@/lib/cn'

type PayrollDetail = {
  payroll: any;
  systemPresentDays: number;
}

export default function PayrollDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PayrollDetail | null>(null)
  
  useEffect(() => {
    if (!id) return
    
    const fetchPayroll = async () => {
      try {
        const res = await fetch(`/api/payroll/${id}`)
        if (res.ok) {
          setData(await res.json())
        }
      } catch (e) {
        console.error('Failed to fetch payroll details:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchPayroll()
  }, [id])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Loading payroll details...
      </div>
    )
  }

  if (!data || !data.payroll) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2">
        <EmptyState icon={FileText} title="Payroll Record Not Found" />
        <Button variant="secondary" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  const { payroll, systemPresentDays } = data
  const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('default', { month: 'long' })
  const isMismatch = systemPresentDays !== payroll.presentDays

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <IconButton
          icon={ArrowLeft}
          label="Back to member payroll"
          onClick={() => router.push('/reports/member-payroll')}
          className="flex-none"
        />
        <div className="min-w-0 flex-1">
          <PageHeader
            title="Payroll details"
            subtitle={<>{monthName} <span className="num">{payroll.year}</span> • {payroll.staff.name}</>}
            actions={payroll.isLocked ? (
              <StatusBadge status="locked" />
            ) : (
              <span className="tone-late tint-badge inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                <PencilLine size={13} aria-hidden="true" />
                Draft
              </span>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Left Column: Days & Attendance */}
        <div className="space-y-4 lg:col-span-1">
          <Card>
            <CardHeader title="Attendance Summary" />

            {isMismatch && (
              <div className="tone-absent tint-badge mb-4 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={18} className="mt-0.5 flex-none" aria-hidden="true" />
                  <div>
                    <h4 className="text-sm font-medium">Manual Override Detected</h4>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      The paid days in this payroll do not match the system&apos;s recorded present days from the machine punches.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className={cn('rounded-xl border p-4', isMismatch ? 'border-absent/30 bg-ground' : 'border-line-soft bg-ground')}>
                <p className="mb-1 text-[12.5px] text-muted">System Present Days</p>
                <div className="flex items-end gap-2">
                  <span className={cn('num text-3xl font-medium', isMismatch ? 'text-absent' : 'text-text')}>{systemPresentDays}</span>
                  <span className="num mb-1 text-subtle">/ {payroll.totalDays}</span>
                </div>
                <p className="mt-1 text-[11px] text-subtle">Calculated directly from punches</p>
              </div>

              <div className={cn('rounded-xl border p-4', isMismatch ? 'border-present/40 bg-ground' : 'border-present/20 bg-ground')}>
                <p className="mb-1 text-[12.5px] text-muted">Paid Present Days</p>
                <div className="flex items-end gap-2">
                  <span className="num text-3xl font-medium text-present">{payroll.presentDays}</span>
                  <span className="num mb-1 text-subtle">/ {payroll.totalDays}</span>
                </div>
                <p className="mt-1 text-[11px] text-subtle">Used for payroll generation</p>
              </div>
            </div>

            <Button
              variant="secondary"
              icon={CalendarIcon}
              onClick={() => router.push(`/reports/member-attendance?staffId=${payroll.staffId}&month=${payroll.year}-${String(payroll.month).padStart(2, '0')}`)}
              className="mt-4 w-full"
            >
              View Daily Logs <ExternalLink size={12} aria-hidden="true" />
            </Button>
          </Card>

          <Card>
            <CardHeader title="Staff Information" />
            <div className="space-y-4">
              <div>
                <p className="text-[12px] text-subtle">Employee ID / Machine ID</p>
                <p className="num mt-0.5 text-sm text-text">{payroll.staff.machineId}</p>
              </div>
              <div>
                <p className="text-[12px] text-subtle">Department</p>
                <p className="mt-0.5 text-sm text-text">{payroll.staff.department?.name || '-'}</p>
              </div>
              <div>
                <p className="text-[12px] text-subtle">Designation</p>
                <p className="mt-0.5 text-sm text-text">{payroll.staff.designation?.name || '-'}</p>
              </div>
              <div className="border-t border-line-soft pt-3">
                <p className="text-[12px] text-subtle">Bank Account</p>
                <p className="num mt-0.5 break-all text-sm text-text">{payroll.staff.payrollInfo?.bankAccount || 'Not provided'}</p>
                <p className="mt-0.5 text-[12px] text-subtle">IFSC: <span className="num">{payroll.staff.payrollInfo?.ifsc || 'N/A'}</span></p>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Financial Breakdown */}
        <div className="lg:col-span-2">
          <Card className="sm:px-6 sm:py-6">
            <h3 className="mb-5 flex items-center gap-2.5 border-b border-line-soft pb-4 text-[15px] font-medium text-text">
              <Wallet size={18} className="text-acc-1" aria-hidden="true" /> Financial Breakdown
            </h3>

            <div className="space-y-6">

              {/* Earnings */}
              <div className="space-y-3">
                <SectionLabel>Earnings</SectionLabel>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-ground p-3">
                    <span className="text-sm text-muted">Basic Wage (Prorated)</span>
                    <span className="num text-sm font-medium text-text">{formatCurrency(payroll.basicWage)}</span>
                  </div>
                  {payroll.bonusAmount > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-late/30 bg-ground p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-late">Performance / Festival Bonus</span>
                        {payroll.bonusDays > 0 && (
                          <span className="tone-late tint-pill rounded px-1.5 py-0.5 text-[11px]">
                            <span className="num">{payroll.bonusDays}</span> {payroll.bonusDays === 1 ? 'day' : 'days'}
                          </span>
                        )}
                        {payroll.isBonusPfApplicable && (
                          <span className="tone-accent tint-pill rounded px-1.5 py-0.5 text-[11px]">
                            EPF Applicable
                          </span>
                        )}
                      </div>
                      <span className="num text-sm font-medium text-late">+{formatCurrency(payroll.bonusAmount)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-ground p-3">
                    <span className="text-sm text-muted">Total Gross Wage</span>
                    <span className="num text-sm font-medium text-present">{formatCurrency(payroll.grossWage)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-ground p-3">
                    <span className="text-sm text-subtle">Actual Cost To Company (CTC)</span>
                    <span className="num text-sm text-muted">{formatCurrency(payroll.actualCtc)}</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div className="space-y-3">
                <SectionLabel>Deductions</SectionLabel>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-ground p-3">
                    <span className="text-sm text-muted">Employee EPF (12%)</span>
                    <span className="num text-sm font-medium text-absent">-{formatCurrency(payroll.employeeEpf)}</span>
                  </div>
                  {payroll.refundOfAdvance > 0 && (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-line-soft bg-ground p-3">
                      <span className="text-sm text-muted">Advance Recovery</span>
                      <span className="num text-sm font-medium text-absent">-{formatCurrency(payroll.refundOfAdvance)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total Net */}
              <div className="border-t border-line-soft pt-6">
                <div className="tone-present flex flex-wrap items-center justify-between gap-4 rounded-xl border border-present/30 bg-ground p-5">
                  <div>
                    <h4 className="mb-1 text-[12.5px] text-muted">Net Take Home</h4>
                    <p className="text-xs text-subtle">Amount to be transferred to bank</p>
                  </div>
                  <div className="text-right">
                    <span className="num text-3xl font-medium tracking-tight text-present sm:text-4xl">
                      {formatCurrency(payroll.netPayment)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Employer Contributions (Info Only) */}
              <div className="space-y-3 border-t border-line-soft pt-6">
                <h4 className="flex items-center gap-2 text-[12.5px] text-subtle">
                  <FileText size={14} aria-hidden="true" /> Employer Contributions (For Info)
                </h4>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl border border-line-soft bg-ground p-3">
                    <span className="text-xs text-muted">Employer EPF</span>
                    <span className="num text-xs text-text">{formatCurrency(payroll.employerEpf)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-line-soft bg-ground p-3">
                    <span className="text-xs text-muted">Employer EPS</span>
                    <span className="num text-xs text-text">{formatCurrency(payroll.employerEps)}</span>
                  </div>
                </div>
              </div>

            </div>
          </Card>
        </div>

      </div>
    </div>
  )
}
