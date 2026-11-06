'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Download, FileText, Calendar as CalendarIcon, Loader2, PencilLine } from 'lucide-react'
import { Button, Card, EmptyState, Field, PageHeader, Select, StatusBadge } from '@/components/ui'
import Papa from 'papaparse'

type MonthlyPayroll = {
  id: string
  month: number
  year: number
  totalDays: number
  presentDays: number
  ncpDays: number
  actualCtc: number
  grossWage: number
  netPayment: number
  isLocked: boolean
}

type Staff = {
  id: string
  name: string
  machineId: string
  department: { name: string } | null
  designation: { name: string } | null
  payrollInfo: {
    monthlyCtc: number
    bankAccount: string | null
    ifsc: string | null
  } | null
}

export default function MemberPayrollPage() {
  const router = useRouter()
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<string>('')
  
  const [loading, setLoading] = useState(false)
  const [staffData, setStaffData] = useState<Staff | null>(null)
  const [payrolls, setPayrolls] = useState<MonthlyPayroll[]>([])

  // Fetch staff list for dropdown
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/staff')
        if (res.ok) {
          const data = await res.json()
          setStaffList(data)
          if (data.length > 0) {
            setSelectedStaffId(data[0].id)
          }
        }
      } catch (e) {
        console.error('Failed to fetch staff list:', e)
      }
    }
    fetchStaff()
  }, [])

  // Fetch payroll history when staff changes
  useEffect(() => {
    if (!selectedStaffId) return

    const fetchReport = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/payroll/member-payroll?staffId=${selectedStaffId}`)
        if (res.ok) {
          const data = await res.json()
          setStaffData(data.staff)
          setPayrolls(data.payrolls)
        } else {
          setStaffData(null)
          setPayrolls([])
        }
      } catch (e) {
        console.error('Failed to fetch report:', e)
        setStaffData(null)
        setPayrolls([])
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [selectedStaffId])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount)
  }

  const exportCSV = () => {
    if (!staffData || payrolls.length === 0) return;

    const csvData = payrolls.map(p => {
      const monthName = new Date(p.year, p.month - 1).toLocaleString('default', { month: 'long' });
      return {
        'Period': `${monthName} ${p.year}`,
        'Total Days': p.totalDays,
        'Present/Paid Days': p.presentDays,
        'NCP Days': p.ncpDays,
        'Actual CTC': p.actualCtc,
        'Gross Wage': p.grossWage,
        'Net Payment': p.netPayment,
        'Status': p.isLocked ? 'Locked' : 'Draft'
      };
    });

    const filename = `Payroll_History_${staffData.name.replace(/\s+/g, '_')}.csv`
    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title="Member payroll history"
        subtitle="View detailed payroll history for individual staff members."
        actions={
          <Button
            icon={Download}
            onClick={exportCSV}
            disabled={!staffData || payrolls.length === 0}
          >
            Export CSV
          </Button>
        }
      />

      <Card className="overflow-hidden !p-0">
        {/* Filters */}
        <div className="border-b border-line-soft px-5 py-4">
          <div className="max-w-md">
            <Field label="Staff member" htmlFor="member-payroll-staff">
              <Select
                id="member-payroll-staff"
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="" disabled>Select Staff Member</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.machineId} - {staff.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        {/* Staff Summary */}
        {staffData && !loading && (
          <div className="grid grid-cols-1 gap-3 border-b border-line-soft px-5 py-4 md:grid-cols-3">
            <div className="flex flex-col rounded-xl border border-line-soft bg-canvas p-4">
              <span className="mb-1 text-[12.5px] text-muted">Current CTC</span>
              <span className="num text-2xl font-medium text-present">{formatCurrency(staffData.payrollInfo?.monthlyCtc || 0)}</span>
            </div>
            <div className="flex flex-col rounded-xl border border-line-soft bg-canvas p-4">
              <span className="mb-1 text-[12.5px] text-muted">Department / Role</span>
              <span className="text-[15px] font-medium text-text">{staffData.department?.name || '-'}</span>
              <span className="text-[13px] text-subtle">{staffData.designation?.name || '-'}</span>
            </div>
            <div className="flex flex-col rounded-xl border border-line-soft bg-canvas p-4">
              <span className="mb-1 text-[12.5px] text-muted">Bank Details</span>
              <span className="num break-all text-sm text-text">{staffData.payrollInfo?.bankAccount || 'Not Provided'}</span>
              <span className="num text-xs text-subtle">{staffData.payrollInfo?.ifsc || 'No IFSC'}</span>
            </div>
          </div>
        )}

        <div className="table-wrap hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th className="text-center">Days (Total / Paid)</th>
                <th className="text-right">Actual CTC</th>
                <th className="text-right">Gross Wage</th>
                <th className="text-right">Net Payment</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <div className="flex items-center justify-center gap-2 py-16 text-muted">
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      Fetching payroll history...
                    </div>
                  </td>
                </tr>
              ) : payrolls.length > 0 ? (
                payrolls.map((payroll) => {
                  const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('default', { month: 'short' });

                  return (
                    <tr
                      key={payroll.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/reports/member-payroll/${payroll.id}`)}
                    >
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-card-hi text-muted">
                            <CalendarIcon size={16} aria-hidden="true" />
                          </span>
                          <span className="font-medium text-text">{monthName} <span className="num">{payroll.year}</span></span>
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="num text-text">{payroll.totalDays}</span>
                          <span className="tone-present tint-pill rounded px-1.5 py-0.5 text-[11px]"><span className="num">{payroll.presentDays}</span> Paid</span>
                        </div>
                      </td>
                      <td className="num text-right text-muted">
                        {formatCurrency(payroll.actualCtc)}
                      </td>
                      <td className="num text-right text-muted">
                        {formatCurrency(payroll.grossWage)}
                      </td>
                      <td className="text-right">
                        <span className="num font-medium text-present">
                          {formatCurrency(payroll.netPayment)}
                        </span>
                      </td>
                      <td className="text-center">
                        {payroll.isLocked ? (
                          <StatusBadge status="locked" />
                        ) : (
                          <span className="tone-late tint-badge inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                            <PencilLine size={13} aria-hidden="true" />
                            Draft
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="whitespace-normal">
                    <EmptyState
                      icon={FileText}
                      title="No Payroll Records Found"
                      hint="Select a different staff member or generate payroll first."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="space-y-3 p-4 md:hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              Fetching payroll history...
            </div>
          ) : payrolls.length > 0 ? (
            payrolls.map((payroll) => {
              const monthName = new Date(payroll.year, payroll.month - 1).toLocaleString('default', { month: 'long' })
              const paidPct = payroll.totalDays > 0 ? Math.min(100, (payroll.presentDays / payroll.totalDays) * 100) : 0
              return (
                <div
                  key={payroll.id}
                  onClick={() => router.push(`/reports/member-payroll/${payroll.id}`)}
                  className="cursor-pointer rounded-xl border border-line bg-canvas p-4 transition-colors duration-150 hover:border-subtle"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-9 flex-none place-items-center rounded-[10px] border border-line bg-card-hi text-muted">
                        <CalendarIcon size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium leading-tight text-text">{monthName}</p>
                        <p className="num text-xs text-subtle">{payroll.year}</p>
                      </div>
                    </div>
                    {payroll.isLocked ? (
                      <StatusBadge status="locked" />
                    ) : (
                      <span className="tone-late tint-badge inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs">
                        <PencilLine size={13} aria-hidden="true" />
                        Draft
                      </span>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl border border-line-soft bg-ground p-3.5">
                    <p className="text-[11px] text-subtle">Net Payment</p>
                    <p className="num mt-0.5 text-2xl font-medium text-present">{formatCurrency(payroll.netPayment)}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-line-soft bg-ground p-3">
                      <p className="text-[11px] text-subtle">Actual CTC</p>
                      <p className="num mt-1 text-sm text-text">{formatCurrency(payroll.actualCtc)}</p>
                    </div>
                    <div className="rounded-lg border border-line-soft bg-ground p-3">
                      <p className="text-[11px] text-subtle">Gross Wage</p>
                      <p className="num mt-1 text-sm text-text">{formatCurrency(payroll.grossWage)}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-[11px]">
                      <span className="text-muted">Days Paid</span>
                      <span className="num text-text">{payroll.presentDays} <span className="text-subtle">/ {payroll.totalDays}</span></span>
                    </div>
                    <div className="h-[7px] overflow-hidden rounded-full bg-card-hi">
                      <div className="h-full rounded-full bg-linear-to-r from-acc-2 to-acc-1" style={{ width: `${paidPct}%` }}></div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <EmptyState
              icon={FileText}
              title="No Payroll Records Found"
              hint="Select a different staff member or generate payroll first."
            />
          )}
        </div>
      </Card>
    </div>
  )
}
