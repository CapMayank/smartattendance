"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Download,
  FileText,
  IndianRupee,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Modal,
  PageHeader,
} from "@/components/ui";
import { formatINR } from "@/lib/format";
import { amountInWords } from "@/lib/amount-in-words";
import type { MonthlyPayrollWithDetails } from "@/lib/payslip-pdf";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface SalarySlipModalProps {
  slip: MonthlyPayrollWithDetails | null;
  open: boolean;
  onClose: () => void;
}

export function SalarySlipModal({ slip, open, onClose }: SalarySlipModalProps) {
  if (!slip) return null;

  const staff = slip.staff;
  const pInfo = staff.payrollInfo;

  const joiningDateStr =
    staff.joiningDate ||
    (pInfo?.doj ? new Date(pInfo.doj).toISOString().slice(0, 10) : "—");

  const isCash = slip.payGroup === "CASH";
  const payGroupDisplay = isCash ? "Cash" : "Bank / EPF";
  const bankDisplay = isCash
    ? "Paid in cash"
    : pInfo?.bankAccount
      ? `${pInfo.bankAccount} (${pInfo.ifsc || "—"})`
      : "—";

  const totalDeductions = slip.employeeEpf + slip.refundOfAdvance;
  const monthName = MONTH_NAMES[(slip.month || 1) - 1] || `Month ${slip.month}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Salary Slip · ${monthName} ${slip.year}`}
      footer={
        <>
          <a
            href={`/api/payroll/${slip.id}/pdf`}
            download
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-text px-3.5 text-[13px] font-medium text-ground transition-colors hover:bg-text/90"
          >
            <Download size={15} aria-hidden="true" />
            Download Formatted PDF
          </a>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13px]">
        {/* School Header */}
        <div className="flex flex-col items-center justify-center border-b border-line-soft pb-4 text-center">
          <div className="mb-2 inline-flex size-10 items-center justify-center rounded-xl bg-acc-1/10 text-acc-1">
            <Building2 size={20} aria-hidden="true" />
          </div>
          <h3 className="text-[15px] font-bold tracking-tight text-text">
            Sarvodaya English Higher Secondary School, Lakhnadon
          </h3>
          <p className="mt-0.5 text-xs text-muted">Lakhnadon, Dist. Seoni (M.P.)</p>
          <div className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-line-soft bg-canvas px-3 py-1 text-xs font-semibold text-text">
            <span>
              SALARY SLIP · {monthName.toUpperCase()} {slip.year}
            </span>
          </div>
        </div>

        {/* Staff Particulars */}
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl border border-line-soft bg-canvas p-3.5 text-xs sm:grid-cols-2">
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Name:</span>
            <span className="font-semibold text-text">{staff.name}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Employee Code:</span>
            <span className="num font-semibold text-text">{staff.employeeCode || "—"}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Machine ID:</span>
            <span className="num font-semibold text-text">{staff.machineId}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Designation:</span>
            <span className="font-semibold text-text">{staff.designation?.name || "—"}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Department:</span>
            <span className="font-semibold text-text">{staff.department?.name || "—"}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Date of Joining:</span>
            <span className="num font-semibold text-text">{joiningDateStr}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Pay Group:</span>
            <span className="font-semibold text-text">{payGroupDisplay}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">UAN:</span>
            <span className="num font-semibold text-text">{pInfo?.uan || "—"}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">PAN:</span>
            <span className="num font-semibold text-text">{pInfo?.pan || "—"}</span>
          </div>
          <div className="flex justify-between sm:col-span-2 sm:justify-start sm:gap-2">
            <span className="text-subtle">Bank / IFSC:</span>
            <span className="font-semibold text-text">{bankDisplay}</span>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div className="rounded-xl border border-line-soft bg-canvas p-2.5">
            <span className="text-[11px] text-subtle">Total Days</span>
            <b className="num mt-0.5 block text-sm text-text">{slip.totalDays}</b>
          </div>
          <div className="rounded-xl border border-line-soft bg-canvas p-2.5">
            <span className="text-[11px] text-subtle">Paid Days</span>
            <b className="num mt-0.5 block text-sm text-present">{slip.presentDays}</b>
          </div>
          <div className="rounded-xl border border-line-soft bg-canvas p-2.5">
            <span className="text-[11px] text-subtle">LOP / NCP Days</span>
            <b className="num mt-0.5 block text-sm text-absent">{slip.ncpDays}</b>
          </div>
          <div className="rounded-xl border border-line-soft bg-canvas p-2.5">
            <span className="text-[11px] text-subtle">Bonus Days</span>
            <b className="num mt-0.5 block text-sm text-text">{slip.bonusDays ?? 0}</b>
          </div>
        </div>

        {/* Two-Column Earnings vs. Deductions */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* Earnings */}
          <div className="overflow-hidden rounded-xl border border-line-soft">
            <div className="flex justify-between border-b border-line-soft bg-canvas px-3.5 py-2 text-xs font-semibold text-text">
              <span>EARNINGS</span>
              <span>AMOUNT</span>
            </div>
            <div className="divide-y divide-line-soft text-xs">
              <div className="flex justify-between px-3.5 py-2">
                <span className="text-muted">Basic Wage</span>
                <span className="num font-medium text-text">{formatINR(slip.basicWage)}</span>
              </div>
              <div className="flex justify-between px-3.5 py-2">
                <span className="text-muted">Bonus / Allowances</span>
                <span className="num font-medium text-text">{formatINR(slip.bonusAmount)}</span>
              </div>
            </div>
            <div className="flex justify-between border-t border-line-soft bg-card-hi px-3.5 py-2 text-xs font-semibold text-text">
              <span>Gross Earnings</span>
              <span className="num text-text">{formatINR(slip.grossWage)}</span>
            </div>
          </div>

          {/* Deductions */}
          <div className="overflow-hidden rounded-xl border border-line-soft">
            <div className="flex justify-between border-b border-line-soft bg-canvas px-3.5 py-2 text-xs font-semibold text-text">
              <span>DEDUCTIONS</span>
              <span>AMOUNT</span>
            </div>
            <div className="divide-y divide-line-soft text-xs">
              <div className="flex justify-between px-3.5 py-2">
                <span className="text-muted">Employee EPF (12%)</span>
                <span className="num font-medium text-absent">-{formatINR(slip.employeeEpf)}</span>
              </div>
              <div className="flex justify-between px-3.5 py-2">
                <span className="text-muted">Advance Recovery</span>
                <span className="num font-medium text-absent">-{formatINR(slip.refundOfAdvance)}</span>
              </div>
            </div>
            <div className="flex justify-between border-t border-line-soft bg-card-hi px-3.5 py-2 text-xs font-semibold text-text">
              <span>Total Deductions</span>
              <span className="num text-absent">-{formatINR(totalDeductions)}</span>
            </div>
          </div>
        </div>

        {/* Net Salary Banner */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Net Payable Amount
              </span>
              <p className="mt-1 text-xs italic text-muted">
                {amountInWords(slip.netPayment)}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <div className="num text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(slip.netPayment)}
              </div>
              <span className="block text-[11px] text-muted">
                Payment Mode: {isCash ? "Cash" : "Bank Transfer"}
              </span>
            </div>
          </div>
        </div>

        {/* Employer Contributions */}
        <div className="rounded-xl border border-line-soft bg-canvas p-3 text-xs">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-subtle">
            Employer Contributions (Information Only)
          </span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div>
              <span className="text-muted">Employer EPF: </span>
              <b className="num text-text">{formatINR(slip.employerEpf)}</b>
            </div>
            <div>
              <span className="text-muted">Employer EPS: </span>
              <b className="num text-text">{formatINR(slip.employerEps)}</b>
            </div>
            <div>
              <span className="text-muted">Total CTC: </span>
              <b className="num text-text">{formatINR(slip.actualCtc)}</b>
            </div>
          </div>
        </div>

        {/* Signatures Block */}
        <div className="border-t border-line-soft pt-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="h-9 border-b border-dashed border-line" />
              <span className="mt-1 block text-[11px] text-subtle">Prepared by</span>
            </div>
            <div>
              <div className="h-9 border-b border-dashed border-line" />
              <span className="mt-1 block text-[11px] text-subtle">Verified by</span>
            </div>
            <div>
              <div className="h-9 border-b border-dashed border-line" />
              <span className="mt-1 block text-[11px] text-subtle">Authorized Signatory</span>
            </div>
          </div>
          <p className="mt-4 text-center text-[10.5px] text-subtle">
            This is a computer-generated salary slip and does not require a physical signature when verified digitally.
          </p>
        </div>
      </div>
    </Modal>
  );
}

