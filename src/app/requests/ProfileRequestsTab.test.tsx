import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileRequestsTab, PROFILE_FIELD_LABELS } from "./ProfileRequestsTab";

const SAMPLE_EPFO_REQUEST = [
  {
    id: "pcr-epfo-1",
    staffId: "s1",
    status: "PENDING" as const,
    requestedData: JSON.stringify({
      maritalStatus: "Married",
      relationship: "Husband",
      nameOnAadhaar: "ASHA SHARMA",
      nameOnPan: "ASHA SHARMA",
      nameOnUan: "ASHA SHARMA",
      previousMemberId: "MH/BAN/001",
      isInternationalWorker: "Y",
      passportNumber: "Z9876543",
      isPhysicalHandicap: "N",
    }),
    currentData: JSON.stringify({
      maritalStatus: "Unmarried",
      relationship: "Father",
      nameOnAadhaar: "",
      nameOnPan: "",
      nameOnUan: "",
      previousMemberId: "",
      isInternationalWorker: "N",
      passportNumber: "",
      isPhysicalHandicap: "N",
    }),
    reason: "Mandatory EPFO update",
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

describe("ProfileRequestsTab - EPFO Field Labels and Diffs", () => {
  it("defines human-readable labels for all 14 statutory EPFO fields", () => {
    expect(PROFILE_FIELD_LABELS.maritalStatus).toBe("Marital Status");
    expect(PROFILE_FIELD_LABELS.relationship).toBe("Father / Husband Relationship");
    expect(PROFILE_FIELD_LABELS.nameOnAadhaar).toBe("Name as per Aadhaar");
    expect(PROFILE_FIELD_LABELS.nameOnPan).toBe("Name as per PAN");
    expect(PROFILE_FIELD_LABELS.nameOnUan).toBe("Name on UAN");
    expect(PROFILE_FIELD_LABELS.previousMemberId).toBe("Previous EPFO Member ID");
    expect(PROFILE_FIELD_LABELS.isInternationalWorker).toBe("International Worker (Y/N)");
    expect(PROFILE_FIELD_LABELS.passportNumber).toBe("Passport Number");
    expect(PROFILE_FIELD_LABELS.isPhysicalHandicap).toBe("Disability Status (Y/N)");
  });

  it("renders human-readable labels in diff table instead of raw camelCase keys", () => {
    const html = renderToStaticMarkup(
      <ProfileRequestsTab
        initialRequests={SAMPLE_EPFO_REQUEST}
        departments={[{ id: "d1", name: "Science" }]}
        userRole="ADMIN"
      />
    );

    expect(html).toContain("Marital Status");
    expect(html).toContain("Father / Husband Relationship");
    expect(html).toContain("Name as per Aadhaar");
    expect(html).toContain("Name as per PAN");
    expect(html).toContain("Name on UAN");
    expect(html).toContain("Previous EPFO Member ID");
    expect(html).toContain("International Worker (Y/N)");
    expect(html).toContain("Passport Number");
    expect(html).toContain("Disability Status (Y/N)");

    // Raw camelCase should not appear as table cell content
    expect(html).not.toContain(">nameOnAadhaar<");
    expect(html).not.toContain(">previousMemberId<");
  });

  it("renders status pill for PARTIALLY_APPROVED requests", () => {
    const partiallyApprovedRequest = [
      {
        ...SAMPLE_EPFO_REQUEST[0],
        id: "pcr-partial",
        status: "PARTIALLY_APPROVED" as any,
        decisionRemarks: JSON.stringify({
          note: "Approved marital status, rejected passport",
          approvedFields: ["maritalStatus"],
          rejectedFields: ["passportNumber"],
          fieldRemarks: { passportNumber: "Passport expired" },
        }),
      },
    ];

    const html = renderToStaticMarkup(
      <ProfileRequestsTab
        initialRequests={partiallyApprovedRequest}
        departments={[{ id: "d1", name: "Science" }]}
        userRole="ADMIN"
      />
    );

    expect(html).toContain("PARTIALLY APPROVED");
  });
});
