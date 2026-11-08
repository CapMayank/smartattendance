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
  {
    id: "u-emp-nolink",
    name: "Unlinked Employee",
    email: "nolink@school.com",
    role: "EMPLOYEE",
    staffId: null,
  },
];

const SAMPLE_LOGS = [
  {
    id: "log-1",
    staffId: "s1",
    timestamp: new Date("2026-11-05T09:15:00+05:30"),
    type: "IN",
  },
  {
    id: "log-2",
    staffId: "s1",
    timestamp: new Date("2026-11-05T17:05:00+05:30"),
    type: "OUT",
  },
  {
    id: "log-3",
    staffId: "s1",
    timestamp: new Date("2026-11-06T09:02:00+05:30"),
    type: "IN",
  },
  {
    id: "log-4",
    staffId: "s1",
    timestamp: new Date("2026-11-06T16:55:00+05:30"),
    type: "OUT",
  },
  {
    id: "log-5",
    staffId: "s2",
    timestamp: new Date("2026-11-06T08:45:00+05:30"),
    type: "IN",
  },
];

describe("GET /api/employee/punches", () => {
  beforeEach(() => {
    const f = createFakePrisma({
      staff: [STAFF1, STAFF2],
      policy: null,
      holidays: [],
      lockedPayrolls: [],
      logs: [...SAMPLE_LOGS],
      users: USERS,
    });
    holder.client = f.client;
  });

  it("returns 401 when unauthenticated", async () => {
    sessionMock.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/employee/punches");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for employee with no linked staff profile", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[3],
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/No staff profile/i);
  });

  it("returns 403 when EMPLOYEE attempts to query another staff member", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[2],
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches?staffId=s2");
    const res = await GET(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Forbidden/i);
  });

  it("returns 200 with sorted punches for EMPLOYEE querying own records", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[2],
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.punches).toHaveLength(4);
    // Verified desc order by timestamp: log-4 (Nov 6 16:55) -> log-3 (Nov 6 09:02) -> log-2 -> log-1
    expect(json.punches[0].id).toBe("log-4");
    expect(json.punches[0].dateKey).toBe("2026-11-06");
    expect(json.punches[0].type).toBe("OUT");
    expect(json.punches[0].timeStr).toBeDefined();
    expect(json.punches[1].id).toBe("log-3");
    expect(json.punches[1].dateKey).toBe("2026-11-06");
    expect(json.punches[1].type).toBe("IN");
  });

  it("allows APPROVER to query staff in their assigned department", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[1], // Approver for d1
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches?staffId=s1");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.punches).toHaveLength(4);
  });

  it("returns 403 when APPROVER queries staff outside their department", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[1], // Approver for d1, s2 is in d2
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches?staffId=s2");
    const res = await GET(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/Forbidden/i);
  });

  it("returns 404 when APPROVER queries non-existent staffId", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[1],
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches?staffId=s-unknown");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("allows ADMIN to query any staffId", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[0],
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches?staffId=s2");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.punches).toHaveLength(1);
    expect(json.punches[0].id).toBe("log-5");
  });

  it("returns 400 when ADMIN provides no staffId and has no linked staff", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[0],
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("filters punches by date range (from and to)", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[2], // Employee s1
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches?from=2026-11-06&to=2026-11-06");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.punches).toHaveLength(2);
    expect(json.punches.map((p: { id: string }) => p.id)).toEqual(["log-4", "log-3"]);
  });

  it("returns 400 when from or to has invalid format", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[2],
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches?from=invalid-date");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid from date/i);
  });

  it("respects the limit query parameter", async () => {
    sessionMock.mockResolvedValueOnce({
      user: USERS[2], // Employee s1 (has 4 logs)
    } as unknown as Session);
    const req = new Request("http://localhost/api/employee/punches?limit=2");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.punches).toHaveLength(2);
    expect(json.punches[0].id).toBe("log-4");
    expect(json.punches[1].id).toBe("log-3");
  });
});
