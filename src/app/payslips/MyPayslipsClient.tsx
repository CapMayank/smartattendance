"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileText,
  IndianRupee,
} from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { formatINR } from "@/lib/format";
import type { MonthlyPayrollWithDetails } from "@/lib/payslip-pdf";
import { SalarySlipModal, type SalarySlipModalProps } from "@/components/payroll/SalarySlipModal";

export { SalarySlipModal, type SalarySlipModalProps };

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
