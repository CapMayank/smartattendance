import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RequestProfileEditModal } from "./RequestProfileEditModal";

describe("RequestProfileEditModal Component", () => {
  it("renders when open is true with segmented tabs and fields", () => {
    const html = renderToStaticMarkup(
      <RequestProfileEditModal
        open={true}
        onClose={vi.fn()}
        onSubmitted={vi.fn()}
      />
    );

    expect(html).toContain("Request Profile &amp; KYC Update");
    expect(html).toContain("Personal &amp; Contact");
    expect(html).toContain("Banking Details");
    expect(html).toContain("Statutory KYC");
    expect(html).toContain("Request History");
    expect(html).toContain("Reason for Request");
  });

  it("renders with size xl class", () => {
    const html = renderToStaticMarkup(
      <RequestProfileEditModal
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("w-[min(56rem,calc(100vw-2.5rem))]");
  });

  it("renders statutory KYC inputs for Aadhaar, PAN, UAN names, and previous member ID when initialTab is statutory", () => {
    const html = renderToStaticMarkup(
      <RequestProfileEditModal
        open={true}
        onClose={vi.fn()}
        initialTab="statutory"
      />
    );

    expect(html).toContain("Name as per Aadhaar");
    expect(html).toContain("Name as per PAN");
    expect(html).toContain("Name on UAN");
    expect(html).toContain("Previous EPFO Member ID");
    expect(html).toContain("International Worker &amp; Disability Details");
    expect(html).toContain("Passport Valid From");
    expect(html).toContain("Passport Valid Till");
  });

  it("renders Marital Status, Relationship, and Nationality fields on personal tab", () => {
    const html = renderToStaticMarkup(
      <RequestProfileEditModal
        open={true}
        onClose={vi.fn()}
        initialTab="personal"
      />
    );

    expect(html).toContain("Marital Status");
    expect(html).toContain("Father / Husband Relationship");
    expect(html).toContain("Nationality");
  });

  it("renders reassurance banner informing user that current records are pre-filled", () => {
    const html = renderToStaticMarkup(
      <RequestProfileEditModal
        open={true}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("Your saved records are pre-filled below");
    expect(html).toContain("Only edit the specific details you need to change");
    expect(html).toContain("No Changes Made");
  });

  it("renders when initialTab is history", () => {
    const html = renderToStaticMarkup(
      <RequestProfileEditModal
        open={true}
        onClose={vi.fn()}
        initialTab="history"
      />
    );

    expect(html).toContain("Your Submitted Profile Change Requests");
  });
});
