import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  staff: {
    findUnique: vi.fn(),
  },
  attendanceLog: {
    create: vi.fn(),
  },
  monthlyPayroll: {
    findUnique: vi.fn(),
  },
  unmatchedPunch: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
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

const mockRecalculateAttendance = vi.hoisted(() => vi.fn().mockResolvedValue(1));
vi.mock("@/lib/attendance", () => ({
  recalculateAttendance: mockRecalculateAttendance,
}));

import { getServerSession } from "next-auth/next";
import { GET } from "./route";
import { POST as resolvePost } from "./[id]/resolve/route";

const session = vi.mocked(getServerSession);

describe("GET /api/punches/unmatched", () => {
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

  it("rejects unauthenticated user with 401", async () => {
    session.mockResolvedValue(null as never);
    const req = new Request("http://localhost/api/punches/unmatched");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("rejects EMPLOYEE role with 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-emp",
      name: "Employee User",
      role: "EMPLOYEE",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    });
    session.mockResolvedValue({ user: { id: "u-emp", role: "EMPLOYEE" } } as never);

    const req = new Request("http://localhost/api/punches/unmatched");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("rejects APPROVER role with 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-appr",
      name: "Approver User",
      role: "APPROVER",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    });
    session.mockResolvedValue({ user: { id: "u-appr", role: "APPROVER" } } as never);

    const req = new Request("http://localhost/api/punches/unmatched");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("defaults to returning PENDING unmatched punches ordered by timestamp desc", async () => {
    mockPrisma.unmatchedPunch.findMany.mockResolvedValue([
      { id: "p1", machineId: "999", timestamp: new Date(), type: "IN", reason: "UNKNOWN_ID", resolvedAt: null },
    ]);

    const req = new Request("http://localhost/api/punches/unmatched");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(mockPrisma.unmatchedPunch.findMany).toHaveBeenCalledWith({
      where: { resolvedAt: null },
      orderBy: { timestamp: "desc" },
    });
  });

  it("returns RESOLVED unmatched punches when status=RESOLVED", async () => {
    mockPrisma.unmatchedPunch.findMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/punches/unmatched?status=RESOLVED");
    const res = await GET(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.unmatchedPunch.findMany).toHaveBeenCalledWith({
      where: { NOT: { resolvedAt: null } },
      orderBy: { timestamp: "desc" },
    });
  });

  it("returns ALL unmatched punches when status=ALL", async () => {
    mockPrisma.unmatchedPunch.findMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/punches/unmatched?status=ALL");
    const res = await GET(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.unmatchedPunch.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { timestamp: "desc" },
    });
  });
});

