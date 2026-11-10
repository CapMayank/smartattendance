import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestsHubClient } from "./RequestsHubClient";
import type { AdminProfileRequestItem } from "./ProfileRequestsTab";
import type { AdminPunchRequestItem } from "../punches/requests/PunchRequestsAdminClient";

const SAMPLE_APPROVED_PROFILE_REQUESTS: AdminProfileRequestItem[] = [
  {
    id: "pcr-1",
    staffId: "s1",
    status: "APPROVED",
    requestedData: JSON.stringify({ maritalStatus: "Married", passportNumber: "Z1234567" }),
    currentData: JSON.stringify({ maritalStatus: "Unmarried", passportNumber: "" }),
    reason: "Updated passport and marital status",
    createdAt: new Date("2026-11-10T10:00:00Z").toISOString(),
    staff: {
      id: "s1",
      name: "Asha Sharma",
      employeeCode: "EMP001",
      machineId: "101",
      department: { id: "d1", name: "Science" },
      designation: { id: "des1", name: "Teacher" },
    },
  },
  {
    id: "pcr-2",
    staffId: "s2",
    status: "APPROVED",
    requestedData: JSON.stringify({ bankAccount: "9876543210", ifsc: "SBIN0001234" }),
    currentData: JSON.stringify({ bankAccount: "1234567890", ifsc: "SBIN0001234" }),
    reason: "Salary account change",
    createdAt: new Date("2026-11-09T14:30:00Z").toISOString(),
    staff: {
      id: "s2",
      name: "Ramesh Kumar",
      employeeCode: "EMP002",
      machineId: "102",
      department: { id: "d2", name: "Mathematics" },
      designation: { id: "des2", name: "Lab Assistant" },
    },
  },
];

describe("RequestsHubClient - Unified Feed & Pendency Counters", () => {
  it("does not show a count badge on 'All Requests' tab and only shows pendency", () => {
    const html = renderToStaticMarkup(
      <RequestsHubClient
        userRole="ADMIN"
        initialPunchRequests={[]}
        initialProfileRequests={SAMPLE_APPROVED_PROFILE_REQUESTS}
        departments={[{ id: "d1", name: "Science" }, { id: "d2", name: "Mathematics" }]}
        cutoffDays={0}
        initialTab="all"
      />
    );

    // 'All Requests' tab label is present but without a count badge
    expect(html).toContain("All Requests");
    // Tab pill container should not have count for 'all'
    expect(html).not.toMatch(/All Requests\s*<span[^>]*class="num[^>]*>[^<]*<\/span>/);
  });

  it("renders the 2 approved profile requests on 'All Requests' tab and displays Approved count 2", () => {
    const html = renderToStaticMarkup(
      <RequestsHubClient
        userRole="ADMIN"
        initialPunchRequests={[]}
        initialProfileRequests={SAMPLE_APPROVED_PROFILE_REQUESTS}
        departments={[{ id: "d1", name: "Science" }, { id: "d2", name: "Mathematics" }]}
        cutoffDays={0}
        initialTab="all"
      />
    );

    // Check that both approved staff requests appear in the unified list below
    expect(html).toContain("Asha Sharma");
    expect(html).toContain("Ramesh Kumar");
    expect(html).toContain("EMP001");
    expect(html).toContain("EMP002");
    expect(html).toContain("Profile &amp; Statutory KYC Update");

    // The Approved chip should show 2
    expect(html).toContain("Approved");
    expect(html).toContain(">2</span>");

    // The All chip should not have count
    expect(html).not.toContain("All<span class=\"num");
  });

  it("renders empty state gracefully when there are zero total requests", () => {
    const html = renderToStaticMarkup(
      <RequestsHubClient
        userRole="ADMIN"
        initialPunchRequests={[]}
        initialProfileRequests={[]}
        departments={[]}
        cutoffDays={0}
        initialTab="all"
      />
    );

    expect(html).toContain("No requests found");
    // Ensure no chip or tab renders a count pill of 0
    expect(html).not.toMatch(/<span[^>]*class="num[^>]*>0<\/span>/);
  });
});
