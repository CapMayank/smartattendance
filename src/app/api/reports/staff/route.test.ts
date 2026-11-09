import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  staff: {
    findMany: vi.fn(),
  },
  department: {
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
import { GET } from "./route";

const session = vi.mocked(getServerSession);

describe("GET /api/reports/staff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-admin",
      name: "Admin User",
      role: "ADMIN",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    });
    session.mockResolvedValue({ user: { id: "u-admin", role: "ADMIN" } } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    session.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is APPROVER or EMPLOYEE", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-app",
      name: "Approver User",
      role: "APPROVER",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    });
    session.mockResolvedValue({ user: { id: "u-app", role: "APPROVER" } } as never);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns structured members, exits, joinings, and department headcount", async () => {
    mockPrisma.department.findMany.mockResolvedValue([
      { id: "d-teach", name: "Teaching" },
      { id: "d-admin", name: "Administration" },
    ]);

    mockPrisma.staff.findMany.mockResolvedValue([
      {
        id: "s1",
        name: "Aman Gupta",
        machineId: "101",
        employeeCode: "SAR-2024-001",
        joiningDate: "2024-04-01",
        departmentId: "d-teach",
        department: { id: "d-teach", name: "Teaching" },
        designation: { name: "Senior Teacher" },
        user: { role: "EMPLOYEE", disabledAt: null, email: "aman@sarvodaya.edu" },
        payrollInfo: { payGroup: "BANK_EPF", mobileNumber: "9876543210" },
        employmentPeriods: [
          {
            id: "ep1",
            startDate: "2024-04-01",
            endDate: null,
            exitReason: null,
            notes: null,
          },
        ],
      },
      {
        id: "s2",
        name: "Pooja Verma",
        machineId: "102",
        employeeCode: "SAR-2023-005",
        joiningDate: "2023-01-15",
        departmentId: "d-admin",
        department: { id: "d-admin", name: "Administration" },
        designation: { name: "Accountant" },
        user: { role: "EMPLOYEE", disabledAt: new Date("2025-03-31") },
        payrollInfo: { payGroup: "CASH", mobileNumber: "9123456780" },
        employmentPeriods: [
          {
            id: "ep2",
            startDate: "2023-01-15",
            endDate: "2025-03-31",
            exitReason: "RESIGNATION",
            notes: "Relocated to Bhopal",
          },
        ],
      },
      {
        id: "s3",
        name: "Ramesh Sharma",
        machineId: "103",
        employeeCode: "SAR-2022-001",
        joiningDate: "2022-07-01",
        departmentId: "d-teach",
        department: { id: "d-teach", name: "Teaching" },
        designation: { name: "Lab Instructor" },
        user: { role: "EMPLOYEE", disabledAt: null },
        payrollInfo: { payGroup: "BANK_EPF" },
        employmentPeriods: [
          {
            id: "ep3-stint2",
            startDate: "2026-01-01",
            endDate: null,
            exitReason: null,
            notes: null,
          },
          {
            id: "ep3-stint1",
            startDate: "2022-07-01",
            endDate: "2024-12-31",
            exitReason: "PERSONAL",
            notes: "Higher studies",
          },
        ],
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.summary).toEqual({
      total: 3,
      active: 2,
      exited: 1,
      bankEpf: 2,
      cash: 1,
    });

    expect(data.members).toHaveLength(3);
    expect(data.members[0]).toMatchObject({
      id: "s1",
      name: "Aman Gupta",
      status: "ACTIVE",
      department: "Teaching",
    });

    // Exited list: s2 and s3 (its closed period)
    expect(data.exits).toHaveLength(2);
    expect(data.exits.map((e: any) => e.name)).toEqual(["Pooja Verma", "Ramesh Sharma"]);
    expect(data.exits[0]).toMatchObject({
      name: "Pooja Verma",
      exitReason: "RESIGNATION",
      notes: "Relocated to Bhopal",
    });

    // Joinings by year
    expect(data.joinings.length).toBeGreaterThanOrEqual(3);
    const years = data.joinings.map((j: any) => j.year);
    expect(years).toContain(2024);
    expect(years).toContain(2023);
    expect(years).toContain(2026);
    expect(years).toContain(2022);

    // Departments breakdown
    expect(data.departments).toHaveLength(2);
    const teachDept = data.departments.find((d: any) => d.name === "Teaching");
    expect(teachDept).toBeDefined();
    expect(teachDept?.activeStaff).toBe(2);
    expect(teachDept?.totalStaff).toBe(2);
  });
});
