import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PunchRequestsClient } from "./PunchRequestsClient";

describe("PunchRequestsClient Component", () => {
  it("renders page header, tabs with 'Action Needed', month navigation, and link to ToSchool calendar", () => {
    const html = renderToStaticMarkup(
      <PunchRequestsClient
        userRole="EMPLOYEE"
        staffId="staff-1"
        initialMonth={11}
        initialYear={2026}
      />
    );

    expect(html).toContain("My Punches &amp; Requests");
    expect(html).toContain("Action Needed");
    expect(html).toContain("Daily Punch Breakdown");
    expect(html).toContain("My Regularization Requests");
    expect(html).toContain("Raw Device Logs");
    expect(html).toContain("November 2026");
    expect(html).toContain("href=\"/to-school?month=11&amp;year=2026\"");
    expect(html).toContain("Monthly Calendar Grid");
  });

  it("renders request punch modal trigger button and generalized reason labels", () => {
    const html = renderToStaticMarkup(
      <PunchRequestsClient
        userRole="EMPLOYEE"
        staffId="staff-1"
      />
    );

    expect(html).toContain("Request Missed Punch");
    expect(html).toContain("Forgot to mark attendance / Missed terminal check");
    expect(html).toContain("Official on-duty assignment / Off-campus school duty");
    expect(html).toContain("Attendance terminal offline / Recognition error");
  });
});
