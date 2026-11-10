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
import { GET as getProfileRequests, POST as postProfileRequest } from "./route";
import { GET as getEmployeeProfile } from "../profile/route";

const sessionMock = vi.mocked(getServerSession);

beforeAll(() => {
  ensureSchoolTimezone();
});

const STAFF1 = {
  id: "s1",
  name: "Pooja Verma",
  machineId: "101",
  employeeCode: "EMP001",
  shiftId: null,
  shift: null,
  payrollInfo: {
    mobileNumber: "9876543210",
    email: "pooja@example.com",
    bankAccount: "1234567890",
    ifsc: "SBIN0001234",
    nameAsPerBank: "Pooja Verma",
    pan: "ABCDE1234F",
    aadhaar: "123456789012",
    uan: "100987654321",
    dob: new Date("1990-05-15"),
    gender: "Female",
    fatherHusbandName: "Ramesh Verma",
  },
};

const USER1 = {
  id: "u1",
  name: "Pooja Verma",
  email: "pooja@example.com",
  role: "EMPLOYEE",
  staffId: "s1",
};

const USER2 = {
  id: "u2",
  name: "Admin User",
  email: "existing@example.com",
  role: "ADMIN",
  staffId: null,
};

describe("Employee Profile & Profile Requests API", () => {
  let fakePrisma: ReturnType<typeof createFakePrisma>;

  beforeEach(() => {
    fakePrisma = createFakePrisma({
      staff: [STAFF1],
      users: [USER1, USER2],
      profileChangeRequests: [],
    });
    holder.client = fakePrisma.client;
  });

  describe("GET /api/employee/profile", () => {
    it("returns 401 when not authenticated", async () => {
      sessionMock.mockResolvedValueOnce(null);
      const res = await getEmployeeProfile();
      expect(res.status).toBe(401);
    });

    it("returns 400 when user has no linked staffId", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u2", role: "ADMIN", staffId: null },
      } as any);
      const res = await getEmployeeProfile();
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("No linked staff profile");
    });

    it("returns profile details for the authenticated employee", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const res = await getEmployeeProfile();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.profile.name).toBe("Pooja Verma");
      expect(data.profile.pan).toBe("ABCDE1234F");
      expect(data.profile.bankAccount).toBe("1234567890");
      expect(data.profile.ifsc).toBe("SBIN0001234");
      expect(data.profile.epfoReadiness).toBeDefined();
      expect(typeof data.profile.epfoReadiness.isBankEpf).toBe("boolean");
      expect(data.profile.maritalStatus).toBeDefined();
    });
  });

  describe("POST /api/employee/profile-requests", () => {
    it("returns 401 when not authenticated", async () => {
      sessionMock.mockResolvedValueOnce(null);
      const req = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: { pan: "XYZAB1234C" } }),
      });
      const res = await postProfileRequest(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when no fields have changed", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: {} }),
      });
      const res = await postProfileRequest(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("At least one field");
    });

    it("returns 400 on invalid PAN format", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: { pan: "invalid-pan" } }),
      });
      const res = await postProfileRequest(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid PAN format");
    });

    it("returns 400 on invalid IFSC format", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: { ifsc: "12345" } }),
      });
      const res = await postProfileRequest(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid IFSC code format");
    });

    it("returns 400 on conflicting user email", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: { email: "existing@example.com" } }),
      });
      const res = await postProfileRequest(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Email is already in use");
    });

    it("returns 400 on Aadhaar starting with 0 or 1", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: { aadhaar: "012345678901" } }),
      });
      const res = await postProfileRequest(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Aadhaar");
    });

    it("returns 400 on IFSC with letter O at 5th character instead of digit 0", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: { ifsc: "SBINO001234" } }),
      });
      const res = await postProfileRequest(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("IFSC");
    });

    it("returns 400 on relationship other than Father or Husband", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: { relationship: "Mother" } }),
      });
      const res = await postProfileRequest(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Relationship");
    });

    it("returns 400 on invalid UAN or bank account format", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req1 = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: { uan: "12345" } }),
      });
      const res1 = await postProfileRequest(req1);
      expect(res1.status).toBe(400);
      const data1 = await res1.json();
      expect(data1.error).toContain("UAN");

      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req2 = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({ requestedData: { bankAccount: "1234" } }),
      });
      const res2 = await postProfileRequest(req2);
      expect(res2.status).toBe(400);
      const data2 = await res2.json();
      expect(data2.error).toContain("bank account");
    });

    it("creates a pending ProfileChangeRequest on valid data including EPFO fields", async () => {
      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const req = new Request("http://localhost/api/employee/profile-requests", {
        method: "POST",
        body: JSON.stringify({
          requestedData: {
            pan: "BCDEF5678G",
            bankAccount: "98765432100",
            ifsc: "HDFC0001234",
            nameAsPerBank: "Pooja V.",
            maritalStatus: "Married",
            relationship: "Father",
            nameOnAadhaar: "POOJA VERMA",
            nameOnPan: "POOJA VERMA",
            nameOnUan: "POOJA VERMA",
            previousMemberId: "MH/BAN/001",
          },
          reason: "Updated salary account to HDFC bank and added EPFO details",
        }),
      });
      const res = await postProfileRequest(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.request.status).toBe("PENDING");
      expect(data.request.staffId).toBe("s1");

      const created = JSON.parse(data.request.requestedData);
      expect(created.pan).toBe("BCDEF5678G");
      expect(created.ifsc).toBe("HDFC0001234");
      expect(created.maritalStatus).toBe("Married");
      expect(created.nameOnAadhaar).toBe("POOJA VERMA");
    });
  });

  describe("GET /api/employee/profile-requests", () => {
    it("returns list of requests for the authenticated employee", async () => {
      fakePrisma.profileChangeRequests.push({
        id: "pcr-1",
        staffId: "s1",
        status: "PENDING",
        requestedData: JSON.stringify({ pan: "XYZAB1234C" }),
        currentData: JSON.stringify({ pan: "ABCDE1234F" }),
        reason: "Fix typo in PAN",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      sessionMock.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "s1" },
      } as any);
      const res = await getProfileRequests();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.requests).toHaveLength(1);
      expect(data.requests[0].id).toBe("pcr-1");
    });
  });
});
