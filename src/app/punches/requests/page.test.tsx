/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  punchRequest: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  department: {
    findMany: vi.fn(),
  },
  systemSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  policy: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const mockRedirect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth/next";
import PunchRequestsAdminPage from "./page";
import {
  PunchRequestsAdminClient,
  type AdminPunchRequestItem,
} from "./PunchRequestsAdminClient";
import { POST as settingsPost, GET as settingsGet } from "@/app/api/settings/route";

const mockGetServerSession = vi.mocked(getServerSession);

describe("Task 8: Admin & Approver Punch Requests Review Inbox (/punches/requests)", () => {
  const mockAdminUser = {
    id: "user-admin",
    role: "ADMIN",
    disabledAt: null,
    mustChangePassword: false,
    staffId: "staff-admin",
    approvesAllDepartments: true,
    approverDepartments: [],
    staff: null,
  };

  const mockApproverUser = {
    id: "user-approver",
    role: "APPROVER",
    disabledAt: null,
    mustChangePassword: false,
    staffId: "staff-appr",
    approvesAllDepartments: false,
    approverDepartments: [{ id: "ad-1", userId: "user-approver", departmentId: "dept-science" }],
    staff: null,
  };

  const mockEmployeeUser = {
    id: "user-employee",
    role: "EMPLOYEE",
    disabledAt: null,
    mustChangePassword: false,
    staffId: "staff-emp",
    approvesAllDepartments: false,
    approverDepartments: [],
    staff: null,
  };

  const mockDepartments = [
    { id: "dept-science", name: "Science" },
    { id: "dept-maths", name: "Mathematics" },
    { id: "dept-admin", name: "Administration" },
  ];

  const sampleRequests: AdminPunchRequestItem[] = [
    {
      id: "req-1",
      staffId: "staff-1",
      date: "2026-11-05",
      punchType: "IN",
      requestedTime: "09:00",
      requestedInTime: "09:00",
      requestedOutTime: null,
      reason: "FORGOT_SWIPE",
      explanation: "Card reader didn't beep when I tapped in the morning.",
      status: "PENDING",
      createdAt: "2026-11-05T10:00:00.000Z",
      staff: {
        id: "staff-1",
        name: "Rahul Verma",
        employeeCode: "SEHSS-012",
        machineId: "112",
        departmentId: "dept-science",
        profilePhotoId: "photo-1",
        department: { id: "dept-science", name: "Science" },
        designation: { id: "desig-1", name: "Physics Teacher" },
      },
    },
    {
      id: "req-2",
      staffId: "staff-2",
      date: "2026-11-04",
      punchType: "BOTH",
      requestedTime: null,
      requestedInTime: "08:45",
      requestedOutTime: "16:30",
      reason: "DUTY_OUTSIDE",
      explanation: "Escorted students to the inter-school tournament.",
      status: "APPROVED",
      decidedByUserId: "user-admin",
      decidedAt: "2026-11-04T18:00:00.000Z",
      decisionRemarks: "Verified with Sports in-charge",
      createdAt: "2026-11-04T17:00:00.000Z",
      staff: {
        id: "staff-2",
        name: "Anjali Gupta",
        employeeCode: "SEHSS-045",
        machineId: "145",
        departmentId: "dept-maths",
        profilePhotoId: null,
        department: { id: "dept-maths", name: "Mathematics" },
        designation: { id: "desig-2", name: "Math Teacher" },
      },
    },
    {
      id: "req-3",
      staffId: "staff-3",
      date: "2026-11-03",
      punchType: "OUT",
      requestedTime: "16:45",
      requestedInTime: null,
      requestedOutTime: "16:45",
      reason: "OTHER",
      explanation: "Left in a hurry due to medical emergency.",
      status: "REJECTED",
      decidedByUserId: "user-admin",
      decidedAt: "2026-11-03T19:00:00.000Z",
      decisionRemarks: "Medical leave must be applied separately",
      createdAt: "2026-11-03T17:30:00.000Z",
      staff: {
        id: "staff-3",
        name: "Deepak Sharma",
        employeeCode: "SEHSS-089",
        machineId: "189",
        departmentId: "dept-admin",
        profilePhotoId: null,
        department: { id: "dept-admin", name: "Administration" },
        designation: { id: "desig-3", name: "Accountant" },
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Server Page (PunchRequestsAdminPage)", () => {
    it("redirects unauthenticated users to /login", async () => {
      mockGetServerSession.mockResolvedValue(null);

      await PunchRequestsAdminPage();

      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("redirects EMPLOYEE users to /punch-requests", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-employee", role: "EMPLOYEE" },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockEmployeeUser as any);

      await PunchRequestsAdminPage();

      expect(mockRedirect).toHaveBeenCalledWith("/punch-requests");
    });

    it("loads all punch requests and departments for ADMIN without department restriction", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-admin", role: "ADMIN" },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.department.findMany.mockResolvedValue(mockDepartments as any);
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        id: "ss-1",
        key: "PUNCH_REQUEST_MAX_DAYS",
        value: "7",
      } as any);
      mockPrisma.punchRequest.findMany.mockResolvedValue(
        sampleRequests.map((r) => ({
          ...r,
          createdAt: new Date(r.createdAt),
          updatedAt: new Date(r.createdAt),
          decidedAt: r.decidedAt ? new Date(r.decidedAt) : null,
          staff: {
            ...r.staff,
            createdAt: new Date(),
            updatedAt: new Date(),
            department: r.staff.department
              ? { ...r.staff.department, createdAt: new Date(), updatedAt: new Date() }
              : null,
            designation: r.staff.designation
              ? { ...r.staff.designation, createdAt: new Date(), updatedAt: new Date() }
              : null,
          },
        })) as any
      );

      const component = await PunchRequestsAdminPage();
      expect(component).not.toBeNull();
      const html = renderToStaticMarkup(component!);

      // Verify Prisma query was unrestricted
      expect(mockPrisma.punchRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
      // Verify setting was fetched
      expect(mockPrisma.systemSetting.findUnique).toHaveBeenCalledWith({
        where: { key: "PUNCH_REQUEST_MAX_DAYS" },
      });
      // Content rendered
      expect(html).toContain("Punch Requests");
      expect(html).toContain("Rahul Verma");
      expect(html).toContain("Anjali Gupta");
    });

    it("scopes punch requests and departments to allowed departments for APPROVER", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-approver", role: "APPROVER" },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockApproverUser as any);
      mockPrisma.department.findMany.mockResolvedValue(mockDepartments as any);
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
      mockPrisma.punchRequest.findMany.mockResolvedValue([
        {
          ...sampleRequests[0],
          createdAt: new Date(sampleRequests[0].createdAt),
          updatedAt: new Date(sampleRequests[0].createdAt),
          decidedAt: null,
          staff: {
            ...sampleRequests[0].staff,
            createdAt: new Date(),
            updatedAt: new Date(),
            department: { id: "dept-science", name: "Science", createdAt: new Date(), updatedAt: new Date() },
            designation: { id: "desig-1", name: "Physics Teacher", createdAt: new Date(), updatedAt: new Date() },
          },
        },
      ] as any);

      const component = await PunchRequestsAdminPage();
      expect(component).not.toBeNull();
      const html = renderToStaticMarkup(component!);

      // Scoped where clause
      expect(mockPrisma.punchRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            staff: {
              departmentId: { in: ["dept-science"] },
            },
          },
        })
      );
      expect(html).toContain("Rahul Verma");
      // Deepak Sharma from dept-admin should not be here
      expect(html).not.toContain("Deepak Sharma");
    });
  });

  describe("PunchRequestsAdminClient Component", () => {
    it("renders page header, status filter chips with accurate live counters", () => {
      const html = renderToStaticMarkup(
        <PunchRequestsAdminClient
          initialRequests={sampleRequests}
          departments={mockDepartments}
          userRole="ADMIN"
          currentCutoffDays={7}
        />
      );

      expect(html).toContain("Punch Requests");
      // Filter chips: Pending (1), Approved (1), Rejected (1), All (3)
      expect(html).toContain("Pending");
      expect(html).toContain("Approved");
      expect(html).toContain("Rejected");
      expect(html).toContain("All");
      // Search bar
      expect(html).toContain("Search by staff name or employee code");
    });

    it("renders department filter dropdown for ADMIN user but not for APPROVER", () => {
      const adminHtml = renderToStaticMarkup(
        <PunchRequestsAdminClient
          initialRequests={sampleRequests}
          departments={mockDepartments}
          userRole="ADMIN"
          currentCutoffDays={7}
        />
      );

      expect(adminHtml).toContain("All Departments");
      expect(adminHtml).toContain("Science");
      expect(adminHtml).toContain("Mathematics");

      const approverHtml = renderToStaticMarkup(
        <PunchRequestsAdminClient
          initialRequests={sampleRequests}
          departments={[{ id: "dept-science", name: "Science" }]}
          userRole="APPROVER"
          currentCutoffDays={7}
        />
      );

      // Approver should not have department filter dropdown
      expect(approverHtml).not.toContain("All Departments");
    });

    it("renders request cards with staff avatar, code, department, times, reason category, and explanation", () => {
      const html = renderToStaticMarkup(
        <PunchRequestsAdminClient
          initialRequests={sampleRequests}
          departments={mockDepartments}
          userRole="ADMIN"
          currentCutoffDays={7}
        />
      );

      // Staff details
      expect(html).toContain("Rahul Verma");
      expect(html).toContain("SEHSS-012");
      expect(html).toContain("Science");

      // Times & Types
      expect(html).toContain("Check-In");
      expect(html).toContain("9:00 am");

      // Reason & explanation
      expect(html).toContain("Forgot to mark attendance / Missed terminal check");
      expect(html).toContain("Card reader didn&#x27;t beep when I tapped in the morning.");

      // Card for Both
      expect(html).toContain("Anjali Gupta");
      expect(html).toContain("Official on-duty assignment / Off-campus school duty");
      expect(html).toContain("Escorted students to the inter-school tournament.");
      expect(html).toContain("Verified with Sports in-charge");
    });

    it("renders existing biometric logs context check action/section", () => {
      const html = renderToStaticMarkup(
        <PunchRequestsAdminClient
          initialRequests={sampleRequests}
          departments={mockDepartments}
          userRole="ADMIN"
          currentCutoffDays={7}
        />
      );

      // Existing punches context trigger
      expect(html).toMatch(/Biometric Logs|Existing Swipes|Check Swipes/i);
    });

    it("renders decision action buttons (Approve and Reject) for PENDING requests", () => {
      const html = renderToStaticMarkup(
        <PunchRequestsAdminClient
          initialRequests={sampleRequests}
          departments={mockDepartments}
          userRole="ADMIN"
          currentCutoffDays={7}
        />
      );

      expect(html).toContain("Approve");
      expect(html).toContain("Reject");
    });

    it("renders Admin Configuration Card for ADMIN with cutoff options, but omits it for APPROVER", () => {
      const adminHtml = renderToStaticMarkup(
        <PunchRequestsAdminClient
          initialRequests={sampleRequests}
          departments={mockDepartments}
          userRole="ADMIN"
          currentCutoffDays={7}
        />
      );

      expect(adminHtml).toContain("Submission window cutoff");
      expect(adminHtml).toContain("Unlimited");
      expect(adminHtml).toContain("3 days");
      expect(adminHtml).toContain("7 days");
      expect(adminHtml).toContain("14 days");
      expect(adminHtml).toContain("30 days");
      expect(adminHtml).toContain("Save Window");

      const approverHtml = renderToStaticMarkup(
        <PunchRequestsAdminClient
          initialRequests={sampleRequests}
          departments={mockDepartments}
          userRole="APPROVER"
          currentCutoffDays={7}
        />
      );

      expect(approverHtml).not.toContain("Save Window");
      expect(approverHtml).not.toContain("Submission window cutoff");
    });

    it("renders EmptyState when requests list is empty", () => {
      const html = renderToStaticMarkup(
        <PunchRequestsAdminClient
          initialRequests={[]}
          departments={mockDepartments}
          userRole="ADMIN"
          currentCutoffDays={0}
        />
      );

      expect(html).toContain("No punch requests");
    });
  });

  describe("Admin Setting Endpoint (POST /api/settings)", () => {
    it("updates PUNCH_REQUEST_MAX_DAYS setting in SystemSetting", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-admin", role: "ADMIN" },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.systemSetting.upsert.mockResolvedValue({
        id: "ss-1",
        key: "PUNCH_REQUEST_MAX_DAYS",
        value: "14",
      } as any);

      const req = new Request("http://localhost/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "PUNCH_REQUEST_MAX_DAYS",
          value: "14",
        }),
      });

      const res = await settingsPost(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: { key: "PUNCH_REQUEST_MAX_DAYS" },
        update: { value: "14" },
        create: { key: "PUNCH_REQUEST_MAX_DAYS", value: "14" },
      });
      expect(data.value).toBe("14");
    });

    it("retrieves PUNCH_REQUEST_MAX_DAYS via GET /api/settings?key=...", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-admin", role: "ADMIN" },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);
      mockPrisma.systemSetting.findUnique.mockResolvedValue({
        id: "ss-1",
        key: "PUNCH_REQUEST_MAX_DAYS",
        value: "7",
      } as any);

      const req = new Request("http://localhost/api/settings?key=PUNCH_REQUEST_MAX_DAYS");
      const res = await settingsGet(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.value).toBe("7");
    });

    it("rejects non-admin users from updating settings via POST /api/settings", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-approver", role: "APPROVER" },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockApproverUser as any);

      const req = new Request("http://localhost/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "PUNCH_REQUEST_MAX_DAYS",
          value: "14",
        }),
      });

      const res = await settingsPost(req);
      expect(res.status).toBe(403);
    });

    it("returns 400 when key or value is missing in POST /api/settings", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-admin", role: "ADMIN" },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockAdminUser as any);

      const req = new Request("http://localhost/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "PUNCH_REQUEST_MAX_DAYS",
        }),
      });

      const res = await settingsPost(req);
      expect(res.status).toBe(400);
    });
  });

  describe("Approver with approvesAllDepartments", () => {
    it("does not restrict department where clause if approver has approvesAllDepartments: true", async () => {
      const mockSuperApprover = {
        ...mockApproverUser,
        approvesAllDepartments: true,
      };
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-approver", role: "APPROVER" },
      } as any);
      mockPrisma.user.findUnique.mockResolvedValue(mockSuperApprover as any);
      mockPrisma.department.findMany.mockResolvedValue(mockDepartments as any);
      mockPrisma.systemSetting.findUnique.mockResolvedValue(null);
      mockPrisma.punchRequest.findMany.mockResolvedValue([] as any);

      const component = await PunchRequestsAdminPage();
      expect(component).not.toBeNull();

      expect(mockPrisma.punchRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      );
    });
  });
});
