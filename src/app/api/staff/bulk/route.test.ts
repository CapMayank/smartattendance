import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  staff: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  department: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  designation: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  shift: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  shiftAssignment: {
    create: vi.fn(),
  },
  employmentPeriod: {
    create: vi.fn(),
  },
  staffPayrollInfo: {
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

describe("POST /api/staff/bulk joining date requirement", () => {
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
    mockPrisma.department.findUnique.mockResolvedValue({ id: "d1", name: "IT" });
    mockPrisma.department.create.mockResolvedValue({ id: "d1", name: "IT" });
    mockPrisma.designation.findUnique.mockResolvedValue({ id: "des1", name: "Dev" });
    mockPrisma.designation.create.mockResolvedValue({ id: "des1", name: "Dev" });
    mockPrisma.shift.findFirst.mockResolvedValue({ id: "sh-default", name: "General Shift" });
    mockPrisma.shift.findMany.mockResolvedValue([{ id: "sh-default", name: "General Shift" }]);
  });

  it("returns 400 with itemized errors when a new machine ID row is missing joiningDate", async () => {
    mockPrisma.staff.findMany.mockResolvedValue([
      { id: "s1", machineId: "1001", shiftId: "sh-default" },
    ]);

    const req = new Request("http://localhost/api/staff/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          { Name: "Existing Member", "Machine ID": "1001", Department: "IT" }, // existing, no joiningDate needed
          { Name: "New Member 1", "Machine ID": "1002", Department: "Sales" }, // new, missing joiningDate!
          { Name: "New Member 2", "Machine ID": "1003", Department: "HR", "Joining Date": "invalid-date" }, // new, invalid joiningDate!
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.errors).toBeDefined();
    expect(json.errors).toHaveLength(2);
    expect(json.errors[0]).toEqual(
      expect.objectContaining({
        row: 2,
        machineId: "1002",
      })
    );
    expect(json.errors[1]).toEqual(
      expect.objectContaining({
        row: 3,
        machineId: "1003",
      })
    );
  });

  it("succeeds when all new rows have joiningDate and updates existing staff", async () => {
    mockPrisma.staff.findMany.mockResolvedValue([
      { id: "s1", machineId: "1001", shiftId: "sh-default" },
    ]);
    mockPrisma.staff.create.mockResolvedValue({
      id: "s2",
      name: "New Member",
      machineId: "1002",
      employeeCode: "SAR-2024-001",
      joiningDate: "2024-06-01",
    });

    const req = new Request("http://localhost/api/staff/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          { Name: "Existing Member Updated", "Machine ID": "1001", Department: "IT" },
          { Name: "New Member", "Machine ID": "1002", Department: "Sales", "Joining Date": "2024-06-01" },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.processedCount).toBe(2);

    expect(mockPrisma.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { machineId: "1001" },
        data: expect.objectContaining({ name: "Existing Member Updated" }),
      })
    );

    expect(mockPrisma.staff.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "New Member",
          machineId: "1002",
          joiningDate: "2024-06-01",
        }),
      })
    );
  });
});
