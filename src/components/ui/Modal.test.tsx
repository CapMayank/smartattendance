import { describe, it, expect, vi } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
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

  it("uses open:flex instead of unconditional flex on the dialog element", () => {
    const html = renderToStaticMarkup(
      <Modal open={true} onClose={vi.fn()} title="Test Dialog">
        <div>Content</div>
      </Modal>
    );

    const dialogClass = html.match(/<dialog[^>]*class="([^"]*)"/)?.[1] ?? "";
    const classes = dialogClass.split(/\s+/);
    expect(classes).toContain("open:flex");
    expect(classes).toContain("open:flex-col");
    // Ensure unconditional 'flex' or 'flex-col' is not applied directly to the dialog class list
    expect(classes).not.toContain("flex");
    expect(classes).not.toContain("flex-col");
  });

  it("does not render open boolean attribute on dialog tag when open is false", () => {
    const html = renderToStaticMarkup(
      <Modal open={false} onClose={vi.fn()} title="Closed Dialog">
        <div>Hidden Content</div>
      </Modal>
    );

    // Ensure the dialog tag does NOT have an 'open' attribute (e.g. '<dialog open ...>')
    expect(html).not.toMatch(/<dialog(?:\s+[^>]*)?\sopen(?:\s|>|=)/);
  });

  it("enforces closed dialogs to be hidden in globals.css", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf-8");
    expect(css).toMatch(/dialog:not\(\[open\]\)[\s\S]*display:\s*none\s*!important/);
    expect(css).toMatch(/\.ui-dialog:not\(\[open\]\)[\s\S]*display:\s*none\s*!important/);
    expect(css).toMatch(/\.ui-dialog\[open\][\s\S]*display:\s*flex\s*!important/);
  });
});