describe("POST /api/punches/unmatched/[id]/resolve", () => {
  const punchDate = new Date("2026-11-08T09:30:00.000Z");

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

  it("rejects non-admin role with 403", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "u-emp",
      name: "Employee User",
      role: "EMPLOYEE",
      disabledAt: null,
      mustChangePassword: false,
      staff: null,
      approverDepartments: [],
    });
    session.mockResolvedValue({ user: { id: "u-emp", role: "EMPLOYEE" } } as never);

    const req = new Request("http://localhost/api/punches/unmatched/p1/resolve", {
      method: "POST",
      body: JSON.stringify({ action: "DISMISS" }),
    });
    const res = await resolvePost(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when punch record is not found", async () => {
    mockPrisma.unmatchedPunch.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/punches/unmatched/non-existent/resolve", {
      method: "POST",
      body: JSON.stringify({ action: "DISMISS" }),
    });
    const res = await resolvePost(req, { params: Promise.resolve({ id: "non-existent" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when punch record is already resolved", async () => {
    mockPrisma.unmatchedPunch.findUnique.mockResolvedValue({
      id: "p1",
      machineId: "999",
      timestamp: punchDate,
      type: "IN",
      reason: "UNKNOWN_ID",
      resolvedAt: new Date(),
    });

    const req = new Request("http://localhost/api/punches/unmatched/p1/resolve", {
      method: "POST",
      body: JSON.stringify({ action: "DISMISS" }),
    });
    const res = await resolvePost(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/already resolved/i);
  });

  it("returns 400 when action is invalid", async () => {
    mockPrisma.unmatchedPunch.findUnique.mockResolvedValue({
      id: "p1",
      machineId: "999",
      timestamp: punchDate,
      type: "IN",
      reason: "UNKNOWN_ID",
      resolvedAt: null,
    });

    const req = new Request("http://localhost/api/punches/unmatched/p1/resolve", {
      method: "POST",
      body: JSON.stringify({ action: "INVALID" }),
    });
    const res = await resolvePost(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(400);
  });

  it("resolves via DISMISS action, updates record and creates AuditLog", async () => {
    mockPrisma.unmatchedPunch.findUnique.mockResolvedValue({
      id: "p1",
      machineId: "999",
      timestamp: punchDate,
      type: "IN",
      reason: "UNKNOWN_ID",
      resolvedAt: null,
    });
    mockPrisma.unmatchedPunch.update.mockResolvedValue({ id: "p1", resolution: "DISMISSED" });

    const req = new Request("http://localhost/api/punches/unmatched/p1/resolve", {
      method: "POST",
      body: JSON.stringify({ action: "DISMISS" }),
    });
    const res = await resolvePost(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);

    expect(mockPrisma.unmatchedPunch.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({
        resolvedAt: expect.any(Date),
        resolvedByUserId: "u-admin",
        resolution: "DISMISSED",
      }),
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "u-admin",
        action: "UNMATCHED_PUNCH_DISMISSED",
        targetType: "UnmatchedPunch",
        targetId: "p1",
      }),
    });

    expect(mockPrisma.attendanceLog.create).not.toHaveBeenCalled();
    expect(mockRecalculateAttendance).not.toHaveBeenCalled();
  });

  it("resolves via ATTACH action: creates AttendanceLog, updates record, logs audit and triggers recalculation", async () => {
    mockPrisma.unmatchedPunch.findUnique.mockResolvedValue({
      id: "p1",
      machineId: "999",
      timestamp: punchDate,
      type: "IN",
      reason: "UNKNOWN_ID",
      resolvedAt: null,
      attachedStaffId: null,
    });
    mockPrisma.staff.findUnique.mockResolvedValue({
      id: "staff-1",
      name: "Priya Sharma",
    });

    const req = new Request("http://localhost/api/punches/unmatched/p1/resolve", {
      method: "POST",
      body: JSON.stringify({ action: "ATTACH", staffId: "staff-1" }),
    });
    const res = await resolvePost(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);

    expect(mockPrisma.attendanceLog.create).toHaveBeenCalledWith({
      data: {
        staffId: "staff-1",
        timestamp: punchDate,
        type: "IN",
      },
    });

    expect(mockPrisma.unmatchedPunch.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: expect.objectContaining({
        resolvedAt: expect.any(Date),
        resolvedByUserId: "u-admin",
        resolution: "ATTACHED",
        attachedStaffId: "staff-1",
      }),
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: "u-admin",
        action: "UNMATCHED_PUNCH_ATTACHED",
        targetType: "UnmatchedPunch",
        targetId: "p1",
      }),
    });

    expect(mockRecalculateAttendance).toHaveBeenCalledTimes(1);
  });

  it("returns 400 for ATTACH action if no staffId provided and punch has no attachedStaffId", async () => {
    mockPrisma.unmatchedPunch.findUnique.mockResolvedValue({
      id: "p1",
      machineId: "999",
      timestamp: punchDate,
      type: "IN",
      reason: "UNKNOWN_ID",
      resolvedAt: null,
      attachedStaffId: null,
    });

    const req = new Request("http://localhost/api/punches/unmatched/p1/resolve", {
      method: "POST",
      body: JSON.stringify({ action: "ATTACH" }),
    });
    const res = await resolvePost(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 for ATTACH action if specified staff does not exist", async () => {
    mockPrisma.unmatchedPunch.findUnique.mockResolvedValue({
      id: "p1",
      machineId: "999",
      timestamp: punchDate,
      type: "IN",
      reason: "UNKNOWN_ID",
      resolvedAt: null,
      attachedStaffId: null,
    });
    mockPrisma.staff.findUnique.mockResolvedValue(null);

    const req = new Request("http://localhost/api/punches/unmatched/p1/resolve", {
      method: "POST",
      body: JSON.stringify({ action: "ATTACH", staffId: "missing-staff" }),
    });
    const res = await resolvePost(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(404);
  });
});
