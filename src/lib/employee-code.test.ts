import { describe, it, expect } from "vitest";
import {
  EMPLOYEE_CODE_PREFIX,
  formatEmployeeCode,
  generateEmployeeCode,
  parseEmployeeCode,
  normalizeLoginIdentifier,
} from "./employee-code";

describe("employee-code", () => {
  describe("formatEmployeeCode", () => {
    it("has the expected prefix constant", () => {
      expect(EMPLOYEE_CODE_PREFIX).toBe("SAR");
    });

    it("formats 1-digit sequences with 3-digit zero-padding", () => {
      expect(formatEmployeeCode(2024, 1)).toBe("SAR-2024-001");
      expect(formatEmployeeCode(2024, 7)).toBe("SAR-2024-007");
    });

    it("formats 2-digit sequences with 3-digit zero-padding", () => {
      expect(formatEmployeeCode(2024, 42)).toBe("SAR-2024-042");
    });

    it("formats 3-digit sequences without changing length", () => {
      expect(formatEmployeeCode(2024, 100)).toBe("SAR-2024-100");
      expect(formatEmployeeCode(2024, 999)).toBe("SAR-2024-999");
    });

    it("expands sequence to 4 digits or more for sequence >= 1000", () => {
      expect(formatEmployeeCode(2024, 1000)).toBe("SAR-2024-1000");
      expect(formatEmployeeCode(2024, 1050)).toBe("SAR-2024-1050");
      expect(formatEmployeeCode(2025, 12345)).toBe("SAR-2025-12345");
    });

    it("generateEmployeeCode is an alias for formatEmployeeCode", () => {
      expect(generateEmployeeCode(2024, 42)).toBe(formatEmployeeCode(2024, 42));
    });

    it("throws an error for non-positive sequences", () => {
      expect(() => formatEmployeeCode(2024, 0)).toThrow(/sequence/i);
      expect(() => formatEmployeeCode(2024, -1)).toThrow(/sequence/i);
    });

    it("throws an error for non-integer sequences", () => {
      expect(() => formatEmployeeCode(2024, 1.5)).toThrow(/sequence/i);
      expect(() => formatEmployeeCode(2024, NaN)).toThrow(/sequence/i);
    });

    it("throws an error for invalid years", () => {
      expect(() => formatEmployeeCode(999, 1)).toThrow(/year/i);
      expect(() => formatEmployeeCode(10000, 1)).toThrow(/year/i);
      expect(() => formatEmployeeCode(2024.5, 1)).toThrow(/year/i);
      expect(() => formatEmployeeCode(-2024, 1)).toThrow(/year/i);
      expect(() => formatEmployeeCode(NaN, 1)).toThrow(/year/i);
    });
  });

  describe("parseEmployeeCode", () => {
    it("parses valid formatted employee codes", () => {
      expect(parseEmployeeCode("SAR-2024-001")).toEqual({
        prefix: "SAR",
        year: 2024,
        sequence: 1,
      });
      expect(parseEmployeeCode("SAR-2024-042")).toEqual({
        prefix: "SAR",
        year: 2024,
        sequence: 42,
      });
      expect(parseEmployeeCode("SAR-2024-1050")).toEqual({
        prefix: "SAR",
        year: 2024,
        sequence: 1050,
      });
    });

    it("parses case-insensitively and trims whitespace", () => {
      expect(parseEmployeeCode("sar-2024-001")).toEqual({
        prefix: "SAR",
        year: 2024,
        sequence: 1,
      });
      expect(parseEmployeeCode("  SAR-2025-015  ")).toEqual({
        prefix: "SAR",
        year: 2025,
        sequence: 15,
      });
    });

    it("returns null for invalid or unrecognized codes", () => {
      expect(parseEmployeeCode("")).toBeNull();
      expect(parseEmployeeCode("invalid")).toBeNull();
      expect(parseEmployeeCode("ABC-2024-001")).toBeNull();
      expect(parseEmployeeCode("SAR-24-001")).toBeNull();
      expect(parseEmployeeCode("SAR-2024")).toBeNull();
      expect(parseEmployeeCode("SAR-2024-")).toBeNull();
      expect(parseEmployeeCode("SAR-2024-ABC")).toBeNull();
      expect(parseEmployeeCode(null as unknown as string)).toBeNull();
    });
  });

  describe("normalizeLoginIdentifier", () => {
    it("normalizes email addresses by trimming and lowercasing", () => {
      expect(normalizeLoginIdentifier("admin@school.org")).toEqual({
        type: "email",
        value: "admin@school.org",
      });
      expect(normalizeLoginIdentifier("  ADMIN@School.ORG  ")).toEqual({
        type: "email",
        value: "admin@school.org",
      });
      expect(
        normalizeLoginIdentifier("  teacher.one+test@sarvodaya.edu  ")
      ).toEqual({
        type: "email",
        value: "teacher.one+test@sarvodaya.edu",
      });
    });

    it("normalizes employee codes with various formats to standard SAR-YYYY-NNN", () => {
      expect(normalizeLoginIdentifier("sar2024001")).toEqual({
        type: "code",
        value: "SAR-2024-001",
      });
      expect(normalizeLoginIdentifier("sar-2024-001")).toEqual({
        type: "code",
        value: "SAR-2024-001",
      });
      expect(normalizeLoginIdentifier("SAR 2024 1")).toEqual({
        type: "code",
        value: "SAR-2024-001",
      });
      expect(normalizeLoginIdentifier("  sar   2024   42  ")).toEqual({
        type: "code",
        value: "SAR-2024-042",
      });
      expect(normalizeLoginIdentifier("sar-2024-1")).toEqual({
        type: "code",
        value: "SAR-2024-001",
      });
      expect(normalizeLoginIdentifier("SAR-2024-1050")).toEqual({
        type: "code",
        value: "SAR-2024-1050",
      });
      expect(normalizeLoginIdentifier("sar20241050")).toEqual({
        type: "code",
        value: "SAR-2024-1050",
      });
      expect(normalizeLoginIdentifier("SAR 2024 1050")).toEqual({
        type: "code",
        value: "SAR-2024-1050",
      });
    });

    it("falls back to uppercase trimmed value for unrecognized codes / usernames", () => {
      expect(normalizeLoginIdentifier("admin")).toEqual({
        type: "code",
        value: "ADMIN",
      });
      expect(normalizeLoginIdentifier("  principal  ")).toEqual({
        type: "code",
        value: "PRINCIPAL",
      });
      expect(normalizeLoginIdentifier("custom-username")).toEqual({
        type: "code",
        value: "CUSTOM-USERNAME",
      });
      expect(normalizeLoginIdentifier("SAR")).toEqual({
        type: "code",
        value: "SAR",
      });
      expect(normalizeLoginIdentifier("SAR2024")).toEqual({
        type: "code",
        value: "SAR2024",
      });
      expect(normalizeLoginIdentifier("")).toEqual({
        type: "code",
        value: "",
      });
    });
  });
});
