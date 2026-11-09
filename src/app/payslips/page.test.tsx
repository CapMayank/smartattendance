/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  staff: {
    findUnique: vi.fn(),
  },
  monthlyPayroll: {
    findMany: vi.fn(),
  },
}));

const mockRedirect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth/next";
import PayslipsPage from "./page";
import { MyPayslipsClient, SalarySlipModal } from "./MyPayslipsClient";
import { EmployeeMyDashboard } from "@/components/dashboard/EmployeeMyDashboard";
import type { EmployeePortalData } from "@/lib/employee-portal";

const mockGetServerSession = vi.mocked(getServerSession);

describe("Payslips Page & Salary Slip Viewer", () => {
  const mockStaff1 = {
    id: "staff-1",
    machineId: "101",
    name: "Aman Sharma",
    employeeCode: "SEHSS-042",
    joiningDate: "2024-06-15",
    departmentId: "dept-1",
    designationId: "desig-1",
    department: { id: "dept-1", name: "Mathematics" },
    designation: { id: "desig-1", name: "Senior Teacher" },
    payrollInfo: {
      id: "pinfo-1",
      staffId: "staff-1",
      payGroup: "BANK_EPF",
      bankAccount: "123456789012",
      ifsc: "SBIN0001234",
      uan: "101234567890",
      pan: "ABCDE1234F",
      monthlyCtc: 25000,
      doj: new Date("2024-06-15"),
    },
  };

  const mockStaff2 = {
    id: "staff-2",
    machineId: "102",
    name: "Sunita Bai",
    employeeCode: null,
    joiningDate: "2023-01-10",
    departmentId: "dept-2",
    designationId: "desig-2",
    department: { id: "dept-2", name: "Support Services" },
    designation: { id: "desig-2", name: "Assistant" },
    payrollInfo: {
      id: "pinfo-2",
      staffId: "staff-2",
      payGroup: "CASH",
      bankAccount: null,
      ifsc: null,
      uan: null,
      pan: null,
      monthlyCtc: 15000,
      doj: new Date("2023-01-10"),
    },
  };

  const mockPayroll1 = {
    id: "payroll-1",
    staffId: "staff-1",
    payGroup: "BANK_EPF",
    month: 9,
    year: 2026,
    totalDays: 30,
    presentDays: 26,
    ncpDays: 4,
    actualCtc: 25000,
    grossWage: 21000,
    basicWage: 18000,
    bonusAmount: 3000,
    bonusDays: 2,
    bonusType: "CUSTOM",
    isBonusPfApplicable: false,
    epfWages: 18000,
    epsWages: 15000,
    edliWages: 15000,
    employeeEpf: 1800,
    employerEps: 1250,
    employerEpf: 550,
    refundOfAdvance: 500,
    netPayment: 18700,
    isLocked: true,
    staff: mockStaff1,
  };

  const mockPayroll2 = {
    id: "payroll-2",
    staffId: "staff-2",
    payGroup: "CASH",
    month: 8,
    year: 2026,
    totalDays: 31,
    presentDays: 30,
    ncpDays: 1,
    actualCtc: 15000,
    grossWage: 15000,
    basicWage: 15000,
    bonusAmount: 0,
    bonusDays: 0,
    bonusType: null,
    isBonusPfApplicable: false,
    epfWages: 0,
    epsWages: 0,
    edliWages: 0,
    employeeEpf: 0,
    employerEps: 0,
    employerEpf: 0,
    refundOfAdvance: 0,
    netPayment: 15000,
    isLocked: true,
    staff: mockStaff2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Server Page (src/app/payslips/page.tsx)", () => {
    it("redirects unauthenticated users to /login", async () => {
      mockGetServerSession.mockResolvedValue(null);

      await PayslipsPage({ searchParams: Promise.resolve({}) });
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("strictly uses session staffId for EMPLOYEE and queries MonthlyPayroll with details", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-1", role: "EMPLOYEE", staffId: "staff-1" },
      } as any);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "EMPLOYEE",
        staffId: "staff-1",
        disabledAt: null,
        mustChangePassword: false,
        staff: { id: "staff-1", employmentPeriods: [] },
        approverDepartments: [],
      } as any);

      mockPrisma.monthlyPayroll.findMany.mockResolvedValue([mockPayroll1 as any]);

      // Employee tries to spoof ?staffId=staff-2
      const element = await PayslipsPage({
        searchParams: Promise.resolve({ staffId: "staff-2" }),
      });

      expect(mockPrisma.monthlyPayroll.findMany).toHaveBeenCalledWith({
        where: { staffId: "staff-1", isLocked: true },
        include: {
          staff: {
            include: {
              department: true,
              designation: true,
              payrollInfo: true,
            },
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });

      const html = renderToStaticMarkup(element as React.ReactElement);
      expect(html).toContain("September 2026");
      expect(html).toContain("Bank / EPF");
    });

    it("displays unlinked staff profile message if EMPLOYEE has no staffId", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-1", role: "EMPLOYEE", staffId: null },
      } as any);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        role: "EMPLOYEE",
        staffId: null,
        disabledAt: null,
        mustChangePassword: false,
        staff: null,
        approverDepartments: [],
      } as any);

      const element = await PayslipsPage({
        searchParams: Promise.resolve({}),
      });

      const html = renderToStaticMarkup(element as React.ReactElement);
      expect(html).toContain("No linked staff profile found");
    });

    it("allows ADMIN to view payslips for a requested staffId", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-admin", role: "ADMIN", staffId: "staff-1" },
      } as any);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-admin",
        role: "ADMIN",
        disabledAt: null,
        mustChangePassword: false,
        staff: null,
        approverDepartments: [],
      } as any);

      mockPrisma.monthlyPayroll.findMany.mockResolvedValue([mockPayroll2 as any]);

      await PayslipsPage({
        searchParams: Promise.resolve({ staffId: "staff-2" }),
      });

      expect(mockPrisma.monthlyPayroll.findMany).toHaveBeenCalledWith({
        where: { staffId: "staff-2", isLocked: true },
        include: {
          staff: {
            include: {
              department: true,
              designation: true,
              payrollInfo: true,
            },
          },
        },
        orderBy: [{ year: "desc" }, { month: "desc" }],
      });
    });

    it("enforces department scoping for APPROVER requesting another staff member", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-approver", role: "APPROVER", staffId: "staff-1" },
      } as any);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-approver",
        role: "APPROVER",
        disabledAt: null,
        mustChangePassword: false,
        approvesAllDepartments: false,
        approverDepartments: [{ departmentId: "dept-1" }],
        staff: null,
      } as any);

      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "staff-2",
        departmentId: "dept-2", // outside dept-1
      } as any);

      const element = await PayslipsPage({
        searchParams: Promise.resolve({ staffId: "staff-2" }),
      });

      const html = renderToStaticMarkup(element as React.ReactElement);
      expect(html).toContain("Forbidden");
      expect(mockPrisma.monthlyPayroll.findMany).not.toHaveBeenCalled();
    });
  });

  describe("MyPayslipsClient Component", () => {
    it("renders payslip items with month, pay group badge, paid days ratio, net pay callout, and download link", () => {
      const html = renderToStaticMarkup(
        <MyPayslipsClient payslips={[mockPayroll1 as any]} />
      );

      // Month & Year
      expect(html).toContain("September 2026");
      // Pay Group badge
      expect(html).toContain("Bank / EPF");
      // Paid days ratio
      expect(html).toContain("26");
      expect(html).toContain("30");
      expect(html).toContain("paid days");
      // Net payment callout
      expect(html).toContain("18,700");
      // Action 1: View Slip
      expect(html).toContain("View Slip");
      // Action 2: Download PDF link with direct endpoint
      expect(html).toContain('/api/payroll/payroll-1/pdf');
      expect(html).toContain('download');
    });

    it("renders empty state when there are no payslips", () => {
      const html = renderToStaticMarkup(
        <MyPayslipsClient payslips={[]} />
      );

      expect(html).toContain("No payslips");
    });

    it("renders high-fidelity salary slip modal viewer with all particulars, breakdown, amount in words, and download button", () => {
      const html = renderToStaticMarkup(
        <SalarySlipModal
          slip={mockPayroll1 as any}
          open={true}
          onClose={() => {}}
        />
      );

      // School header
      expect(html).toContain("Sarvodaya English Higher Secondary School, Lakhnadon");
      // Staff particulars
      expect(html).toContain("Aman Sharma");
      expect(html).toContain("SEHSS-042");
      expect(html).toContain("101");
      expect(html).toContain("Senior Teacher");
      expect(html).toContain("Mathematics");
      expect(html).toContain("15-06-2024");
      expect(html).toContain("Bank / EPF");
      expect(html).toContain("101234567890"); // UAN
      expect(html).toContain("ABCDE1234F"); // PAN
      expect(html).toContain("123456789012"); // Bank Account
      expect(html).toContain("SBIN0001234"); // IFSC

      // Attendance summary
      expect(html).toContain("Total Days");
      expect(html).toContain("Paid Days");
      expect(html).toContain("LOP / NCP Days");
      expect(html).toContain("Bonus Days");

      // Two-column Earnings vs Deductions
      expect(html).toContain("Basic Wage");
      expect(html).toContain("Bonus / Allowances");
      expect(html).toContain("Gross Earnings");
      expect(html).toContain("Employee EPF");
      expect(html).toContain("Advance Recovery");
      expect(html).toContain("Total Deductions");

      // Net salary banner with words
      expect(html).toContain("Rupees Eighteen Thousand Seven Hundred Only");

      // Employer contributions
      expect(html).toContain("Employer EPF");
      expect(html).toContain("Employer EPS");
      expect(html).toContain("Total CTC");

      // Signatures
      expect(html).toContain("Prepared by");
      expect(html).toContain("Verified by");
      expect(html).toContain("Authorized Signatory");

      // Primary footer download button
      expect(html).toContain('/api/payroll/payroll-1/pdf');
      expect(html).toContain("Download Formatted PDF");
    });

    it("renders Cash particulars correctly in the high-fidelity modal viewer", () => {
      const html = renderToStaticMarkup(
        <SalarySlipModal
          slip={mockPayroll2 as any}
          open={true}
          onClose={() => {}}
        />
      );

      expect(html).toContain("Sunita Bai");
      expect(html).toContain("Paid in cash");
      expect(html).toContain("Rupees Fifteen Thousand Only");
    });
  });

  describe("EmployeeMyDashboard Updates", () => {
    const mockDashboardData: EmployeePortalData = {
      profile: {
        id: "staff-1",
        name: "Aman Sharma",
        employeeCode: "SEHSS-042",
        machineId: "101",
        joiningDate: "2024-06-15",
        profilePhotoId: null,
        departmentName: "Mathematics",
        designationName: "Senior Teacher",
        shift: { name: "Morning", startTime: "08:00", endTime: "14:30" },
        payGroup: "BANK_EPF",
        email: "aman@school.edu",
      },
      today: {
        dateKey: "2026-11-08",
        status: "PRESENT",
        checkIn: "2026-11-08T08:05:00.000Z",
        checkOut: null,
        lateMinutes: 5,
        workMinutes: 240,
        punches: [],
      },
      monthSummary: {
        monthLabel: "November 2026",
        presentDays: 8,
        halfDays: 0,
        absentDays: 0,
        lateDays: 1,
        totalWorkMinutes: 1920,
      },
      monthRecords: [],
      payslips: [
        {
          id: "payroll-1",
          month: 9,
          year: 2026,
          payGroup: "BANK_EPF",
          totalDays: 30,
          presentDays: 26,
          ncpDays: 4,
          grossWage: 21000,
          basicWage: 18000,
          bonusAmount: 3000,
          employeeEpf: 1800,
          netPayment: 18700,
          isLocked: true,
        },
      ],
    };

    it("links to /payslips from the My Payslips section", () => {
      const html = renderToStaticMarkup(
        <EmployeeMyDashboard
          title="My Space"
          subtitle="Overview"
          data={mockDashboardData}
        />
      );

      expect(html).toContain('href="/payslips"');
      expect(html).toContain("View all payslips");
    });

    it("uses direct PDF download URL instead of window.print", () => {
      const html = renderToStaticMarkup(
        <EmployeeMyDashboard
          title="My Space"
          subtitle="Overview"
          data={mockDashboardData}
        />
      );

      // Verify direct link to PDF
      expect(html).toContain('/api/payroll/payroll-1/pdf');
      expect(html).not.toContain("window.print");
    });
  });
});
