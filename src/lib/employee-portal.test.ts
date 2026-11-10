import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    staff: { findUnique: vi.fn() },
    attendanceLog: { findMany: vi.fn() },
    dailyRecord: { findMany: vi.fn() },
    monthlyPayroll: { findMany: vi.fn() },
    profileChangeRequest: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { getEmployeePortalData } from "./employee-portal";

describe("getEmployeePortalData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when staff record does not exist", async () => {
    mockPrisma.staff.findUnique.mockResolvedValue(null);
    const res = await getEmployeePortalData("non-existent");
    expect(res).toBeNull();
  });

  it("aggregates identity, today punches, monthly attendance summary, and payslips for the employee", async () => {
    mockPrisma.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      name: "Asha Verma",
      employeeCode: "SAR-2026-004",
      machineId: "104",
      joiningDate: "2026-04-01",
      department: { name: "Science" },
      designation: { name: "PGT Physics" },
      shift: { name: "Morning Shift", startTime: "08:00", endTime: "14:30" },
      user: { email: "asha@school.edu" },
      payrollInfo: { payGroup: "BANK_EPF" },
    });

    mockPrisma.attendanceLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        staffId: "staff-1",
        timestamp: new Date("2026-11-08T02:35:00.000Z"),
        type: "IN",
      },
    ]);

    mockPrisma.dailyRecord.findMany.mockResolvedValue([
      {
        id: "dr-1",
        staffId: "staff-1",
        date: new Date("2026-11-08T00:00:00.000Z"),
        status: "PRESENT",
        checkIn: new Date("2026-11-08T02:35:00.000Z"),
        checkOut: null,
        lateMinutes: 5,
        workMinutes: 360,
      },
      {
        id: "dr-2",
        staffId: "staff-1",
        date: new Date("2026-11-07T00:00:00.000Z"),
        status: "HALF_DAY",
        checkIn: new Date("2026-11-07T03:00:00.000Z"),
        checkOut: new Date("2026-11-07T06:30:00.000Z"),
        lateMinutes: 0,
        workMinutes: 210,
      },
    ]);

    mockPrisma.monthlyPayroll.findMany.mockResolvedValue([
      {
        id: "pay-1",
        staffId: "staff-1",
        month: 10,
        year: 2026,
        payGroup: "BANK_EPF",
        totalDays: 31,
        presentDays: 29,
        ncpDays: 2,
        grossWage: 28000,
        basicWage: 15000,
        bonusAmount: 0,
        employeeEpf: 1800,
        netPayment: 26200,
        isLocked: true,
        staff: {
          id: "staff-1",
          name: "Asha Verma",
          employeeCode: "SAR-2026-004",
          machineId: "104",
          joiningDate: "2026-04-01",
          department: { name: "Science" },
          designation: { name: "PGT Physics" },
          payrollInfo: { payGroup: "BANK_EPF" },
        },
      },
    ]);

    const res = await getEmployeePortalData("staff-1", new Date("2026-11-08T05:00:00.000Z"));
    expect(res).not.toBeNull();
    expect(res?.profile.employeeCode).toBe("SAR-2026-004");
    expect(res?.profile.departmentName).toBe("Science");
    expect(res?.today.status).toBe("PRESENT");
    expect(res?.today.punches).toHaveLength(1);
    expect(res?.monthSummary).toEqual({
      monthLabel: "November 2026",
      presentDays: 1,
      halfDays: 1,
      absentDays: 0,
      lateDays: 1,
      totalWorkMinutes: 570,
    });
    expect(res?.payslips).toHaveLength(1);
    expect(res?.payslips[0].netPayment).toBe(26200);
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
      take: 12,
    });
  });
});