export interface MyPayslipsClientProps {
  payslips: MonthlyPayrollWithDetails[];
  userRole?: string;
  staffId?: string | null;
  defaultSelectedSlip?: MonthlyPayrollWithDetails | null;
}

export function MyPayslipsClient({
  payslips,
  defaultSelectedSlip = null,
}: MyPayslipsClientProps) {
  const [selectedSlip, setSelectedSlip] = useState<MonthlyPayrollWithDetails | null>(
    defaultSelectedSlip
  );

  return (
    <div className="flex flex-col gap-[22px]">
      <PageHeader
        title="My Payslips"
        subtitle="View and download monthly salary slips and payment breakdowns."
        actions={
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-card-hi px-3.5 text-[13px] font-medium text-text transition-colors hover:border-subtle"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Dashboard
          </Link>
        }
      />

      <Card className="overflow-hidden !p-0">
        <div className="p-4 pb-2">
          <CardHeader
            title="Monthly Salary Slips"
            caption="Complete history of issued monthly payroll records"
          />
        </div>

        {payslips.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={IndianRupee}
              title="No payslips generated yet"
              hint="Once monthly payroll is processed, your salary slips will appear here."
            />
          </div>
        ) : (
          <div className="divide-y divide-line-soft">
            {payslips.map((slip) => {
              const monthName = MONTH_NAMES[(slip.month || 1) - 1] || `Month ${slip.month}`;
              return (
                <div
                  key={slip.id}
                  className="flex flex-col gap-4 p-4 transition-colors hover:bg-canvas/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3.5 sm:items-center">
                    <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-line-soft bg-canvas text-text">
                      <FileText size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-text">
                          {monthName} {slip.year}
                        </h3>
                        <span className="rounded border border-line-soft bg-canvas px-2 py-0.5 text-xs font-medium text-subtle">
                          {slip.payGroup === "CASH" ? "Cash" : "Bank / EPF"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        Paid days: <b className="num text-text">{slip.presentDays}</b> / {slip.totalDays} paid days · LOP:{" "}
                        <span className="num text-absent">{slip.ncpDays}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 border-t border-line-soft pt-3 sm:border-t-0 sm:pt-0 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <div className="num text-[17px] font-bold text-present">
                        {formatINR(slip.netPayment)}
                      </div>
                      <span className="block text-[11px] text-subtle">Net Pay</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={FileText}
                        onClick={() => setSelectedSlip(slip)}
                      >
                        View Slip
                      </Button>
                      <a
                        href={`/api/payroll/${slip.id}/pdf`}
                        download
                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line bg-card-hi px-3 text-[13px] font-medium text-text transition-colors hover:border-subtle"
                      >
                        <Download size={14} aria-hidden="true" />
                        Download PDF
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <SalarySlipModal
        slip={selectedSlip}
        open={selectedSlip !== null}
        onClose={() => setSelectedSlip(null)}
      />
    </div>
  );
}
