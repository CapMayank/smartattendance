'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, FileText, Calendar as CalendarIcon, AlertTriangle, Loader2, PencilLine, Printer } from 'lucide-react'
import { Button, EmptyState, IconButton, StatusBadge } from '@/components/ui'
import { IntimeMark } from '@/components/brand/Brand'
import { APP_NAME, APP_TAGLINE, SCHOOL_NAME, SCHOOL_PLACE, SCHOOL_SHORT } from '@/lib/brand'
import { amountInWords } from '@/lib/amount-in-words'
import { formatINR, SCHOOL_TZ } from '@/lib/format'
import { cn } from '@/lib/cn'

type PayrollDetail = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payroll: any
  systemPresentDays: number
}

const money = (n: number) => formatINR(n, { paise: true })

function Meta({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] tracking-[0.06em] text-subtle uppercase">{label}</dt>
      <dd className={cn('mt-1 text-[13.5px] break-words text-text', mono && 'num')}>{children}</dd>
    </div>
  )
}

function Row({ label, note, amount, tone }: { label: string; note?: ReactNode; amount: number; tone?: 'plus' | 'minus' }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-soft py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[13.5px] text-text">{label}</p>
        {note ? <p className="mt-0.5 text-[11.5px] text-subtle">{note}</p> : null}
      </div>
      <span className={cn('num flex-none text-[13.5px]', tone === 'minus' ? 'text-absent' : 'text-text')}>
        {tone === 'minus' && amount > 0 ? '-' : ''}
        {money(amount)}
      </span>
    </div>
  )
}

function TotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-4 rounded-lg bg-card-hi px-3 py-2.5">
      <span className="text-[13px] font-medium text-text">{label}</span>
      <span className="num text-[14px] font-semibold text-text">{money(amount)}</span>
    </div>
  )
}

