import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureSchoolTimezone } from "@/lib/timezone";
import { createFakePrisma } from "@/test-utils/fake-prisma";

const holder = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return holder.client;
  },
}));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { GET } from "./route";

const sessionMock = vi.mocked(getServerSession);

beforeAll(() => {
  ensureSchoolTimezone();
});

const D1 = { id: "d1", name: "High School" };
const D2 = { id: "d2", name: "Primary School" };

const STAFF1 = {
  id: "s1",
  name: "Amit Patel",
  employeeCode: "TCH001",
  machineId: "201",
  shiftId: null,
  shift: null,
  departmentId: "d1",
  department: D1,
  employmentPeriods: [{ startDate: "2024-01-01", endDate: null }],
};

const STAFF2 = {
  id: "s2",
  name: "Pooja Verma",
  employeeCode: "TCH002",
  machineId: "202",
  shiftId: null,
  shift: null,
  departmentId: "d2",
  department: D2,
  employmentPeriods: [{ startDate: "2024-01-01", endDate: null }],
};

const USERS = [
  {
    id: "u-admin",
    name: "Admin User",
    email: "admin@school.com",
    role: "ADMIN",
    staffId: null,
  },
  {
    id: "u-approver-d1",
    name: "Approver D1",
    email: "approver@school.com",
    role: "APPROVER",
    staffId: null,
    approvesAllDepartments: false,
    approverDepartments: [{ departmentId: "d1" }],
  },
  {
    id: "u-emp1",
    name: "Amit Patel",
    email: "amit@school.com",
    role: "EMPLOYEE",
    staffId: "s1",
    staff: STAFF1,
  },
];

describe("GET /api/employee/to-school", () => {
  beforeEach(() => {
    const f = createFakePrisma({
      staff: [STAFF1, STAFF2],
      policy: null,
      holidays: [],
      lockedPayrolls: [],
      logs: [],
      users: USERS,
      dailyRecords: [
        {
          id: "dr-1",
          staffId: "s1",
          date: new Date("2026-09-01T00:00:00+05:30"),
          status: "PRESENT",
          workMinutes: 480,
          checkIn: new Date("2026-09-01T08:50:00+05:30"),
          checkOut: new Date("2026-09-01T16:50:00+05:30"),
        },
      ],
    });
    holder.client = f.client;
  });

  it("returns 401 when unauthenticated", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/employee/to-school");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns calendar data for authenticated EMPLOYEE querying their own staff record", async () => {
    sessionMock.mockResolvedValueOnce({
      user: { id: "u-emp1", role: "EMPLOYEE", staffId: "s1" },
    } as unknown as Session);

    const req = new Request("http://localhost/api/employee/to-school?month=9&year=2026");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.staff.id).toBe("s1");
    expect(json.data.month).toBe(9);
    expect(json.data.year).toBe(2026);
    expect(json.data.days).toHaveLength(30);
  });

  it("returns 403 when EMPLOYEE attempts to query another staff member", async () => {
    sessionMock.mockResolvedValueOnce({
      user: { id: "u-emp1", role: "EMPLOYEE", staffId: "s1" },
    } as unknown as Session);

    const req = new Request("http://localhost/api/employee/to-school?staffId=s2&month=9&year=2026");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("allows APPROVER to query staff within their assigned department", async () => {
    sessionMock.mockResolvedValueOnce({
      user: {
        id: "u-approver-d1",
        role: "APPROVER",
        staffId: null,
        approvesAllDepartments: false,
        approverDepartments: [{ departmentId: "d1" }],
      },
    } as unknown as Session);

    const req = new Request("http://localhost/api/employee/to-school?staffId=s1&month=9&year=2026");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.staff.id).toBe("s1");
  });

  it("returns 403 when APPROVER queries staff outside their assigned department", async () => {
    sessionMock.mockResolvedValueOnce({
      user: {
        id: "u-approver-d1",
        role: "APPROVER",
        staffId: null,
        approvesAllDepartments: false,
        approverDepartments: [{ departmentId: "d1" }],
      },
    } as unknown as Session);

    const req = new Request("http://localhost/api/employee/to-school?staffId=s2&month=9&year=2026");
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("allows ADMIN to query any staff member", async () => {
    sessionMock.mockResolvedValueOnce({
      user: { id: "u-admin", role: "ADMIN" },
    } as unknown as Session);

    const req = new Request("http://localhost/api/employee/to-school?staffId=s2&month=9&year=2026");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.staff.id).toBe("s2");
  });

  it("returns 400 for invalid month parameter", async () => {
    sessionMock.mockResolvedValueOnce({
      user: { id: "u-emp1", role: "EMPLOYEE", staffId: "s1" },
    } as unknown as Session);

    const req = new Request("http://localhost/api/employee/to-school?month=13&year=2026");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });
});
