import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  monthlyPayroll: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  dailyRecord: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth/next";
import { POST } from "./route";

const session = vi.mocked(getServerSession);

describe("POST /api/payroll/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "Admin", role: "ADMIN", disabledAt: null, mustChangePassword: false, staff: null, approverDepartments: [] });
    session.mockResolvedValue({ user: { id: "u1" } } as never);
  });

  it("returns 401 if unauthenticated", async () => {
    session.mockResolvedValue(null);
    const req = new Request("http://localhost/api/payroll/sync", {
      method: "POST",
      body: JSON.stringify({ month: 11, year: 2026 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 if month or year is missing", async () => {
    const req = new Request("http://localhost/api/payroll/sync", {
      method: "POST",
      body: JSON.stringify({ month: 11 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("skips locked payrolls", async () => {
    mockPrisma.monthlyPayroll.findMany.mockResolvedValue([
      {
        id: "p1",
        staffId: "s1",
        isLocked: true,
        presentDays: 20,
        payGroup: "BANK_EPF",
        staff: {
          createdAt: new Date("2026-01-01"),
          payrollInfo: {
            monthlyCtc: 22400,
            payGroup: "BANK_EPF",
          },
        },
      },
    ]);

    const req = new Request("http://localhost/api/payroll/sync", {
      method: "POST",
      body: JSON.stringify({ month: 11, year: 2026 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json).toEqual({ success: true, updatedCount: 0 });
    expect(mockPrisma.monthlyPayroll.update).not.toHaveBeenCalled();
  });

  it("syncs BANK_EPF payroll and saves calculations with EPF", async () => {
    mockPrisma.monthlyPayroll.findMany.mockResolvedValue([
      {
        id: "p1",
        staffId: "s1",
        isLocked: false,
        presentDays: 10, // will change to 2
        totalDays: 30,
        refundOfAdvance: 0,
        bonusAmount: 0,
        bonusDays: 0,
        bonusType: "CUSTOM",
        isBonusPfApplicable: false,
        payGroup: "BANK_EPF",
        staff: {
          createdAt: new Date("2026-01-01"),
          payrollInfo: {
            doj: new Date("2026-01-01"),
            monthlyCtc: 22400, // 20000 baseGross
            payGroup: "BANK_EPF",
          },
        },
      },
    ]);

    // November 2026 has 30 days
    mockPrisma.dailyRecord.findMany.mockResolvedValue([
      {
        date: new Date(2026, 10, 1), // Nov 1
        status: "PRESENT",
      },
      {
        date: new Date(2026, 10, 2), // Nov 2
        status: "PRESENT",
      },
    ]);

    const req = new Request("http://localhost/api/payroll/sync", {
      method: "POST",
      body: JSON.stringify({ month: 11, year: 2026 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json).toEqual({ success: true, updatedCount: 1 });

    expect(mockPrisma.monthlyPayroll.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({
        presentDays: 2,
        payGroup: "BANK_EPF",
        basicWage: expect.any(Number),
        employeeEpf: expect.any(Number),
      }),
    });

    const updateData = mockPrisma.monthlyPayroll.update.mock.calls[0][0].data;
    expect(updateData.employeeEpf).toBeGreaterThan(0);
    expect(updateData.payGroup).toBe("BANK_EPF");
  });

  it("syncs CASH payroll with zero EPF/EPS/EDLI contributions", async () => {
    mockPrisma.monthlyPayroll.findMany.mockResolvedValue([
      {
        id: "p2",
        staffId: "s2",
        isLocked: false,
        presentDays: 5, // will change to 1
        totalDays: 30,
        refundOfAdvance: 500,
        bonusAmount: 0,
        bonusDays: 0,
        bonusType: "CUSTOM",
        isBonusPfApplicable: false,
        payGroup: "CASH",
        staff: {
          createdAt: new Date("2026-01-01"),
          payrollInfo: {
            doj: new Date("2026-01-01"),
            monthlyCtc: 15000,
            payGroup: "CASH",
          },
        },
      },
    ]);

    mockPrisma.dailyRecord.findMany.mockResolvedValue([
      {
        date: new Date(2026, 10, 5), // Nov 5
        status: "PRESENT",
      },
    ]);

    const req = new Request("http://localhost/api/payroll/sync", {
      method: "POST",
      body: JSON.stringify({ month: 11, year: 2026 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json).toEqual({ success: true, updatedCount: 1 });

    expect(mockPrisma.monthlyPayroll.update).toHaveBeenCalledWith({
      where: { id: "p2" },
      data: expect.objectContaining({
        presentDays: 1,
        payGroup: "CASH",
        basicWage: 500, // 15000 / 30 = 500 per day * 1 day
        grossWage: 500,
        actualCtc: 500,
        netPayment: 0, // 500 gross - 500 refund
        epfWages: 0,
        epsWages: 0,
        edliWages: 0,
        employeeEpf: 0,
        employerEps: 0,
        employerEpf: 0,
      }),
    });
  });

  it("recalculates when payGroup in payrollInfo changed from BANK_EPF to CASH even if presentDays is unchanged", async () => {
    mockPrisma.monthlyPayroll.findMany.mockResolvedValue([
      {
        id: "p3",
        staffId: "s3",
        isLocked: false,
        presentDays: 1,
        totalDays: 30,
        refundOfAdvance: 0,
        bonusAmount: 0,
        bonusDays: 0,
        bonusType: "CUSTOM",
        isBonusPfApplicable: false,
        payGroup: "BANK_EPF", // Was BANK_EPF in monthly payroll
        staff: {
          createdAt: new Date("2026-01-01"),
          payrollInfo: {
            doj: new Date("2026-01-01"),
            monthlyCtc: 15000,
            payGroup: "CASH", // Now changed to CASH
          },
        },
      },
    ]);

    mockPrisma.dailyRecord.findMany.mockResolvedValue([
      {
        date: new Date(2026, 10, 1),
        status: "PRESENT",
      },
    ]);

    const req = new Request("http://localhost/api/payroll/sync", {
      method: "POST",
      body: JSON.stringify({ month: 11, year: 2026 }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json).toEqual({ success: true, updatedCount: 1 });

    expect(mockPrisma.monthlyPayroll.update).toHaveBeenCalledWith({
      where: { id: "p3" },
      data: expect.objectContaining({
        payGroup: "CASH",
        employeeEpf: 0,
        epfWages: 0,
      }),
    });
  });
});
