/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const mockPrisma = vi.hoisted(() => ({
  staff: {
    findUnique: vi.fn(),
  },
  attendanceLog: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  dailyRecord: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  monthlyPayroll: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  profileChangeRequest: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
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
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/profile",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth/next";
import ProfilePage from "./page";
import { EmployeeProfileClient } from "./EmployeeProfileClient";

const mockGetServerSession = vi.mocked(getServerSession);

describe("Employee Profile Page & Hub", () => {
  const mockStaff = {
    id: "staff-1",
    machineId: "101",
    name: "Sunita Patel",
    employeeCode: "EMP042",
    joiningDate: new Date("2024-01-15"),
    profilePhotoId: null,
    departmentId: "d1",
    designationId: "des1",
    department: { id: "d1", name: "Science" },
    designation: { id: "des1", name: "Senior Teacher" },
    shift: { id: "sh1", name: "Morning Shift", startTime: "08:00", endTime: "14:30" },
    user: { id: "u1", email: "sunita@school.edu" },
    payrollInfo: {
      id: "pinfo-1",
      staffId: "staff-1",
      payGroup: "BANK_EPF",
      email: "sunita@example.com",
      mobileNumber: "9876543210",
      dob: new Date("1992-05-15"),
      gender: "Female",
      fatherHusbandName: "Rajesh Patel",
      relationship: "Husband",
      maritalStatus: "Married",
      nationality: "INDIAN",
      qualification: "Post Graduate",
      bankAccount: "1234567890",
      ifsc: "SBIN0001234",
      nameAsPerBank: "SUNITA PATEL",
      pan: "ABCDE1234F",
      nameOnPan: "SUNITA PATEL",
      aadhaar: "234567890123",
      nameOnAadhaar: "SUNITA PATEL",
      uan: "100123456789",
      nameOnUan: "SUNITA PATEL",
      previousMemberId: "MH/BAN/001",
      isInternationalWorker: "N",
      countryOfOrigin: "INDIA",
      passportNumber: "",
      passportValidFrom: null,
      passportValidTill: null,
      isPhysicalHandicap: "N",
      locomotive: "N",
      hearing: "N",
      visual: "N",
    },
    employmentPeriods: [],
  };

  const mockRequests = [
    {
      id: "req-1",
      staffId: "staff-1",
      status: "PENDING" as const,
      requestedData: JSON.stringify({ pan: "XYZAB1234C" }),
      currentData: JSON.stringify({ pan: "ABCDE1234F" }),
      reason: "Corrected PAN typing error",
      decidedByUserId: null,
      decidedAt: null,
      decisionRemarks: null,
      createdAt: new Date("2026-11-10T08:00:00Z").toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Server Page Route", () => {
    it("redirects to /login when unauthenticated", async () => {
      mockGetServerSession.mockResolvedValueOnce(null);
      await ProfilePage();
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });

    it("renders page with employee identity, banking, and EPFO details", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "u1", role: "EMPLOYEE", staffId: "staff-1" },
      } as any);

      mockPrisma.staff.findUnique.mockResolvedValueOnce(mockStaff as any);
      mockPrisma.profileChangeRequest.findMany.mockResolvedValueOnce(mockRequests as any);
      mockPrisma.profileChangeRequest.findFirst.mockResolvedValueOnce(mockRequests[0] as any);

      const component = await ProfilePage();
      const html = renderToStaticMarkup(component);

      expect(html).toContain("My Profile &amp; Statutory KYC");
      expect(html).toContain("Sunita Patel");
      expect(html).toContain("EMP042");
      expect(html).toContain("Science");
      expect(html).toContain("Senior Teacher");
      expect(html).toContain("ABCDE1234F");
      expect(html).toContain("100123456789");
    });
  });

  describe("EmployeeProfileClient", () => {
    it("renders 5 organized detail sections and edit buttons", () => {
      const data = {
        profile: {
          id: "staff-1",
          name: "Sunita Patel",
          employeeCode: "EMP042",
          machineId: "101",
          joiningDate: "2024-01-15",
          profilePhotoId: null,
          departmentName: "Science",
          designationName: "Senior Teacher",
          shift: { name: "Morning Shift", startTime: "08:00", endTime: "14:30" },
          payGroup: "BANK_EPF" as const,
          email: "sunita@school.edu",
          kycDetails: {
            mobileNumber: "9876543210",
            dob: "1992-05-15",
            gender: "Female",
            maritalStatus: "Married",
            fatherHusbandName: "Rajesh Patel",
            relationship: "Husband",
            nationality: "INDIAN",
            qualification: "Post Graduate",
            bankAccount: "1234567890",
            ifsc: "SBIN0001234",
            nameAsPerBank: "SUNITA PATEL",
            pan: "ABCDE1234F",
            nameOnPan: "SUNITA PATEL",
            aadhaar: "234567890123",
            nameOnAadhaar: "SUNITA PATEL",
            uan: "100123456789",
            nameOnUan: "SUNITA PATEL",
            previousMemberId: "MH/BAN/001",
            isInternationalWorker: "N",
            countryOfOrigin: "INDIA",
            passportNumber: null,
            passportValidFrom: null,
            passportValidTill: null,
            isPhysicalHandicap: "N",
            locomotive: "N",
            hearing: "N",
            visual: "N",
          },
          epfoReadiness: {
            isBankEpf: true,
            ready: true,
            missingFields: [],
            hasPendingRequest: false,
          },
        },
        requests: mockRequests,
      };

      const html = renderToStaticMarkup(<EmployeeProfileClient initialData={data} />);

      expect(html).toContain("School Identity &amp; Employment");
      expect(html).toContain("Personal &amp; Contact Information");
      expect(html).toContain("Salary Bank Account");
      expect(html).toContain("Statutory Records &amp; EPFO Compliance");
      expect(html).toContain("Profile Change Requests &amp; Status History");
      expect(html).toContain("Request Details Edit");
      expect(html).toContain("Edit Personal Details");
      expect(html).toContain("Edit Banking Details");
      expect(html).toContain("Update Statutory &amp; KYC");
    });

    it("renders mandatory KYC completion banner when epfoReadiness is not ready", () => {
      const data = {
        profile: {
          id: "staff-1",
          name: "Sunita Patel",
          employeeCode: "EMP042",
          machineId: "101",
          joiningDate: "2024-01-15",
          profilePhotoId: null,
          departmentName: "Science",
          designationName: "Senior Teacher",
          shift: null,
          payGroup: "BANK_EPF" as const,
          email: "sunita@school.edu",
          kycDetails: {
            mobileNumber: null,
            dob: null,
            gender: null,
            maritalStatus: null,
            fatherHusbandName: null,
            relationship: null,
            nationality: "INDIAN",
            qualification: null,
            bankAccount: null,
            ifsc: null,
            nameAsPerBank: null,
            pan: null,
            nameOnPan: null,
            aadhaar: null,
            nameOnAadhaar: null,
            uan: null,
            nameOnUan: null,
            previousMemberId: null,
            isInternationalWorker: "N",
            countryOfOrigin: "INDIA",
            passportNumber: null,
            passportValidFrom: null,
            passportValidTill: null,
            isPhysicalHandicap: "N",
            locomotive: "N",
            hearing: "N",
            visual: "N",
          },
          epfoReadiness: {
            isBankEpf: true,
            ready: false,
            missingFields: [
              "Aadhaar must be a 12-digit number not starting with 0 or 1",
              "Valid 10-character PAN is required",
            ],
            hasPendingRequest: false,
          },
        },
        requests: [],
      };

      const html = renderToStaticMarkup(<EmployeeProfileClient initialData={data} />);

      expect(html).toContain("Action Required: Complete Mandatory KYC &amp; EPFO Details");
      expect(html).toContain("Aadhaar must be a 12-digit number not starting with 0 or 1");
      expect(html).toContain("Complete KYC &amp; EPFO Details");
    });
  });
});
