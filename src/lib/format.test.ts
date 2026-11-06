import { describe, it, expect } from "vitest";
import { formatINR, formatTime, formatDateLong } from "./format";

describe("format helpers", () => {
  it("formats INR with en-IN grouping", () => {
    expect(formatINR(1842350)).toBe("₹18,42,350");
  });
  it("formats INR with paise", () => {
    expect(formatINR(1842350, { paise: true })).toBe("₹18,42,350.00");
  });
  it("formats zero", () => {
    expect(formatINR(0)).toBe("₹0");
  });
  it("formats exact amounts with up to 3 fraction digits", () => {
    expect(formatINR(25000.5, { exact: true })).toBe("₹25,000.5");
    expect(formatINR(1500.75, { exact: true })).toBe("₹1,500.75");
    expect(formatINR(1666.6667, { exact: true })).toBe("₹1,666.667");
    expect(formatINR(56000, { exact: true })).toBe("₹56,000");
  });
  it("formats time in IST", () => {
    expect(formatTime(new Date("2026-11-06T04:12:00Z"))).toBe("09:42");
  });
  it("formats long date in IST", () => {
    expect(formatDateLong(new Date("2026-11-05T19:00:00Z"))).toBe("Friday, 6 November 2026");
  });
});
