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
import { GET as getAdminProfileRequests } from "./route";
import { POST as decideProfileRequest } from "./[id]/decide/route";

const sessionMock = vi.mocked(getServerSession);

beforeAll(() => {
  ensureSchoolTimezone();
});

const D1 = { id: "d1", name: "Science" };
const D2 = { id: "d2", name: "Arts" };

const STAFF1 = {
  id: "s1",
  name: "Pooja Verma",
  machineId: "101",
  employeeCode: "EMP001",
  departmentId: "d1",
  department: D1,
  designationId: null,
  designation: null,
  shiftId: null,
  payrollInfo: {
    mobileNumber: "9876543210",
    email: "pooja@example.com",
    bankAccount: "1111222233",
    ifsc: "SBIN0001111",
    nameAsPerBank: "Pooja Verma",
    pan: "ABCDE1111F",
    aadhaar: "111122223333",
    uan: "100111222333",
    dob: new Date("1990-01-01"),
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

const ADMIN_USER = {
  id: "admin-1",
  name: "Admin Principal",
  email: "admin@school.com",
  role: "ADMIN",
  staffId: null,
};

const APPROVER_USER = {
  id: "appr-1",
  name: "Department Head",
  email: "hod@school.com",
  role: "APPROVER",
  staffId: null,
  approvesAllDepartments: false,
  approverDepartments: [{ departmentId: "d1" }],
};

describe("Admin Profile Requests API", () => {
  let fakePrisma: ReturnType<typeof createFakePrisma>;

  beforeEach(() => {
    fakePrisma = createFakePrisma({
      staff: [STAFF1],
      users: [USER1, ADMIN_USER, APPROVER_USER],
      profileChangeRequests: [
        {
          id: "pcr-100",
          staffId: "s1",
          status: "PENDING",
          requestedData: JSON.stringify({
            name: "Pooja Sharma",
            pan: "BCDEF5555G",
            bankAccount: "9999888877",
            ifsc: "HDFC0009999",
            email: "poojasharma@school.com",
          }),
          currentData: JSON.stringify({
            name: "Pooja Verma",
            pan: "ABCDE1111F",
            bankAccount: "1111222233",
            ifsc: "SBIN0001111",
            email: "pooja@example.com",
          }),
          reason: "Updated surname after marriage and changed salary bank account",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    holder.client = fakePrisma.client;
  });

  describe("GET /api/admin/profile-requests", () => {
    it("returns 401 when not authenticated", async () => {
      sessionMock.mockResolvedValueOnce(null);
      const req = new Request("http://localhost/api/admin/profile-requests");
      const res = await getAdminProfileRequests(req);
      expect(res.status).toBe(401);
    });

    it("returns 403 for EMPLOYEE role", async () => {
      sessionMock.mockResolvedValueOnce({ user: USER1 } as any);
      const req = new Request("http://localhost/api/admin/profile-requests");
      const res = await getAdminProfileRequests(req);
      expect(res.status).toBe(403);
    });

    it("returns list of requests for ADMIN role with staff details", async () => {
      sessionMock.mockResolvedValueOnce({ user: ADMIN_USER } as any);
      const req = new Request("http://localhost/api/admin/profile-requests?status=PENDING");
      const res = await getAdminProfileRequests(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.requests).toHaveLength(1);
      expect(data.requests[0].id).toBe("pcr-100");
      expect(data.requests[0].staff.name).toBe("Pooja Verma");
      expect(data.requests[0].staff.department.name).toBe("Science");
    });
  });

  describe("POST /api/admin/profile-requests/[id]/decide", () => {
    it("returns 403 Forbidden for APPROVER role (strict ADMIN only authority)", async () => {
      sessionMock.mockResolvedValueOnce({ user: APPROVER_USER } as any);
      const req = new Request("http://localhost/api/admin/profile-requests/pcr-100/decide", {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE" }),
      });
      const res = await decideProfileRequest(req, {
        params: Promise.resolve({ id: "pcr-100" }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Forbidden");
    });

    it("returns 404 for non-existent request ID", async () => {
      sessionMock.mockResolvedValueOnce({ user: ADMIN_USER } as any);
      const req = new Request("http://localhost/api/admin/profile-requests/non-existent/decide", {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE" }),
      });
      const res = await decideProfileRequest(req, {
        params: Promise.resolve({ id: "non-existent" }),
      });
      expect(res.status).toBe(404);
    });

    it("approves request, applies updates to Staff, StaffPayrollInfo, linked User, and logs AuditLog", async () => {
      sessionMock.mockResolvedValueOnce({ user: ADMIN_USER } as any);
      const req = new Request("http://localhost/api/admin/profile-requests/pcr-100/decide", {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE" }),
      });
      const res = await decideProfileRequest(req, {
        params: Promise.resolve({ id: "pcr-100" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.request.status).toBe("APPROVED");
      expect(data.request.decidedByUserId).toBe("admin-1");

      // Verify Staff update
      const updatedStaff = await (fakePrisma.client as any).staff.findUnique({
        where: { id: "s1" },
      });
      expect(updatedStaff?.name).toBe("Pooja Sharma");

      // Verify StaffPayrollInfo update
      const updatedPayroll = await (fakePrisma.client as any).staffPayrollInfo.findUnique({
        where: { staffId: "s1" },
      });
      expect(updatedPayroll?.pan).toBe("BCDEF5555G");
      expect(updatedPayroll?.bankAccount).toBe("9999888877");
      expect(updatedPayroll?.ifsc).toBe("HDFC0009999");
      expect(updatedPayroll?.email).toBe("poojasharma@school.com");

      // Verify linked User update
      expect(USER1.name).toBe("Pooja Sharma");
      expect(USER1.email).toBe("poojasharma@school.com");

      // Verify AuditLog
      expect(fakePrisma.auditLogs.length).toBeGreaterThan(0);
      const log = fakePrisma.auditLogs.find((l) => (l as any).action === "PROFILE_CHANGE_APPROVED");
      expect(log).toBeDefined();
    });

    it("approves request containing EPFO statutory fields and persists them to StaffPayrollInfo", async () => {
      fakePrisma.profileChangeRequests.push({
        id: "pcr-epfo",
        staffId: "s1",
        status: "PENDING",
        requestedData: JSON.stringify({
          maritalStatus: "Married",
          relationship: "Husband",
          nameOnAadhaar: "POOJA VERMA",
          nameOnPan: "POOJA VERMA",
          nameOnUan: "POOJA VERMA",
          previousMemberId: "MH/BAN/001",
          isInternationalWorker: "Y",
          passportNumber: "Z1234567",
        }),
        currentData: JSON.stringify({}),
        reason: "EPFO compliance update",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      sessionMock.mockResolvedValueOnce({ user: ADMIN_USER } as any);
      const req = new Request("http://localhost/api/admin/profile-requests/pcr-epfo/decide", {
        method: "POST",
        body: JSON.stringify({ action: "APPROVE", remarks: "All statutory docs verified" }),
      });
      const res = await decideProfileRequest(req, {
        params: Promise.resolve({ id: "pcr-epfo" }),
      });
      expect(res.status).toBe(200);

      const staffPayroll = await (fakePrisma.client as any).staffPayrollInfo.findUnique({ where: { staffId: "s1" } });
      expect(staffPayroll?.maritalStatus).toBe("Married");
      expect(staffPayroll?.nameOnAadhaar).toBe("POOJA VERMA");
      expect(staffPayroll?.previousMemberId).toBe("MH/BAN/001");
      expect(staffPayroll?.passportNumber).toBe("Z1234567");
    });

    it("rejects request, saves decisionRemarks, and logs AuditLog", async () => {
      sessionMock.mockResolvedValueOnce({ user: ADMIN_USER } as any);
      const req = new Request("http://localhost/api/admin/profile-requests/pcr-100/decide", {
        method: "POST",
        body: JSON.stringify({
          action: "REJECT",
          remarks: "Bank account document proof is illegible. Please resubmit.",
        }),
      });
      const res = await decideProfileRequest(req, {
        params: Promise.resolve({ id: "pcr-100" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.request.status).toBe("REJECTED");
      expect(data.request.decisionRemarks).toBe("Bank account document proof is illegible. Please resubmit.");

      // Staff details remain unchanged
      expect(STAFF1.name).toBe("Pooja Verma");

      // Verify AuditLog
      const log = fakePrisma.auditLogs.find((l) => (l as any).action === "PROFILE_CHANGE_REJECTED");
      expect(log).toBeDefined();
    });

    it("selectively approves a subset of fields, updates only approved fields, marks status as PARTIALLY_APPROVED, and persists field-level remarks", async () => {
      fakePrisma.profileChangeRequests.push({
        id: "pcr-selective",
        staffId: "s1",
        status: "PENDING",
        requestedData: JSON.stringify({
          bankAccount: "8888777766",
          ifsc: "PUNB0008888",
          pan: "XYZAB9999K",
        }),
        currentData: JSON.stringify({
          bankAccount: "1111222233",
          ifsc: "SBIN0001111",
          pan: "ABCDE1111F",
        }),
        reason: "Updating bank and PAN",
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      sessionMock.mockResolvedValueOnce({ user: ADMIN_USER } as any);
      const req = new Request("http://localhost/api/admin/profile-requests/pcr-selective/decide", {
        method: "POST",
        body: JSON.stringify({
          action: "SELECTIVE",
          approvedFields: ["bankAccount", "ifsc"],
          rejectedFields: ["pan"],
          fieldRemarks: {
            pan: "PAN card name does not match school identity records",
          },
          decisionRemarks: "Bank details verified. Please provide PAN card copy for name discrepancy.",
        }),
      });

      const res = await decideProfileRequest(req, {
        params: Promise.resolve({ id: "pcr-selective" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.request.status).toBe("PARTIALLY_APPROVED");

      // Verify that approved fields WERE updated
      const updatedPayroll = await (fakePrisma.client as any).staffPayrollInfo.findUnique({
        where: { staffId: "s1" },
      });
      expect(updatedPayroll?.bankAccount).toBe("8888777766");
      expect(updatedPayroll?.ifsc).toBe("PUNB0008888");

      // Verify that rejected field WAS NOT updated
      expect(updatedPayroll?.pan).not.toBe("XYZAB9999K");

      // Verify structured decisionRemarks
      const parsedRemarks = JSON.parse(data.request.decisionRemarks);
      expect(parsedRemarks.approvedFields).toEqual(["bankAccount", "ifsc"]);
      expect(parsedRemarks.rejectedFields).toEqual(["pan"]);
      expect(parsedRemarks.fieldRemarks?.pan).toBe("PAN card name does not match school identity records");
    });

    it("marks status as REJECTED when all fields are rejected in selective action", async () => {
      fakePrisma.profileChangeRequests.push({
        id: "pcr-all-rejected",
        staffId: "s1",
        status: "PENDING",
        requestedData: JSON.stringify({ pan: "XYZAB9999K" }),
        currentData: JSON.stringify({ pan: "ABCDE1111F" }),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      sessionMock.mockResolvedValueOnce({ user: ADMIN_USER } as any);
      const req = new Request("http://localhost/api/admin/profile-requests/pcr-all-rejected/decide", {
        method: "POST",
        body: JSON.stringify({
          action: "SELECTIVE",
          approvedFields: [],
          rejectedFields: ["pan"],
          fieldRemarks: { pan: "Invalid card copy" },
        }),
      });

      const res = await decideProfileRequest(req, {
        params: Promise.resolve({ id: "pcr-all-rejected" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.request.status).toBe("REJECTED");
    });
  });
});
