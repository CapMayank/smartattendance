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
});
