"use client";

import { Download, Building2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatDate, formatINR } from "@/lib/format";
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
  const pInfo = staff?.payrollInfo;

  const joiningDateStr =
    staff?.joiningDate ||
    (pInfo?.doj ? new Date(pInfo.doj).toISOString().slice(0, 10) : "—");

  const isCash = slip.payGroup === "CASH";
  const payGroupDisplay = isCash ? "Cash" : "Bank / EPF";
  const bankDisplay = isCash
    ? "Paid in cash"
    : pInfo?.bankAccount
      ? `${pInfo.bankAccount} (${pInfo.ifsc || "—"})`
      : "—";

  const totalDeductions = (slip.employeeEpf || 0) + (slip.refundOfAdvance || 0);
  const monthName = MONTH_NAMES[(slip.month || 1) - 1] || `Month ${slip.month}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Salary Slip · ${monthName} ${slip.year}`}
      size="xl"
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
            <span className="font-semibold text-text">{staff?.name || "—"}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Employee Code:</span>
            <span className="num font-semibold text-text">{staff?.employeeCode || "—"}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Machine ID:</span>
            <span className="num font-semibold text-text">{staff?.machineId || "—"}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Designation:</span>
            <span className="font-semibold text-text">{staff?.designation?.name || "—"}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Department:</span>
            <span className="font-semibold text-text">{staff?.department?.name || "—"}</span>
          </div>
          <div className="flex justify-between sm:justify-start sm:gap-2">
            <span className="text-subtle">Date of Joining:</span>
            <span className="num font-semibold text-text">{formatDate(joiningDateStr)}</span>
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
            <b className="num mt-0.5 block text-text">{slip.bonusDays ?? 0}</b>
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
                <span className="num font-medium text-absent">-{formatINR(slip.refundOfAdvance || 0)}</span>
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
              <b className="num text-text">{formatINR(slip.employerEpf || 0)}</b>
            </div>
            <div>
              <span className="text-muted">Employer EPS: </span>
              <b className="num text-text">{formatINR(slip.employerEps || 0)}</b>
            </div>
            <div>
              <span className="text-muted">Total CTC: </span>
              <b className="num text-text">{formatINR(slip.actualCtc || 0)}</b>
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
