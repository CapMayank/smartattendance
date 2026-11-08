import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
  staff: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  attendanceLog: {
    count: vi.fn(),
  },
  dailyRecord: {
    count: vi.fn(),
  },
  monthlyPayroll: {
    count: vi.fn(),
  },
  shiftAssignment: {
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  employmentPeriod: {
    deleteMany: vi.fn(),
  },
  staffPayrollInfo: {
    deleteMany: vi.fn(),
  },
  payGroupChange: {
    deleteMany: vi.fn(),
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
import { DELETE as deleteStaff } from "./route";
import { DELETE as deleteStaffBulk } from "./bulk/route";

const session = vi.mocked(getServerSession);

describe("Staff Deletion Guard", () => {
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

    mockPrisma.attendanceLog.count.mockResolvedValue(0);
    mockPrisma.dailyRecord.count.mockResolvedValue(0);
    mockPrisma.monthlyPayroll.count.mockResolvedValue(0);
    mockPrisma.shiftAssignment.count.mockResolvedValue(1); // initial shift assignment
  });

  describe("DELETE /api/staff?id=...", () => {
    it("returns 409 Conflict if staff has attendance logs", async () => {
      mockPrisma.attendanceLog.count.mockResolvedValue(5);
      mockPrisma.staff.findUnique.mockResolvedValue({ id: "s1", name: "Alice" });

      const req = new Request("http://localhost/api/staff?id=s1", { method: "DELETE" });
      const res = await deleteStaff(req);

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/Cannot delete staff member with attendance or payroll history. Use Exit instead./i);
      expect(mockPrisma.staff.delete).not.toHaveBeenCalled();
    });

    it("returns 409 Conflict if staff has daily records", async () => {
      mockPrisma.dailyRecord.count.mockResolvedValue(3);
      mockPrisma.staff.findUnique.mockResolvedValue({ id: "s1", name: "Alice" });

      const req = new Request("http://localhost/api/staff?id=s1", { method: "DELETE" });
      const res = await deleteStaff(req);

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/Cannot delete staff member with attendance or payroll history. Use Exit instead./i);
      expect(mockPrisma.staff.delete).not.toHaveBeenCalled();
    });

    it("returns 409 Conflict if staff has monthly payroll records", async () => {
      mockPrisma.monthlyPayroll.count.mockResolvedValue(1);
      mockPrisma.staff.findUnique.mockResolvedValue({ id: "s1", name: "Alice" });

      const req = new Request("http://localhost/api/staff?id=s1", { method: "DELETE" });
      const res = await deleteStaff(req);

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/Cannot delete staff member with attendance or payroll history. Use Exit instead./i);
      expect(mockPrisma.staff.delete).not.toHaveBeenCalled();
    });

    it("returns 409 Conflict if staff has more than 1 shift assignment (shift history)", async () => {
      mockPrisma.shiftAssignment.count.mockResolvedValue(2);
      mockPrisma.staff.findUnique.mockResolvedValue({ id: "s1", name: "Alice" });

      const req = new Request("http://localhost/api/staff?id=s1", { method: "DELETE" });
      const res = await deleteStaff(req);

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/Cannot delete staff member with attendance or payroll history. Use Exit instead./i);
      expect(mockPrisma.staff.delete).not.toHaveBeenCalled();
    });

    it("allows deletion if staff has no history (e.g. duplicate created by mistake)", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({ id: "s1", name: "Alice" });

      const req = new Request("http://localhost/api/staff?id=s1", { method: "DELETE" });
      const res = await deleteStaff(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(mockPrisma.shiftAssignment.deleteMany).toHaveBeenCalledWith({ where: { staffId: "s1" } });
      expect(mockPrisma.user.deleteMany).toHaveBeenCalledWith({ where: { staffId: "s1" } });
      expect(mockPrisma.employmentPeriod.deleteMany).toHaveBeenCalledWith({ where: { staffId: "s1" } });
      expect(mockPrisma.staffPayrollInfo.deleteMany).toHaveBeenCalledWith({ where: { staffId: "s1" } });
      expect(mockPrisma.staff.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    });
  });

  describe("DELETE /api/staff/bulk", () => {
    it("returns 409 Conflict if any staff member in the bulk list has history", async () => {
      mockPrisma.attendanceLog.count.mockImplementation(async (args: any) => {
        if (args?.where?.staffId === "s2" || args?.where?.staffId?.in?.includes("s2")) {
          return 4;
        }
        return 0;
      });

      const req = new Request("http://localhost/api/staff/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["s1", "s2"] }),
      });
      const res = await deleteStaffBulk(req);

      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toMatch(/Cannot delete staff member with attendance or payroll history. Use Exit instead./i);
      expect(mockPrisma.staff.deleteMany).not.toHaveBeenCalled();
    });

    it("deletes all selected staff if none of them have history", async () => {
      const req = new Request("http://localhost/api/staff/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["s1", "s2"] }),
      });
      const res = await deleteStaffBulk(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      expect(mockPrisma.staff.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["s1", "s2"] } },
      });
    });
  });
});
