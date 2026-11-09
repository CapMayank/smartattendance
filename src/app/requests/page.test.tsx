import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ensureSchoolTimezone } from "@/lib/timezone";
import { RequestsHubClient } from "./RequestsHubClient";

beforeAll(() => {
  ensureSchoolTimezone();
});

const SAMPLE_PROFILE_REQUESTS = [
  {
    id: "pcr-1",
    staffId: "s1",
    status: "PENDING" as const,
    requestedData: JSON.stringify({
      pan: "BCDEF5678G",
      bankAccount: "98765432100",
      ifsc: "HDFC0001234",
    }),
    currentData: JSON.stringify({
      pan: "ABCDE1234F",
      bankAccount: "1234567890",
      ifsc: "SBIN0001234",
    }),
    reason: "Updated salary account to HDFC bank",
    createdAt: new Date().toISOString(),
    staff: {
      id: "s1",
      name: "Asha Sharma",
      employeeCode: "EMP001",
      machineId: "101",
      department: { id: "d1", name: "Science" },
      designation: { id: "des1", name: "Teacher" },
    },
  },
];

const SAMPLE_PUNCH_REQUESTS: any[] = [];
const SAMPLE_DEPTS = [{ id: "d1", name: "Science" }];

describe("RequestsHubClient Component", () => {
  it("renders page header and segmented tabs for ADMIN role", () => {
    const html = renderToStaticMarkup(
      <RequestsHubClient
        userRole="ADMIN"
        initialPunchRequests={SAMPLE_PUNCH_REQUESTS}
        initialProfileRequests={SAMPLE_PROFILE_REQUESTS}
        departments={SAMPLE_DEPTS}
        cutoffDays={7}
      />
    );

    expect(html).toContain("Requests &amp; Approvals");
    expect(html).toContain("All Requests");
    expect(html).toContain("Punch Regularizations");
    expect(html).toContain("Profile &amp; KYC Updates");
  });

  it("displays visual before vs after diff and action buttons in Profile tab", () => {
    const html = renderToStaticMarkup(
      <RequestsHubClient
        userRole="ADMIN"
        initialPunchRequests={SAMPLE_PUNCH_REQUESTS}
        initialProfileRequests={SAMPLE_PROFILE_REQUESTS}
        departments={SAMPLE_DEPTS}
        cutoffDays={7}
        initialTab="profile"
      />
    );

    expect(html).toContain("Asha Sharma");
    expect(html).toContain("Updated salary account to HDFC bank");
    expect(html).toContain("BCDEF5678G");
    expect(html).toContain("HDFC0001234");
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
  });
});
