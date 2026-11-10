import { describe, it, expect } from "vitest";
import {
  DEFAULT_STATUTORY_RULES,
  resolveStatutoryRule,
  StatutoryRule,
} from "./statutory-config";

describe("statutory-config", () => {
  describe("resolveStatutoryRule", () => {
    it("returns latest rule when targetMonthYear is omitted", () => {
      const rule = resolveStatutoryRule();
      expect(rule.epsWageCeiling).toBe(25000);
      expect(rule.effectiveFromMonth).toBe("2026-09");
    });

    it("resolves historical ₹15,000 rule for months prior to September 2026", () => {
      const aug2026 = resolveStatutoryRule("2026-08");
      expect(aug2026.epsWageCeiling).toBe(15000);
      expect(aug2026.edliWageCeiling).toBe(15000);

      const jan2025 = resolveStatutoryRule("2025-01");
      expect(jan2025.epsWageCeiling).toBe(15000);

      const sep2014 = resolveStatutoryRule("2014-09");
      expect(sep2014.epsWageCeiling).toBe(15000);
    });

    it("resolves ₹25,000 rule for September 2026 onwards", () => {
      const sep2026 = resolveStatutoryRule("2026-09");
      expect(sep2026.epsWageCeiling).toBe(25000);
      expect(sep2026.edliWageCeiling).toBe(25000);

      const nov2026 = resolveStatutoryRule("2026-11");
      expect(nov2026.epsWageCeiling).toBe(25000);

      const dec2027 = resolveStatutoryRule("2027-12");
      expect(dec2027.epsWageCeiling).toBe(25000);
    });

    it("honors custom future slabs without mutating past calculations", () => {
      const customRules: StatutoryRule[] = [
        ...DEFAULT_STATUTORY_RULES,
        {
          id: "statutory-2027-04",
          effectiveFromMonth: "2027-04",
          epsWageCeiling: 30000,
          edliWageCeiling: 30000,
          pohwThreshold: 30000,
          pohwSurchargeRate: 0.0116,
          label: "Future FY2027 Ceiling ₹30,000",
        },
      ];

      // Past month remains unchanged
      expect(resolveStatutoryRule("2026-08", customRules).epsWageCeiling).toBe(15000);
      // Current month remains unchanged
      expect(resolveStatutoryRule("2026-11", customRules).epsWageCeiling).toBe(25000);
      expect(resolveStatutoryRule("2027-03", customRules).epsWageCeiling).toBe(25000);
      // Future month adopts new ceiling
      expect(resolveStatutoryRule("2027-04", customRules).epsWageCeiling).toBe(30000);
      expect(resolveStatutoryRule("2027-05", customRules).epsWageCeiling).toBe(30000);
    });

    it("falls back gracefully when target month is earlier than the earliest rule", () => {
      const rule = resolveStatutoryRule("2000-01");
      expect(rule.epsWageCeiling).toBe(15000);
    });
  });
});
