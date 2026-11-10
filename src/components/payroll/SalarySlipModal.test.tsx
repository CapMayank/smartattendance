import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SalarySlipModal } from "./SalarySlipModal";
import type { MonthlyPayrollWithDetails } from "@/lib/payslip-pdf";

describe("SalarySlipModal Component", () => {
  const mockBankSlip: MonthlyPayrollWithDetails = {
    id: "payroll-1",
    staffId: "staff-1",
    year: 2026,
    month: 10,
    payGroup: "BANK_EPF",
    totalDays: 31,
    presentDays: 31,
    absentDays: 0,
    halfDays: 0,
    paidLeaves: 0,
    ncpDays: 0,
    bonusDays: 0,
    basicWage: 40000,
    bonusAmount: 0,
    grossWage: 40000,
    employeeEpf: 4800,
    refundOfAdvance: 0,
    netPayment: 35200,
    employerEpf: 1470,
    employerEps: 3330,
    actualCtc: 44800,
    status: "FINALIZED",
    remarks: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    staff: {
      id: "staff-1",
      name: "Preeti Vishwakarma",
      employeeCode: "SAR-2014-002",
      machineId: "2",
      joiningDate: "2014-06-23",
      department: { id: "dept-1", name: "Office" },
      designation: { id: "desig-1", name: "Principal" },
      payrollInfo: {
        id: "pinfo-1",
        staffId: "staff-1",
        payGroup: "BANK_EPF",
        bankAccount: "957110110000259",
        ifsc: "BKID0009571",
        uan: "100435629089",
        pan: null,
        doj: new Date("2014-06-23"),
        baseSalary: 40000,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    },
  };

  const mockCashSlip: MonthlyPayrollWithDetails = {
    ...mockBankSlip,
    id: "payroll-2",
    payGroup: "CASH",
    employeeEpf: 0,
    netPayment: 40000,
    employerEpf: 0,
    employerEps: 0,
    actualCtc: 40000,
  };

  it("returns null when slip is null", () => {
    const html = renderToStaticMarkup(
      <SalarySlipModal slip={null} open={true} onClose={() => {}} />
    );
    expect(html).toBe("");
  });

  it("renders full institutional salary slip modal with all metadata and net pay", () => {
    const html = renderToStaticMarkup(
      <SalarySlipModal slip={mockBankSlip} open={true} onClose={() => {}} />
    );

    // School Header
    expect(html).toContain("Sarvodaya English Higher Secondary School, Lakhnadon");
    expect(html).toContain("SALARY SLIP · OCTOBER 2026");

    // Staff Particulars
    expect(html).toContain("Preeti Vishwakarma");
    expect(html).toContain("SAR-2014-002");
    expect(html).toContain("Principal");
    expect(html).toContain("Office");
    expect(html).toContain("100435629089");
    expect(html).toContain("957110110000259 (BKID0009571)");
    expect(html).toContain("Bank / EPF");

    // Attendance Counts
    expect(html).toContain("Total Days");
    expect(html).toContain("Paid Days");
    expect(html).toContain("LOP / NCP Days");

    // Earnings & Deductions
    expect(html).toContain("Basic Wage");
    expect(html).toContain("Employee EPF (12%)");
    expect(html).toContain("Total Deductions");

    // Net Payable Banner
    expect(html).toContain("Net Payable Amount");
    expect(html).toContain("₹35,200");
    expect(html).toContain("Thirty Five Thousand Two Hundred");
    expect(html).toContain("Payment Mode: Bank Transfer");

    // Employer Contributions
    expect(html).toContain("Employer Contributions (Information Only)");
    expect(html).toContain("Employer EPF:");
    expect(html).toContain("Employer EPS:");
    expect(html).toContain("Total CTC:");

    // PDF Download Link
    expect(html).toContain('href="/api/payroll/payroll-1/pdf"');
    expect(html).toContain("Download Formatted PDF");
  });

  it("renders Cash pay group correctly without bank account details", () => {
    const html = renderToStaticMarkup(
      <SalarySlipModal slip={mockCashSlip} open={true} onClose={() => {}} />
    );

    expect(html).toContain("Cash");
    expect(html).toContain("Paid in cash");
    expect(html).toContain("Payment Mode: Cash");
  });
});
