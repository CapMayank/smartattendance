import { describe, it, expect } from "vitest";
import { calculateStaffPayroll, PayrollCalculationInput } from "./payroll-calc";

describe("calculateStaffPayroll", () => {
  describe("Validation & Defaults", () => {
    it("returns null when totalDays is 0", () => {
      const result = calculateStaffPayroll({
        monthlyCtc: 20000,
        presentDays: 20,
        totalDays: 0,
      });
      expect(result).toBeNull();
    });

    it("defaults payGroup to BANK_EPF when not provided", () => {
      const result = calculateStaffPayroll({
        monthlyCtc: 22400, // 20,000 gross
        presentDays: 30,
        totalDays: 30,
      });
      expect(result).not.toBeNull();
      expect(result?.payGroup).toBe("BANK_EPF");
      expect(result?.employeeEpf).toBeGreaterThan(0);
    });

    it("caps validPresentDays to totalDays so ncpDays is not negative", () => {
      const result = calculateStaffPayroll({
        monthlyCtc: 22400,
        presentDays: 35,
        totalDays: 30,
      });
      expect(result).not.toBeNull();
      expect(result?.ncpDays).toBe(0);
      expect(result?.basicWage).toBe(20000);
    });
  });

  describe("BANK_EPF Calculation Engine", () => {
    it("calculates full month salary matching standard EPFO formula", () => {
      // CTC = 21,280 -> baseGross = 21,280 / 1.12 = 19,000
      const input: PayrollCalculationInput = {
        payGroup: "BANK_EPF",
        monthlyCtc: 21280,
        presentDays: 30,
        totalDays: 30,
        refundOfAdvance: 1000,
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.payGroup).toBe("BANK_EPF");
      expect(result.basicWage).toBe(19000);
      expect(result.grossWage).toBe(19000);
      expect(result.epfWages).toBe(19000);
      expect(result.epsWages).toBe(19000);
      expect(result.edliWages).toBe(19000);

      // employeeEpf = round(19000 * 0.12) = 2280
      expect(result.employeeEpf).toBe(2280);

      // Standard member: employerEps = round(19000 * 0.0833) = 1583 (strictly 8.33% up to ceiling, ZERO 1.16% surcharge)
      expect(result.employerEps).toBe(1583);

      // employerEpf = round(19000 * 0.12) - employerEps = 2280 - 1583 = 697
      expect(result.employerEpf).toBe(697);

      // actualCtc = round(grossWage + employeeEpf) = 19000 + 2280 = 21280
      expect(result.actualCtc).toBe(21280);

      // netPayment = round(grossWage - employeeEpf - refundOfAdvance) = 19000 - 2280 - 1000 = 15720
      expect(result.netPayment).toBe(15720);
      expect(result.ncpDays).toBe(0);
    });

    it("calculates partial month with daily pro-rata", () => {
      // CTC = 22,400 -> baseGross = 20,000. wagePerDay = round(20000 / 30) = 667
      // presentDays = 15 -> basicWage = 667 * 15 = 10005
      const input: PayrollCalculationInput = {
        payGroup: "BANK_EPF",
        monthlyCtc: 22400,
        presentDays: 15,
        totalDays: 30,
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.basicWage).toBe(10005);
      expect(result.grossWage).toBe(10005);
      expect(result.ncpDays).toBe(15);
      expect(result.epfWages).toBe(10005);
      expect(result.employeeEpf).toBe(Math.round(10005 * 0.12));
    });

    it("calculates bonus based on DAYS and pro-rata wagePerDay", () => {
      // CTC = 22,400 -> baseGross = 20,000. wagePerDay = round(20000 / 30) = 667
      const input: PayrollCalculationInput = {
        payGroup: "BANK_EPF",
        monthlyCtc: 22400,
        presentDays: 30,
        totalDays: 30,
        bonusType: "DAYS",
        bonusDays: 3,
        bonusAmount: 0,
        isBonusPfApplicable: true,
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      const expectedBonus = 667 * 3; // 2001
      expect(result.bonusAmount).toBe(expectedBonus);
      expect(result.grossWage).toBe(20000 + expectedBonus);
      // Because isBonusPfApplicable is true:
      expect(result.epfWages).toBe(20000 + expectedBonus);
    });

    it("excludes bonus from EPF wages when isBonusPfApplicable is false", () => {
      const input: PayrollCalculationInput = {
        payGroup: "BANK_EPF",
        monthlyCtc: 22400,
        presentDays: 30,
        totalDays: 30,
        bonusType: "CUSTOM",
        bonusAmount: 3000,
        isBonusPfApplicable: false,
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.bonusAmount).toBe(3000);
      expect(result.grossWage).toBe(23000);
      expect(result.epfWages).toBe(20000); // Only basicWage
    });

    it("caps EPS and EDLI wages at 25,000", () => {
      // High earner CTC = 44,800 -> baseGross = 40,000
      const input: PayrollCalculationInput = {
        payGroup: "BANK_EPF",
        monthlyCtc: 44800,
        presentDays: 30,
        totalDays: 30,
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.epfWages).toBe(40000);
      expect(result.epsWages).toBe(25000);
      expect(result.edliWages).toBe(25000);
      // Under 25k ceiling, standard member employer EPS = round(25000 * 0.0833) = 2083
      expect(result.employerEps).toBe(2083);
      // Employer EPF = 40000 * 0.12 - 2083 = 4800 - 2083 = 2717
      expect(result.employerEpf).toBe(2717);
    });

    it("calculates standard member with ₹20,000 wage: employer EPS = 1666, employer EPF = 734 without 1.16% surcharge", () => {
      // CTC = 22,400 -> baseGross = 20,000
      const input: PayrollCalculationInput = {
        payGroup: "BANK_EPF",
        monthlyCtc: 22400,
        presentDays: 30,
        totalDays: 30,
        targetMonthYear: "2026-11", // Post-Sep 2026 hike
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.epfWages).toBe(20000);
      expect(result.epsWages).toBe(20000);
      expect(result.employeeEpf).toBe(2400); // 12%
      // Strictly 8.33% up to ceiling, ZERO 1.16% surcharge:
      expect(result.employerEps).toBe(1666); // round(20000 * 0.0833) = 1666
      expect(result.employerEpf).toBe(734);  // 2400 - 1666 = 734
      expect(result.employerEps + result.employerEpf).toBe(2400);
    });

    it("preserves historical ₹15,000 ceiling for months prior to September 2026 (e.g. 2026-07)", () => {
      // For July 2026, ₹20,000 wage must be capped at ₹15,000 for EPS
      const input: PayrollCalculationInput = {
        payGroup: "BANK_EPF",
        monthlyCtc: 22400, // 20,000 gross
        presentDays: 30,
        totalDays: 30,
        targetMonthYear: "2026-07", // Historical month before Sep 2026
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.epfWages).toBe(20000);
      expect(result.epsWages).toBe(15000); // Capped at historical ₹15,000
      expect(result.edliWages).toBe(15000);
      expect(result.employerEps).toBe(1250); // round(15000 * 0.0833) = 1250
      expect(result.employerEpf).toBe(1150); // 2400 - 1250 = 1150
      expect(result.employerEps + result.employerEpf).toBe(2400);
    });

    it("applies POHW 1.16% surcharge only when isHigherPensionOpted is true", () => {
      // CTC = 22,400 -> baseGross = 20,000, opt-in for higher pension
      const input: PayrollCalculationInput = {
        payGroup: "BANK_EPF",
        monthlyCtc: 22400,
        presentDays: 30,
        totalDays: 30,
        targetMonthYear: "2026-07", // Threshold = 15,000
        isHigherPensionOpted: true,
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.epfWages).toBe(20000);
      expect(result.epsWages).toBe(20000); // Uncapped because higher pension opted
      // Base EPS = 15000 * 0.0833 = 1250
      // Excess = 20000 - 15000 = 5000
      // Surcharge = 5000 * (0.0833 + 0.0116) = round(5000 * 0.0949) = 475
      // employerEps = 1250 + 475 = 1725
      expect(result.employerEps).toBe(1725);
      expect(result.employerEpf).toBe(2400 - 1725); // 675
      expect(result.employerEps + result.employerEpf).toBe(2400);
    });
  });

  describe("CASH Calculation Engine", () => {
    it("calculates full month cash salary directly from monthlyCtc without PF deductions", () => {
      const input: PayrollCalculationInput = {
        payGroup: "CASH",
        monthlyCtc: 15000, // For CASH, monthlyCtc is the agreed cash wage
        presentDays: 30,
        totalDays: 30,
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.payGroup).toBe("CASH");
      expect(result.basicWage).toBe(15000);
      expect(result.grossWage).toBe(15000);
      expect(result.actualCtc).toBe(15000);
      expect(result.netPayment).toBe(15000);
      expect(result.ncpDays).toBe(0);

      // All EPF / EPS / EDLI fields must be strictly 0
      expect(result.epfWages).toBe(0);
      expect(result.epsWages).toBe(0);
      expect(result.edliWages).toBe(0);
      expect(result.employeeEpf).toBe(0);
      expect(result.employerEps).toBe(0);
      expect(result.employerEpf).toBe(0);
    });

    it("calculates partial month cash salary using monthlyCtc daily pro-rata", () => {
      // monthlyCtc = 15000, totalDays = 30 -> wagePerDay = 500
      // presentDays = 18 -> basicWage = 18 * 500 = 9000
      const input: PayrollCalculationInput = {
        payGroup: "CASH",
        monthlyCtc: 15000,
        presentDays: 18,
        totalDays: 30,
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.payGroup).toBe("CASH");
      expect(result.basicWage).toBe(9000);
      expect(result.grossWage).toBe(9000);
      expect(result.actualCtc).toBe(9000);
      expect(result.netPayment).toBe(9000);
      expect(result.ncpDays).toBe(12);
      expect(result.employeeEpf).toBe(0);
    });

    it("handles cash bonuses (DAYS mode) and advance deductions", () => {
      // monthlyCtc = 18000, totalDays = 30 -> wagePerDay = 600
      // presentDays = 25 -> basicWage = 25 * 600 = 15000
      // bonusDays = 2 -> bonus = 2 * 600 = 1200
      // grossWage = 15000 + 1200 = 16200
      // refundOfAdvance = 2500
      // netPayment = 16200 - 2500 = 13700
      const input: PayrollCalculationInput = {
        payGroup: "CASH",
        monthlyCtc: 18000,
        presentDays: 25,
        totalDays: 30,
        bonusType: "DAYS",
        bonusDays: 2,
        refundOfAdvance: 2500,
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.bonusAmount).toBe(1200);
      expect(result.grossWage).toBe(16200);
      expect(result.actualCtc).toBe(16200);
      expect(result.netPayment).toBe(13700);
      expect(result.employeeEpf).toBe(0);
      expect(result.epfWages).toBe(0);
    });

    it("handles cash custom bonus and preserves zero PF even if isBonusPfApplicable is true", () => {
      const input: PayrollCalculationInput = {
        payGroup: "CASH",
        monthlyCtc: 12000,
        presentDays: 30,
        totalDays: 30,
        bonusType: "CUSTOM",
        bonusAmount: 1500,
        isBonusPfApplicable: true, // Should still have zero PF!
      };

      const result = calculateStaffPayroll(input);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.basicWage).toBe(12000);
      expect(result.bonusAmount).toBe(1500);
      expect(result.grossWage).toBe(13500);
      expect(result.actualCtc).toBe(13500);
      expect(result.netPayment).toBe(13500);
      expect(result.epfWages).toBe(0);
      expect(result.epsWages).toBe(0);
      expect(result.edliWages).toBe(0);
      expect(result.employeeEpf).toBe(0);
      expect(result.employerEps).toBe(0);
      expect(result.employerEpf).toBe(0);
    });
  });
});
