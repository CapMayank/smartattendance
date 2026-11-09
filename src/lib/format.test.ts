import { describe, it, expect } from "vitest";
import { formatINR, formatTime, formatTimeSeconds, formatDateLong, formatPing, formatTimeOpt, formatHHmm, formatDate } from "./format";

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
    expect(formatTime(new Date("2026-11-06T04:12:00Z"))).toBe("9:42 am");
    expect(formatTime(new Date("2026-11-06T10:00:00Z"))).toBe("3:30 pm");
  });
  it("formats time with seconds in IST", () => {
    expect(formatTimeSeconds(new Date("2026-11-06T04:12:07Z"))).toBe("9:42:07 am");
    expect(formatTimeSeconds(new Date("2026-11-06T18:30:00Z"))).toBe("12:00:00 am");
    expect(formatTimeSeconds(new Date("2026-11-06T06:30:00Z"))).toBe("12:00:00 pm");
  });
  it("formatTimeOpt handles empty, invalid, and 24h strings", () => {
    expect(formatTimeOpt(null)).toBe("-");
    expect(formatTimeOpt("garbage")).toBe("-");
    expect(formatTimeOpt("2026-11-06T04:00:00Z")).toBe("9:30 am");
    expect(formatTimeOpt("09:05")).toBe("9:05 am");
    expect(formatTimeOpt("17:30")).toBe("5:30 pm");
  });
  it("formats stored HH:mm, HH:mm:ss, and dates", () => {
    expect(formatHHmm("09:55")).toBe("9:55 am");
    expect(formatHHmm("09:55:00")).toBe("9:55 am");
    expect(formatHHmm("17:00")).toBe("5:00 pm");
    expect(formatHHmm("00:05")).toBe("12:05 am");
    expect(formatDate(new Date("2026-11-05T19:00:00Z"))).toBe("06 Nov 2026");
  });
  it("formats long date in IST", () => {
    expect(formatDateLong(new Date("2026-11-05T19:00:00Z"))).toBe("Friday, 6 November 2026");
  });
  it("formats a ping from the same IST day as time only", () => {
    expect(formatPing(new Date("2026-11-06T04:12:00Z"), new Date("2026-11-06T10:00:00Z"))).toBe("9:42 am");
  });
  it("formats a ping from an earlier IST day with date and time", () => {
    expect(formatPing(new Date("2026-11-03T12:42:00Z"), new Date("2026-11-06T10:00:00Z"))).toBe("3 Nov 6:12 pm");
  });
});
