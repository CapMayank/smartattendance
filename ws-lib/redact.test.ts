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

  it("clips key names longer than 80 characters", () => {
    const longKey = "k".repeat(5000);
    const out = redactForLog({ [longKey]: "v", short: 1 });
    const keys = Object.keys(out);
    expect(keys).toHaveLength(2);
    expect(keys.every((k) => k.length < 120)).toBe(true);
    expect(keys).toContain("short");
    expect(JSON.stringify(out).length).toBeLessThan(300);
  });

  it("caps the number of keys printed per object", () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) many[`key${i}`] = i;
    const out = redactForLog({ record: many });
    const keys = Object.keys(out.record);
    expect(keys).toHaveLength(21);
    expect(keys.slice(0, 20)).toEqual(Array.from({ length: 20 }, (_, i) => `key${i}`));
    expect(out.record[keys[20]]).toBe("<+4980 more keys>");
    expect(JSON.stringify(out).length).toBeLessThan(600);
  });

  it("still redacts a large image value", () => {
    const out = redactForLog({ image: "z".repeat(5000) });
    expect(out).toEqual({ image: "<redacted 5000 chars>" });
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

describe("hostile and bounded input", () => {
  const { clip, clipJson } = require("./redact.js");
  const hostile = { toString: 1 };

  it("does not throw on object-valued fields", () => {
    const msg = {
      cmd: hostile,
      sn: hostile,
      count: hostile,
      record: [{ enrollid: hostile, time: hostile, image: hostile }, null, 5],
    };
    expect(() => summarizeMessage(msg)).not.toThrow();
    expect(() => redactForLog(msg)).not.toThrow();
    expect(() => clip(hostile)).not.toThrow();
    expect(clip(hostile)).toBe("<unprintable>");
    expect(summarizeMessage(null as unknown as object)).toContain("cmd");
  });

  it("clip collapses control chars and truncates with a marker", () => {
    expect(clip("a\r\nb\nc\td")).toBe("a  b c d");
    const out = clip("z".repeat(100), 80);
    expect(out).toContain("(+20 chars)");
    expect(out.startsWith("z".repeat(80))).toBe(true);
    expect(out).not.toMatch(/[\r\n]/);
  });

  it("clipJson clips string values", () => {
    const out = clipJson({ ret: "a\nb" + "q".repeat(200), result: true });
    expect(out).not.toContain("q".repeat(100));
    expect(out).toContain('"result":true');
  });

  it("bounds the summary for many records and never shows images", () => {
    const record = Array.from({ length: 500 }, (_, i) => ({
      enrollid: i,
      time: "2026-11-05 17:32:25",
      image: "IMGDATA".repeat(1000),
    }));
    const line = summarizeMessage({ cmd: "sendlog", sn: "A1", count: 500, record });
    expect(line.length).toBeLessThan(1000);
    expect(line).toContain("+490 more");
    expect(line).not.toContain("IMGDATA");
  });
});
