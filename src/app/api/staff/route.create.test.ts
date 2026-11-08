import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  staff: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  employmentPeriod: {
    create: vi.fn(),
  },
  staffPayrollInfo: {
    create: vi.fn(),
  },
  shift: {
    findUnique: vi.fn(),
  },
  shiftAssignment: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(async (cb: any) => {
    if (typeof cb === "function") {
      return cb(mockPrisma);
    }
    return Promise.all(cb);
  }),
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

describe("POST /api/staff creation flow", () => {
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
    mockPrisma.shift.findUnique.mockResolvedValue({ id: "sh1", name: "General" });
    session.mockResolvedValue({ user: { id: "u-admin", role: "ADMIN" } } as never);
  });

  it("returns 400 if name, machineId, or joiningDate is missing", async () => {
    const resNoName = await POST(
      new Request("http://localhost/api/staff", {
        method: "POST",
        body: JSON.stringify({ machineId: "101", joiningDate: "2024-06-01" }),
      })
    );
    expect(resNoName.status).toBe(400);

    const resNoMachine = await POST(
      new Request("http://localhost/api/staff", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", joiningDate: "2024-06-01" }),
      })
    );
    expect(resNoMachine.status).toBe(400);

    const resNoDate = await POST(
      new Request("http://localhost/api/staff", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", machineId: "101" }),
      })
    );
    expect(resNoDate.status).toBe(400);
  });

  it("returns 400 if joiningDate is not a valid YYYY-MM-DD date", async () => {
    const resInvalid = await POST(
      new Request("http://localhost/api/staff", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", machineId: "101", joiningDate: "not-a-date" }),
      })
    );
    expect(resInvalid.status).toBe(400);
  });

  it("returns 409 if machineId is already taken", async () => {
    mockPrisma.staff.findUnique.mockResolvedValue({ id: "existing-staff", machineId: "101" });
    const res = await POST(
      new Request("http://localhost/api/staff", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", machineId: "101", joiningDate: "2024-06-01" }),
      })
    );
    expect(res.status).toBe(409);
  });

  it("creates staff with generated employee code, employment period, payroll info, user, and audit log", async () => {
    mockPrisma.staff.findUnique.mockResolvedValue(null);
    mockPrisma.staff.findMany.mockResolvedValue([
      { employeeCode: "SAR-2024-001" },
      { employeeCode: "SAR-2024-002" },
    ]);
    mockPrisma.staff.create.mockResolvedValue({
      id: "s-new",
      name: "Alice",
      machineId: "101",
      employeeCode: "SAR-2024-003",
      joiningDate: "2024-06-01",
      departmentId: "d1",
      designationId: "des1",
      shiftId: "sh1",
    });

    const res = await POST(
      new Request("http://localhost/api/staff", {
        method: "POST",
        body: JSON.stringify({
          name: "Alice",
          machineId: "101",
          joiningDate: "2024-06-01",
          departmentId: "d1",
          designationId: "des1",
          shiftId: "sh1",
          payGroup: "CASH",
        }),
      })
    );

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("s-new");
    expect(json.employeeCode).toBe("SAR-2024-003");
    expect(typeof json.temporaryPassword).toBe("string");
    expect(json.temporaryPassword.length).toBeGreaterThanOrEqual(8);

    expect(mockPrisma.staff.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Alice",
        machineId: "101",
        employeeCode: "SAR-2024-003",
        joiningDate: "2024-06-01",
        departmentId: "d1",
        designationId: "des1",
        shiftId: "sh1",
      }),
    });

    expect(mockPrisma.employmentPeriod.create).toHaveBeenCalledWith({
      data: {
        staffId: "s-new",
        startDate: "2024-06-01",
        endDate: null,
        createdByUserId: "u-admin",
      },
    });

    expect(mockPrisma.staffPayrollInfo.create).toHaveBeenCalledWith({
      data: {
        staffId: "s-new",
        payGroup: "CASH",
      },
    });

    expect(mockPrisma.shiftAssignment.create).toHaveBeenCalledWith({
      data: {
        staffId: "s-new",
        shiftId: "sh1",
        effectiveFrom: "2024-06-01",
        source: "INITIAL",
        createdByUserId: "u-admin",
      },
    });

    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Alice",
        role: "EMPLOYEE",
        mustChangePassword: true,
        staffId: "s-new",
      }),
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "STAFF_JOIN",
        targetType: "Staff",
        targetId: "s-new",
        actorUserId: "u-admin",
      }),
    });
  });
});
