import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  staff: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  employmentPeriod: {
    update: vi.fn(),
    create: vi.fn(),
  },
  shift: {
    findUnique: vi.fn(),
  },
  shiftAssignment: {
    upsert: vi.fn(),
  },
  staffPayrollInfo: {
    upsert: vi.fn(),
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

describe("POST /api/staff/[id]/lifecycle", () => {
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
    mockPrisma.staff.findMany.mockResolvedValue([]);
    session.mockResolvedValue({ user: { id: "u-admin", role: "ADMIN" } } as never);
  });

  const createRequest = (id: string, body: unknown) =>
    POST(
      new Request(`http://localhost/api/staff/${id}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id }) }
    );

  it("returns 401 when not authenticated", async () => {
    session.mockResolvedValue(null);
    const res = await createRequest("s1", { action: "EXIT" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not ADMIN", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-emp",
      name: "Emp",
      role: "EMPLOYEE",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    });
    session.mockResolvedValue({ user: { id: "u-emp", role: "EMPLOYEE" } } as never);
    const res = await createRequest("s1", { action: "EXIT" });
    expect(res.status).toBe(403);
  });

  it("returns 404 when staff is not found", async () => {
    mockPrisma.staff.findUnique.mockResolvedValue(null);
    const res = await createRequest("s-missing", {
      action: "EXIT",
      lastWorkingDay: "2026-11-01",
      exitReason: "RESIGNED",
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when action is unsupported", async () => {
    mockPrisma.staff.findUnique.mockResolvedValue({
      id: "s1",
      name: "Alice",
      employmentPeriods: [],
      user: null,
    });
    const res = await createRequest("s1", { action: "SUSPEND" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("action");
  });

  describe("action: EXIT", () => {
    it("returns 400 when lastWorkingDay is missing or invalid date", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Alice",
        employmentPeriods: [{ id: "ep1", startDate: "2024-01-01", endDate: null }],
        user: null,
      });

      const resMissing = await createRequest("s1", { action: "EXIT", exitReason: "RESIGNED" });
      expect(resMissing.status).toBe(400);

      const resInvalid = await createRequest("s1", {
        action: "EXIT",
        lastWorkingDay: "not-a-date",
        exitReason: "RESIGNED",
      });
      expect(resInvalid.status).toBe(400);
    });

    it("returns 400 when exitReason is missing", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Alice",
        employmentPeriods: [{ id: "ep1", startDate: "2024-01-01", endDate: null }],
        user: null,
      });

      const res = await createRequest("s1", { action: "EXIT", lastWorkingDay: "2026-11-08" });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/reason/i);
    });

    it("returns 400 when staff has no active employment period", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Alice",
        employmentPeriods: [{ id: "ep1", startDate: "2024-01-01", endDate: "2024-12-31" }],
        user: null,
      });

      const res = await createRequest("s1", {
        action: "EXIT",
        lastWorkingDay: "2026-11-08",
        exitReason: "RESIGNED",
      });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/active employment period/i);
    });

    it("returns 400 when lastWorkingDay is before the active period startDate", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Alice",
        employmentPeriods: [{ id: "ep1", startDate: "2025-01-01", endDate: null }],
        user: null,
      });

      const res = await createRequest("s1", {
        action: "EXIT",
        lastWorkingDay: "2024-12-31",
        exitReason: "RESIGNED",
      });
      expect(res.status).toBe(400);
    });

    it("successfully exits staff and disables linked user when lastWorkingDay <= today", async () => {
      const activePeriod = { id: "ep1", startDate: "2024-01-01", endDate: null };
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Alice",
        employmentPeriods: [activePeriod],
        user: { id: "u-alice", disabledAt: null },
      });
      mockPrisma.employmentPeriod.update.mockResolvedValue({
        ...activePeriod,
        endDate: "2026-11-08",
        exitReason: "RESIGNED",
        notes: "Relocating",
      });

      const res = await createRequest("s1", {
        action: "EXIT",
        lastWorkingDay: "2026-11-08",
        exitReason: "RESIGNED",
        notes: "Relocating",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockPrisma.employmentPeriod.update).toHaveBeenCalledWith({
        where: { id: "ep1" },
        data: {
          endDate: "2026-11-08",
          exitReason: "RESIGNED",
          notes: "Relocating",
        },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u-alice" },
        data: { disabledAt: expect.any(Date) },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "STAFF_EXIT",
          targetType: "Staff",
          targetId: "s1",
          actorUserId: "u-admin",
        }),
      });
    });
  });

  describe("action: REJOIN", () => {
    it("returns 400 when joiningDate is missing or invalid date", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Bob",
        employmentPeriods: [{ id: "ep1", startDate: "2024-01-01", endDate: "2024-12-31" }],
        user: null,
      });

      const resMissing = await createRequest("s1", { action: "REJOIN" });
      expect(resMissing.status).toBe(400);

      const resInvalid = await createRequest("s1", { action: "REJOIN", joiningDate: "invalid" });
      expect(resInvalid.status).toBe(400);
    });

    it("returns 400 when staff already has an active open employment period", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Bob",
        employmentPeriods: [{ id: "ep1", startDate: "2024-01-01", endDate: null }],
        user: null,
      });

      const res = await createRequest("s1", { action: "REJOIN", joiningDate: "2026-11-08" });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/active employment period/i);
    });

    it("returns 400 when joiningDate is not strictly after previous period endDate", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Bob",
        employmentPeriods: [{ id: "ep1", startDate: "2024-01-01", endDate: "2025-06-30" }],
        user: null,
      });

      const resSame = await createRequest("s1", { action: "REJOIN", joiningDate: "2025-06-30" });
      expect(resSame.status).toBe(400);

      const resEarlier = await createRequest("s1", { action: "REJOIN", joiningDate: "2025-05-01" });
      expect(resEarlier.status).toBe(400);
    });

    it("successfully rejoins staff, creates period, re-enables user with temp password, and creates audit log", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Bob",
        shiftId: null,
        employmentPeriods: [{ id: "ep1", startDate: "2024-01-01", endDate: "2024-12-31" }],
        user: { id: "u-bob", disabledAt: new Date("2024-12-31") },
      });
      mockPrisma.employmentPeriod.create.mockResolvedValue({
        id: "ep2",
        staffId: "s1",
        startDate: "2026-01-01",
        endDate: null,
      });
      mockPrisma.staff.update.mockResolvedValue({
        id: "s1",
        name: "Bob",
        departmentId: "d1",
        designationId: "des1",
        shiftId: "sh1",
      });

      const res = await createRequest("s1", {
        action: "REJOIN",
        joiningDate: "2026-01-01",
        departmentId: "d1",
        designationId: "des1",
        shiftId: "sh1",
        payGroup: "BANK_EPF",
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(typeof json.temporaryPassword).toBe("string");
      expect(json.temporaryPassword.length).toBeGreaterThanOrEqual(8);

      expect(mockPrisma.employmentPeriod.create).toHaveBeenCalledWith({
        data: {
          staffId: "s1",
          startDate: "2026-01-01",
          endDate: null,
          createdByUserId: "u-admin",
        },
      });

      expect(mockPrisma.shiftAssignment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { staffId_effectiveFrom: { staffId: "s1", effectiveFrom: "2026-01-01" } },
          create: expect.objectContaining({
            staffId: "s1",
            shiftId: "sh1",
            effectiveFrom: "2026-01-01",
            source: "REJOIN",
          }),
        })
      );

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u-bob" },
        data: expect.objectContaining({
          disabledAt: null,
          mustChangePassword: true,
          password: expect.any(String),
        }),
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "STAFF_REJOIN",
          targetType: "Staff",
          targetId: "s1",
          actorUserId: "u-admin",
        }),
      });
    });

    it("returns 409 when new machineId on REJOIN collides with another staff", async () => {
      mockPrisma.staff.findUnique.mockImplementation(async ({ where }: any) => {
        if (where?.id === "s1") {
          return {
            id: "s1",
            machineId: "101",
            name: "Bob",
            employmentPeriods: [{ id: "ep1", startDate: "2024-01-01", endDate: "2024-12-31" }],
            user: null,
          };
        }
        if (where?.machineId === "999") {
          return { id: "s-other", machineId: "999", name: "Other" };
        }
        return null;
      });

      const res = await createRequest("s1", {
        action: "REJOIN",
        joiningDate: "2026-06-01",
        machineId: "999",
      });
      expect(res.status).toBe(409);
      expect((await res.json()).error).toMatch(/machine id is already in use/i);
    });

    it("updates machineId on REJOIN when a new machineId is provided without collision", async () => {
      mockPrisma.staff.findUnique.mockImplementation(async ({ where }: any) => {
        if (where?.id === "s1") {
          return {
            id: "s1",
            machineId: "101",
            name: "Bob",
            employmentPeriods: [{ id: "ep1", startDate: "2024-01-01", endDate: "2024-12-31" }],
            user: null,
          };
        }
        return null;
      });

      const res = await createRequest("s1", {
        action: "REJOIN",
        joiningDate: "2026-06-01",
        machineId: "108",
      });
      expect(res.status).toBe(200);
      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: expect.objectContaining({ machineId: "108" }),
      });
    });
  });

  describe("action: RESET_PASSWORD", () => {
    it("generates a new temporary password, ensures employeeCode, updates or creates linked user, and logs PASSWORD_RESET", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "s1",
        name: "Kiran Verma",
        machineId: "105",
        employeeCode: null,
        joiningDate: null,
        employmentPeriods: [],
        user: null,
      });
      mockPrisma.staff.findMany.mockResolvedValue([{ employeeCode: "SAR-2024-004" }]);
      mockPrisma.staff.update.mockResolvedValue({
        id: "s1",
        name: "Kiran Verma",
        employeeCode: "SAR-2024-005",
        joiningDate: "2024-07-01",
      });

      const res = await createRequest("s1", {
        action: "RESET_PASSWORD",
        joiningDate: "2024-07-01",
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.employeeCode).toBe("SAR-2024-005");
      expect(typeof data.temporaryPassword).toBe("string");
      expect(data.temporaryPassword.length).toBeGreaterThanOrEqual(8);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Kiran Verma",
          role: "EMPLOYEE",
          mustChangePassword: true,
          staffId: "s1",
        }),
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "PASSWORD_RESET",
          targetType: "Staff",
          targetId: "s1",
        }),
      });
    });
  });
});