export default function PayslipPage() {
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
        if (res.ok) setData(await res.json())
      } catch (e) {
        console.error('Failed to fetch payroll details:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchPayroll()
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-muted">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        Loading payslip...
      </div>
    )
  }

  if (!data || !data.payroll) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2">
        <EmptyState icon={FileText} title="Payslip not found" />
        <Button variant="secondary" onClick={() => router.back()}>
          Go Back
        </Button>
      </div>
    )
  }

  const { payroll, systemPresentDays } = data
  const staff = payroll.staff
  const isCash = payroll.payGroup === 'CASH' || staff.payrollInfo?.payGroup === 'CASH'
  const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('en-IN', { month: 'long' })
  const monthKey = `${payroll.year}-${String(payroll.month).padStart(2, '0')}`
  const isMismatch = systemPresentDays !== payroll.presentDays
  const totalDeductions = (isCash ? 0 : payroll.employeeEpf || 0) + (payroll.refundOfAdvance || 0)
  const generatedOn = new Intl.DateTimeFormat('en-GB', { timeZone: SCHOOL_TZ, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date())

  return (
    <div className="mx-auto max-w-[920px] space-y-4">
      {/* Toolbar: screen only */}
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <IconButton
          icon={ArrowLeft}
          label="Back to member payroll"
          onClick={() => router.push('/reports/member-payroll')}
          className="flex-none"
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-text">Payslip</h1>
          <p className="text-[13px] text-muted">
            {monthName} <span className="num">{payroll.year}</span> · {staff.name}
          </p>
        </div>
        {payroll.isLocked ? (
          <StatusBadge status="locked" />
        ) : (
          <span className="tone-late tint-badge inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-xs whitespace-nowrap">
            <PencilLine size={13} aria-hidden="true" />
            Draft
          </span>
        )}
        <Button
          variant="secondary"
          icon={CalendarIcon}
          onClick={() => router.push(`/reports/member-attendance?staffId=${payroll.staffId}&month=${monthKey}`)}
        >
          Daily logs
        </Button>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </div>

      {isMismatch && (
        <div className="tone-absent tint-badge flex items-start gap-2.5 rounded-xl p-3.5 print:hidden">
          <AlertTriangle size={17} className="mt-0.5 flex-none" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-muted">
            <b className="font-medium text-text">Manual override.</b> Paid days (
            <span className="num">{payroll.presentDays}</span>) differ from the <span className="num">{systemPresentDays}</span> days
            recorded from machine punches.
          </p>
        </div>
      )}

      {/* The payslip */}
      <article
        aria-label={`Payslip for ${staff.name}, ${monthName} ${payroll.year}`}
        className="lit overflow-hidden rounded-2xl border border-line bg-card print:rounded-none print:border-line"
      >
        {/* Letterhead */}
        <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-acc-3 via-acc-2 to-acc-1" />
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.12em] text-subtle uppercase">{SCHOOL_SHORT}</p>
            <h2 className="mt-1 text-[17px] leading-snug font-semibold text-text sm:text-[19px]">{SCHOOL_NAME}</h2>
            <p className="mt-0.5 text-[13px] text-muted">{SCHOOL_PLACE}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[11px] tracking-[0.12em] text-subtle uppercase">Payslip</p>
            <p className="mt-1 text-[17px] font-semibold text-text sm:text-[19px]">
              {monthName} <span className="num">{payroll.year}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {payroll.isLocked ? 'Finalised' : 'Draft, not finalised'}
            </p>
          </div>
        </header>

        {/* Employee */}
        <section className="border-b border-line px-6 py-5 sm:px-8">
          <div className="mb-4 min-w-0">
            <p className="truncate text-[15px] font-semibold text-text">{staff.name}</p>
            <p className="truncate text-[13px] text-muted">{staff.designation?.name || 'No designation'}</p>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Meta label="Employee ID" mono>{staff.employeeCode || staff.machineId}</Meta>
            <Meta label="Department">{staff.department?.name || '-'}</Meta>
            {isCash ? (
              <>
                <Meta label="Pay group">Cash Payroll</Meta>
                <Meta label="Payment mode">Paid in cash</Meta>
              </>
            ) : (
              <>
                <Meta label="Bank account" mono>{staff.payrollInfo?.bankAccount || 'Not provided'}</Meta>
                <Meta label="IFSC" mono>{staff.payrollInfo?.ifsc || 'N/A'}</Meta>
              </>
            )}
          </dl>
        </section>

        {/* Attendance strip */}
        <section aria-label="Attendance" className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
          {[
            { label: 'Days in month', value: payroll.totalDays },
            { label: 'Paid days', value: payroll.presentDays, strong: true },
            { label: 'Not paid (NCP)', value: payroll.ncpDays },
            { label: 'Bonus days', value: payroll.bonusDays || 0 },
          ].map((m, i) => (
            <div
              key={m.label}
              className={cn('px-6 py-4 sm:px-8', i > 0 && 'sm:border-l sm:border-line-soft', i % 2 === 1 && 'border-l border-line-soft sm:border-l')}
            >
              <p className="text-[11px] tracking-[0.06em] text-subtle uppercase">{m.label}</p>
              <p className={cn('num mt-1 text-xl', m.strong ? 'font-semibold text-present' : 'text-text')}>{m.value}</p>
            </div>
          ))}
        </section>

        {/* Earnings | Deductions */}
        <section className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-line">
          <div className="px-6 py-5 sm:px-8">
            <h3 className="mb-1 text-[11px] tracking-[0.1em] text-subtle uppercase">Earnings</h3>
            <Row label="Basic wage" note="Prorated for paid days" amount={payroll.basicWage} />
            {payroll.bonusAmount > 0 && (
              <Row
                label={payroll.bonusType && payroll.bonusType !== 'CUSTOM' ? `Bonus (${String(payroll.bonusType).toLowerCase()})` : 'Performance / festival bonus'}
                note={
                  <>
                    {payroll.bonusDays > 0 ? (
                      <>
                        <span className="num">{payroll.bonusDays}</span> {payroll.bonusDays === 1 ? 'day' : 'days'}
                      </>
                    ) : null}
                    {payroll.bonusDays > 0 && payroll.isBonusPfApplicable ? ' · ' : null}
                    {payroll.isBonusPfApplicable ? 'EPF applicable' : null}
                  </>
                }
                amount={payroll.bonusAmount}
              />
            )}
            <TotalRow label="Gross earnings" amount={payroll.grossWage} />
          </div>
          <div className="border-t border-line px-6 py-5 sm:px-8 md:border-t-0">
            <h3 className="mb-1 text-[11px] tracking-[0.1em] text-subtle uppercase">Deductions</h3>
            {!isCash && <Row label="Employee EPF" note="12% of EPF wages" amount={payroll.employeeEpf} tone="minus" />}
            {payroll.refundOfAdvance > 0 && <Row label="Advance recovery" amount={payroll.refundOfAdvance} tone="minus" />}
            {isCash && (payroll.refundOfAdvance || 0) === 0 && (
              <p className="py-2.5 text-[13px] text-subtle">No statutory deductions (Paid in cash)</p>
            )}
            <TotalRow label="Total deductions" amount={totalDeductions} />
          </div>
        </section>

        {/* Net pay */}
        <section className="tone-present border-y border-line bg-card-hi px-6 py-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] tracking-[0.1em] text-subtle uppercase">Net pay</p>
              <p className="mt-1 text-[12.5px] text-muted">
                {isCash
                  ? 'Gross earnings minus advance recovery · Paid in cash'
                  : 'Gross earnings minus total deductions, credited to bank'}
              </p>
            </div>
            <p className="num text-[30px] leading-none font-semibold tracking-tight text-present sm:text-[36px]">
              {money(payroll.netPayment)}
            </p>
          </div>
          <p className="mt-3 border-t border-line-soft pt-3 text-[12.5px] text-muted">
            <span className="text-subtle">In words: </span>
            {amountInWords(payroll.netPayment)}
          </p>
        </section>

        {/* Employer contributions */}
        <section className="px-6 py-4 sm:px-8">
          <h3 className="mb-2 text-[11px] tracking-[0.1em] text-subtle uppercase">Employer contributions (for information)</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Meta label="Employer EPF" mono>{money(payroll.employerEpf)}</Meta>
            <Meta label="Employer EPS" mono>{money(payroll.employerEps)}</Meta>
            <Meta label="Cost to company" mono>{money(payroll.actualCtc)}</Meta>
          </dl>
        </section>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3.5 text-[11.5px] text-subtle sm:px-8">
          <span className="inline-flex items-center gap-2">
            <IntimeMark size={16} />
            Generated by {APP_NAME}, {APP_TAGLINE}
          </span>
          <span>
            System-generated on <span className="num">{generatedOn}</span>. No signature required.
          </span>
        </footer>
      </article>
    </div>
  )
}
