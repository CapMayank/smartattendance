import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestPunchModal, PUNCH_REASONS } from "./RequestPunchModal";

describe("RequestPunchModal Component", () => {
  it("renders when open is true with default values and generalized reasons", () => {
    const html = renderToStaticMarkup(
      <RequestPunchModal
        open={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(html).toContain("Request Missed Punch");
    expect(html).toContain("Requested Check-In");
    expect(html).toContain("Requested Check-Out");
    expect(html).toContain("Forgot to mark attendance / Missed terminal check");
    expect(html).toContain("Official on-duty assignment / Off-campus school duty");
    expect(html).toContain("Attendance terminal offline / Recognition error");
  });

  it("pre-fills date, punchType OUT, and default out time 16:30", () => {
    const html = renderToStaticMarkup(
      <RequestPunchModal
        open={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        prefillDate="2026-11-05"
        prefillPunchType="OUT"
      />
    );

    expect(html).toContain('value="2026-11-05"');
    expect(html).toContain("Requested Time (Check-Out)");
    expect(html).toContain('value="16:30"');
    expect(html).not.toContain("Requested Check-In");
  });

  it("pre-fills punchType IN and custom requested time", () => {
    const html = renderToStaticMarkup(
      <RequestPunchModal
        open={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        prefillDate="2026-11-06"
        prefillPunchType="IN"
        prefillTime="09:15"
      />
    );

    expect(html).toContain('value="2026-11-06"');
    expect(html).toContain("Requested Time (Check-In)");
    expect(html).toContain('value="09:15"');
  });

  it("accepts an optional staffId prop for admin-on-behalf-of submissions", () => {
    const html = renderToStaticMarkup(
      <RequestPunchModal
        open={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        staffId="staff-42"
        prefillDate="2026-11-07"
      />
    );

    expect(html).toContain("Request Missed Punch");
    expect(html).toContain('value="2026-11-07"');
  });

  it("exports generalized PUNCH_REASONS", () => {
    expect(PUNCH_REASONS).toEqual([
      { value: "FORGOT_SWIPE", label: "Forgot to mark attendance / Missed terminal check" },
      { value: "DUTY_OUTSIDE", label: "Official on-duty assignment / Off-campus school duty" },
      { value: "DEVICE_OFFLINE", label: "Attendance terminal offline / Recognition error" },
      { value: "POWER_FAILURE", label: "Campus power outage / Terminal unavailable" },
      { value: "OTHER", label: "Other reason (specify details below)" },
    ]);
  });
});
