import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { redactForLog, summarizeMessage } = require("./redact.js");

describe("redactForLog", () => {
  it("redacts image keys and long strings", () => {
    const out = redactForLog({ image: "abc", long: "y".repeat(201), ok: "short" });
    expect(out).toEqual({ image: "<redacted 3 chars>", long: "<redacted 201 chars>", ok: "short" });
  });

  it("recurses through arrays and nested objects", () => {
    const out = redactForLog({ record: [{ a: { image: "q".repeat(10) } }, "z".repeat(300)] });
    expect(out).toEqual({ record: [{ a: { image: "<redacted 10 chars>" } }, "<redacted 300 chars>"] });
  });

  it("leaves short strings, numbers and null unchanged", () => {
    expect(redactForLog("hi")).toBe("hi");
    expect(redactForLog(5)).toBe(5);
    expect(redactForLog(null)).toBeNull();
    expect(redactForLog("x".repeat(200))).toBe("x".repeat(200));
  });

  it("does not mutate its input", () => {
    const input = { image: "abc", list: [{ image: "def" }] };
    const copy = JSON.parse(JSON.stringify(input));
    redactForLog(input);
    expect(input).toEqual(copy);
  });
});

describe("summarizeMessage", () => {
  it("summarizes a sendlog without the image", () => {
    const line = summarizeMessage({
      cmd: "sendlog",
      sn: "A1",
      count: 1,
      record: [{ enrollid: 7, time: "2026-11-05 17:32:25", image: "x".repeat(5000) }],
    });
    expect(line).not.toMatch(/\n/);
    expect(line).toContain("sendlog");
    expect(line).toContain("A1");
    expect(line).toContain("enrollid 7");
    expect(line).toContain("2026-11-05 17:32:25");
    expect(line).not.toContain("xxxxx");
  });

  it("handles a message with no record", () => {
    const line = summarizeMessage({ cmd: "reg", sn: "A1" });
    expect(line).toContain("reg");
    expect(line).not.toMatch(/\n/);
  });
});
