import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider } from "@/components/ThemeProvider";
import { EmployeeMyDashboard } from "@/components/dashboard/EmployeeMyDashboard";
import { StaffToday } from "@/components/dashboard/StaffToday";
import { DepartmentTurnout } from "@/components/dashboard/DepartmentTurnout";
import { AttentionList } from "@/components/dashboard/AttentionList";
import type { EmployeePortalData } from "@/lib/employee-portal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

const mockPortalData: EmployeePortalData = {
  profile: {
    id: "staff-1",
    name: "Sunita Patel",
    employeeCode: "EMP042",
    machineId: "42",
    joiningDate: "2024-01-15",
    profilePhotoId: null,
    departmentName: "Primary Wing",
    designationName: "Assistant Teacher",
    shift: { name: "Morning Shift", startTime: "08:00", endTime: "14:00" },
    payGroup: "BANK_EPF",
    email: "sunita@example.com",
  },
  today: {
    dateKey: "2026-11-09",
    status: "PRESENT",
    checkIn: "2026-11-09T08:05:00.000Z",
    checkOut: "2026-11-09T14:02:00.000Z",
    lateMinutes: 5,
    workMinutes: 357,
    punches: [
      { id: "p1", timestamp: "2026-11-09T08:05:00.000Z", type: "IN" },
      { id: "p2", timestamp: "2026-11-09T14:02:00.000Z", type: "OUT" },
    ],
  },
  monthSummary: {
    monthLabel: "November 2026",
    presentDays: 7,
    halfDays: 1,
    absentDays: 0,
    lateDays: 2,
    totalWorkMinutes: 2480,
  },
  monthRecords: [
    {
      id: "rec-1",
      dateKey: "2026-11-09",
      status: "PRESENT",
      checkIn: "2026-11-09T08:05:00.000Z",
      checkOut: "2026-11-09T14:02:00.000Z",
      lateMinutes: 5,
      workMinutes: 357,
    },
  ],
  payslips: [
    {
      id: "ps-1",
      month: 10,
      year: 2026,
      payGroup: "BANK_EPF",
      totalDays: 31,
      presentDays: 26,
      ncpDays: 0,
      grossWage: 25000,
      basicWage: 20000,
      bonusAmount: 1500,
      employeeEpf: 2400,
      netPayment: 24100,
      isLocked: true,
    },
  ],
};

describe("Dashboards in Light Theme", () => {
  it("renders EmployeeMyDashboard within light theme with expected tokens and sections", () => {
    const html = renderToStaticMarkup(
      <ThemeProvider defaultTheme="light">
        <EmployeeMyDashboard title="Good morning, Sunita" subtitle="Monday, 9 Nov · ID EMP042" data={mockPortalData} />
      </ThemeProvider>,
    );

    // Profile & shift
    expect(html).toContain("Sunita Patel");
    expect(html).toContain("EMP042");
    expect(html).toContain("Morning Shift");
    expect(html).toContain("Machine ID");
    expect(html).toContain("Bank / EPF");

    // Today attendance & punch chips
    expect(html).toContain("Present Today");
    expect(html).toContain("First Check-In");
    expect(html).toContain("Last Check-Out");
    expect(html).toContain("Today&#x27;s Biometric Punches");

    // Monthly summary KPIs & daily logs table
    expect(html).toContain("My Month · November 2026");
    expect(html).toContain("My present days");
    expect(html).toContain("My late arrivals");
    expect(html).toContain("data-table");
    expect(html).toContain("My Payslips");
  });

  it("renders Admin Dashboard components (StaffToday, DepartmentTurnout, AttentionList) in light mode", () => {
    const staffRows = [
      {
        id: "s1",
        empId: "EMP001",
        name: "Anand Verma",
        role: "PGT Physics",
        dept: "Senior Wing",
        status: "on-duty" as const,
        lateBy: 0,
        punches: [{ at: "2026-11-09T08:00:00.000Z", type: "IN" as const, device: "Main Gate" }],
        firstIn: "08:00 am",
        lastOut: null,
        dutyMins: 120,
        shift: { start: "08:00", end: "14:00" },
      },
    ];

    const htmlStaff = renderToStaticMarkup(
      <ThemeProvider defaultTheme="light">
        <StaffToday staff={staffRows} punchLog={[]} workingDay={true} now="2026-11-09T10:00:00.000Z" />
      </ThemeProvider>,
    );
    expect(htmlStaff).toContain("Anand Verma");
    expect(htmlStaff).toContain("PGT Physics");

    const htmlDepts = renderToStaticMarkup(
      <ThemeProvider defaultTheme="light">
        <DepartmentTurnout departments={[{ name: "Senior Wing", present: 8, total: 10 }]} />
      </ThemeProvider>,
    );
    expect(htmlDepts).toContain("Senior Wing");
    expect(htmlDepts).toContain("8");
    expect(htmlDepts).toContain("10");

    const htmlAttention = renderToStaticMarkup(
      <ThemeProvider defaultTheme="light">
        <AttentionList
          items={[
            {
              kind: "device-offline",
              title: "Library Terminal Offline",
              detail: "Last ping 4 hours ago",
              href: "/devices",
            },
          ]}
        />
      </ThemeProvider>,
    );
    expect(htmlAttention).toContain("Library Terminal Offline");
  });
});
