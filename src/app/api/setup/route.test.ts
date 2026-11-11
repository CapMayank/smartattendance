import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  systemSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  staff: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  employmentPeriod: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  staffPayrollInfo: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
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
  $transaction: vi.fn(async (cb: any, _options?: any) => {
    if (typeof cb === "function") {
      return cb(mockPrisma);
    }
    return Promise.all(cb);
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "./route";

describe("/api/setup route", () => {
  const DEFAULT_SECRET = "intime-sarvodaya-setup-2026";

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SETUP_SECRET;
    delete process.env.INITIAL_SETUP_KEY;

    mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    // The selected administrator exists; no user owns a not-yet-used email
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) =>
      where.id === "u-admin-1" ? { id: "u-admin-1", role: "ADMIN", staffId: null } : null
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u-admin-1", name: "Administrator", email: "admin@sarvodaya.com", staffId: null },
    ]);
    mockPrisma.staff.findMany.mockResolvedValue([]);
    mockPrisma.systemSetting.upsert.mockResolvedValue({ key: "SETUP_COMPLETED", value: "true" });
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });
  });

  describe("GET /api/setup", () => {
    it("reports setup as incomplete without exposing admin or staff lists", async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);

      const res = await GET();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data).toEqual({ setupCompleted: false, requiresSecret: true });
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.staff.findMany).not.toHaveBeenCalled();
    });

    it("returns setupCompleted: true and requiresSecret: false when setup is complete", async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        id: "s-1",
        key: "SETUP_COMPLETED",
        value: "true",
      });

      const res = await GET();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.setupCompleted).toBe(true);
      expect(data.requiresSecret).toBe(false);
    });
  });

  describe("POST /api/setup", () => {
    it("VERIFY returns admin users and staff only when the secret is correct", async () => {
      const bad = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({ secret: "wrong-secret", action: "VERIFY" }),
        })
      );
      expect(bad.status).toBe(401);
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled();

      const good = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({ secret: DEFAULT_SECRET, action: "VERIFY" }),
        })
      );
      expect(good.status).toBe(200);
      const data = await good.json();
      expect(data.adminUsers).toEqual([
        { id: "u-admin-1", name: "Administrator", email: "admin@sarvodaya.com", staffId: null },
      ]);
      expect(data.existingStaff).toEqual([]);
      // Verifying must not complete setup
      expect(mockPrisma.systemSetting.upsert).not.toHaveBeenCalled();
    });

    it("fresh install: creates the administrator login when no admin user exists", async () => {
      mockPrisma.staff.create.mockResolvedValue({ id: "staff-new-admin", name: "Main Admin", machineId: "999" });

      const res = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({
            secret: DEFAULT_SECRET,
            adminAction: "CREATE",
            adminAccount: { email: "Head@School.org", password: "a-strong-password" },
            adminProfile: { name: "Main Admin", machineId: "999", joiningDate: "2024-01-15" },
          }),
        })
      );

      expect(res.status).toBe(200);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
      const created = mockPrisma.user.create.mock.calls[0][0].data;
      expect(created.email).toBe("head@school.org");
      expect(created.role).toBe("ADMIN");
      expect(created.staffId).toBe("staff-new-admin");
      expect(created.mustChangePassword).toBe(false);
      // Stored as a bcrypt hash, never the plain password
      expect(created.password).not.toBe("a-strong-password");
      expect(created.password).toMatch(/^\$2[aby]\$/);
    });

    it("rejects setup with neither an administrator user nor new account details", async () => {
      const res = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({
            secret: DEFAULT_SECRET,
            adminAction: "CREATE",
            adminProfile: { name: "Main Admin", machineId: "999", joiningDate: "2024-01-15" },
          }),
        })
      );
      expect(res.status).toBe(400);
      expect(mockPrisma.systemSetting.upsert).not.toHaveBeenCalled();
    });

    it("rejects a weak administrator password", async () => {
      const res = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({
            secret: DEFAULT_SECRET,
            adminAction: "CREATE",
            adminAccount: { email: "head@school.org", password: "short" },
            adminProfile: { name: "Main Admin", machineId: "999", joiningDate: "2024-01-15" },
          }),
        })
      );
      expect(res.status).toBe(400);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("returns 401 when the secret code is invalid", async () => {
      const res = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({
            secret: "wrong-secret",
            adminAction: "LINK",
            adminUserId: "u-admin-1",
            existingStaffId: "staff-1",
          }),
        })
      );

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toMatch(/Invalid setup secret code/i);
    });

    it("returns 400 when setup is already completed", async () => {
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        id: "s-1",
        key: "SETUP_COMPLETED",
        value: "true",
      });

      const res = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({
            secret: DEFAULT_SECRET,
            adminAction: "LINK",
            adminUserId: "u-admin-1",
            existingStaffId: "staff-1",
          }),
        })
      );

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Setup already completed/i);
    });

    it("creates an admin staff profile, links admin user, and locks setup (adminAction: 'CREATE')", async () => {
      mockPrisma.staff.findMany.mockResolvedValue([]);
      mockPrisma.staff.create.mockResolvedValue({
        id: "staff-new-admin",
        name: "Main Admin",
        machineId: "999",
        employeeCode: "SAR-2024-001",
        joiningDate: "2024-01-15",
      });
      mockPrisma.employmentPeriod.create.mockResolvedValue({ id: "ep-1" });
      mockPrisma.staffPayrollInfo.create.mockResolvedValue({ id: "spi-1" });
      mockPrisma.user.update.mockResolvedValue({ id: "u-admin-1", staffId: "staff-new-admin" });

      const res = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({
            secret: DEFAULT_SECRET,
            adminAction: "CREATE",
            adminUserId: "u-admin-1",
            adminProfile: {
              name: "Main Admin",
              machineId: "999",
              joiningDate: "2024-01-15",
              payGroup: "BANK_EPF",
            },
          }),
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      // Verify staff creation
      expect(mockPrisma.staff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Main Admin",
          machineId: "999",
          employeeCode: "SAR-2024-001",
          joiningDate: "2024-01-15",
        }),
      });

      // Verify employment period creation
      expect(mockPrisma.employmentPeriod.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          staffId: "staff-new-admin",
          startDate: "2024-01-15",
          createdByUserId: "u-admin-1",
        }),
      });

      // Verify payroll info creation
      expect(mockPrisma.staffPayrollInfo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          staffId: "staff-new-admin",
          payGroup: "BANK_EPF",
        }),
      });

      // Verify user link
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u-admin-1" },
        data: { staffId: "staff-new-admin", role: "ADMIN" },
      });

      // Verify setup completion lock
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: "SETUP_COMPLETED" },
        update: { value: "true" },
        create: { key: "SETUP_COMPLETED", value: "true" },
      });

      // Verify audit log
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: "SYSTEM_SETUP_COMPLETED",
          actorUserId: "u-admin-1",
        }),
      });
    });

    it("links existing staff profile to admin user and locks setup (adminAction: 'LINK')", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "staff-existing-1",
        name: "Existing Person",
        machineId: "101",
        employeeCode: null,
        joiningDate: null,
      });
      mockPrisma.staff.findMany.mockResolvedValue([]);
      mockPrisma.staff.update.mockResolvedValue({
        id: "staff-existing-1",
        employeeCode: "SAR-2024-001",
        joiningDate: "2024-01-01",
      });
      mockPrisma.employmentPeriod.findFirst.mockResolvedValue(null);
      mockPrisma.employmentPeriod.create.mockResolvedValue({ id: "ep-1" });
      mockPrisma.staffPayrollInfo.findUnique.mockResolvedValue(null);
      mockPrisma.staffPayrollInfo.create.mockResolvedValue({ id: "spi-1" });
      mockPrisma.user.update.mockResolvedValue({ id: "u-admin-1", staffId: "staff-existing-1" });

      const res = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({
            secret: DEFAULT_SECRET,
            adminAction: "LINK",
            adminUserId: "u-admin-1",
            existingStaffId: "staff-existing-1",
          }),
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "u-admin-1" },
        data: { staffId: "staff-existing-1", role: "ADMIN" },
      });
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalled();
    });

    it("batches existing staff joining dates and generates employee codes and credentials", async () => {
      mockPrisma.staff.findUnique
        // First lookup: the admin's Machine ID is not taken yet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "staff-101",
          machineId: "101",
          name: "Ramesh Kumar",
          employeeCode: null,
          joiningDate: null,
          user: null,
        })
        .mockResolvedValueOnce({
          id: "staff-102",
          machineId: "102",
          name: "Suresh Sharma",
          employeeCode: null,
          joiningDate: null,
          user: null,
        });

      mockPrisma.staff.findMany.mockResolvedValue([]);
      mockPrisma.staff.update.mockImplementation(({ data }: any) => Promise.resolve(data));
      mockPrisma.employmentPeriod.findFirst.mockResolvedValue(null);
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const res = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({
            secret: DEFAULT_SECRET,
            adminAction: "CREATE",
            adminUserId: "u-admin-1",
            adminProfile: {
              name: "Admin",
              machineId: "999",
              joiningDate: "2024-01-01",
            },
            staffJoiningDates: [
              { machineId: "101", joiningDate: "2024-02-01", payGroup: "BANK_EPF" },
              { machineId: "102", joiningDate: "2024-03-01", payGroup: "CASH" },
            ],
          }),
        })
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.generatedCredentials).toBeDefined();
      expect(data.generatedCredentials.length).toBeGreaterThanOrEqual(2);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ timeout: 60000 })
      );
    });

    it("uses joiningDate and payGroup from staffJoiningDates when LINKed admin staff is also in the CSV batch", async () => {
      mockPrisma.staff.findUnique.mockResolvedValue({
        id: "staff-existing-1",
        name: "Existing Admin Staff",
        machineId: "101",
        employeeCode: null,
        joiningDate: null,
      });
      mockPrisma.staff.findMany.mockResolvedValue([]);
      mockPrisma.staff.update.mockImplementation(({ data }: any) => Promise.resolve(data));
      mockPrisma.employmentPeriod.findFirst.mockResolvedValue(null);
      mockPrisma.employmentPeriod.create.mockResolvedValue({ id: "ep-1" });
      mockPrisma.staffPayrollInfo.findUnique.mockResolvedValue(null);
      mockPrisma.staffPayrollInfo.create.mockResolvedValue({ id: "spi-1" });
      mockPrisma.staffPayrollInfo.upsert.mockResolvedValue({ id: "spi-1" });
      mockPrisma.user.update.mockResolvedValue({ id: "u-admin-1", staffId: "staff-existing-1" });
      mockPrisma.user.findFirst.mockResolvedValue({ id: "u-admin-1", staffId: "staff-existing-1" });

      const res = await POST(
        new Request("http://localhost/api/setup", {
          method: "POST",
          body: JSON.stringify({
            secret: DEFAULT_SECRET,
            adminAction: "LINK",
            adminUserId: "u-admin-1",
            existingStaffId: "staff-existing-1",
            staffJoiningDates: [
              { machineId: "101", joiningDate: "2022-06-15", payGroup: "CASH" },
            ],
          }),
        })
      );

      expect(res.status).toBe(200);
      expect(mockPrisma.staff.update).toHaveBeenCalledWith({
        where: { id: "staff-existing-1" },
        data: {
          joiningDate: "2022-06-15",
          employeeCode: "SAR-2022-001",
        },
      });
    });
  });
});
