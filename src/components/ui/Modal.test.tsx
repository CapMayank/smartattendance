import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Modal } from "./Modal";

describe("Modal Component", () => {
  it("renders with default 'md' size and title", () => {
    const html = renderToStaticMarkup(
      <Modal open={true} onClose={vi.fn()} title="Test Dialog">
        <div>Content</div>
      </Modal>
    );

    expect(html).toContain("Test Dialog");
    expect(html).toContain("Content");
    expect(html).toContain("w-[min(34rem,calc(100vw-2rem))]");
  });

  it("renders with size '2xl' for wide complex views", () => {
    const html = renderToStaticMarkup(
      <Modal open={true} onClose={vi.fn()} title="Staff Profile" size="2xl">
        <div>Wide Content</div>
      </Modal>
    );

    expect(html).toContain("w-[min(68rem,calc(100vw-3rem))]");
    expect(html).toContain("Wide Content");
  });

  it("renders with size 'xl' for onboarding forms", () => {
    const html = renderToStaticMarkup(
      <Modal open={true} onClose={vi.fn()} title="Staff Onboarding" size="xl">
        <div>Onboarding Form</div>
      </Modal>
    );

    expect(html).toContain("w-[min(56rem,calc(100vw-2.5rem))]");
  });

  it("renders subtitle when provided", () => {
    const html = renderToStaticMarkup(
      <Modal
        open={true}
        onClose={vi.fn()}
        title="Settings"
        subtitle="Manage your preference configurations"
      >
        <div>Settings Content</div>
      </Modal>
    );

    expect(html).toContain("Manage your preference configurations");
  });

  it("renders headerAction when provided", () => {
    const html = renderToStaticMarkup(
      <Modal
        open={true}
        onClose={vi.fn()}
        title="Settings"
        headerAction={<button id="custom-action">Export</button>}
      >
        <div>Content</div>
      </Modal>
    );

    expect(html).toContain('id="custom-action"');
    expect(html).toContain("Export");
  });
});
