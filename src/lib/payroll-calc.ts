import { resolveStatutoryRule, StatutoryRule } from "./statutory-config";

export type PayGroup = "BANK_EPF" | "CASH";

export interface PayrollCalculationInput {
  payGroup?: PayGroup; // Defaults to "BANK_EPF"
  monthlyCtc: number;   // For CASH, this is treated as the plain monthly wage
  presentDays: number;
  totalDays: number;
  refundOfAdvance?: number;
  bonusAmount?: number;
  bonusDays?: number;
  bonusType?: string; // "DAYS" | "CUSTOM"
  isBonusPfApplicable?: boolean;
  targetMonthYear?: string; // "YYYY-MM" (e.g. "2026-11", "2026-07")
  isHigherPensionOpted?: boolean; // Defaults to false
  statutoryRule?: StatutoryRule;
}

export interface PayrollCalculationResult {
  actualCtc: number;
  grossWage: number;
  basicWage: number;
  bonusAmount: number;
  bonusDays: number;
  bonusType: string;
  isBonusPfApplicable: boolean;
  epfWages: number;
  epsWages: number;
  edliWages: number;
  employeeEpf: number;
  employerEps: number;
  employerEpf: number;
  netPayment: number;
  ncpDays: number;
  payGroup: PayGroup;
  appliedCeiling?: number;
}

/** The calculation fields that are stored as MonthlyPayroll columns. */
export type PayrollColumns = Omit<PayrollCalculationResult, "appliedCeiling">;

/**
 * Strips display-only fields (e.g. `appliedCeiling`) from a calculation so the
 * result can be written to MonthlyPayroll. Prisma rejects unknown columns, so
 * never spread a raw calculation result into a create/update.
 */
export function payrollColumns(calc: PayrollCalculationResult): PayrollColumns {
  const { appliedCeiling: _appliedCeiling, ...columns } = calc;
  void _appliedCeiling;
  return columns;
}

/**
 * Calculates monthly payroll for a staff member based on their pay group.
 * Supports:
 *  - "BANK_EPF": CTC divided by 1.12 with statutory EPFO ECR EPF/EPS/EDLI contributions
 *    Statutory ceilings and rates are versioned by effective month (e.g. ₹15,000 pre-Sep 2026, ₹25,000 post-Sep 2026).
 *    For standard members, EPS contribution is strictly 8.33% up to statutory ceiling (ZERO 1.16% surcharge).
 *    For higher-pension optees (isHigherPensionOpted = true), POHW surcharge applies above threshold.
 *  - "CASH": Plain monthly wage without 1.12 division and zero EPF/EPS/EDLI contributions
 */
export function calculateStaffPayroll(
  input: PayrollCalculationInput
): PayrollCalculationResult | null {
  const {
    monthlyCtc,
    presentDays,
    totalDays,
    refundOfAdvance = 0,
    bonusAmount = 0,
    bonusDays = 0,
    bonusType = "CUSTOM",
    isBonusPfApplicable = false,
    targetMonthYear,
    isHigherPensionOpted = false,
    statutoryRule,
  } = input;

  if (totalDays === 0) return null;

  const payGroup: PayGroup = input.payGroup === "CASH" ? "CASH" : "BANK_EPF";
  const validPresentDays = Math.min(presentDays, totalDays);
  const ncpDays = Math.max(0, totalDays - validPresentDays);
  const refund = Number(refundOfAdvance) || 0;
  const numBonusDays = Number(bonusDays) || 0;

  if (payGroup === "CASH") {
    // For CASH: monthlyCtc is the agreed plain monthly salary directly (no 1.12 division)
    const wagePerDay = Math.round(monthlyCtc / totalDays);
    const basicWage =
      validPresentDays === totalDays ? monthlyCtc : wagePerDay * validPresentDays;

    let finalBonus = Number(bonusAmount) || 0;
    if (bonusType === "DAYS" && numBonusDays > 0 && finalBonus === 0) {
      finalBonus = Math.round(wagePerDay * numBonusDays);
    }

    const grossWage = Math.round(basicWage + finalBonus);
    const actualCtc = grossWage;
    const netPayment = Math.round(grossWage - refund);

    return {
      actualCtc,
      grossWage,
      basicWage: Math.round(basicWage),
      bonusAmount: Math.round(finalBonus),
      bonusDays: numBonusDays,
      bonusType,
      isBonusPfApplicable,
      epfWages: 0,
      epsWages: 0,
      edliWages: 0,
      employeeEpf: 0,
      employerEps: 0,
      employerEpf: 0,
      netPayment,
      ncpDays,
      payGroup: "CASH",
    };
  }

  // BANK_EPF Engine:
  // Base Total Wage (Gross) from CTC (CTC = Gross + 12% of Gross) -> Gross = CTC / 1.12
  const baseGrossWage = monthlyCtc / 1.12;
  const wagePerDay = Math.round(baseGrossWage / totalDays);

  const basicWage =
    validPresentDays === totalDays ? baseGrossWage : wagePerDay * validPresentDays;

  let finalBonus = Number(bonusAmount) || 0;
  if (bonusType === "DAYS" && numBonusDays > 0 && finalBonus === 0) {
    finalBonus = Math.round(wagePerDay * numBonusDays);
  }

  const grossWage = Math.round(basicWage + finalBonus);

  // EPF wage: basicWage (+ bonus only if isBonusPfApplicable is true)
  const epfWages = Math.round(
    isBonusPfApplicable ? basicWage + finalBonus : basicWage
  );

  // Resolve statutory rule by target month/year
  const rule = statutoryRule || resolveStatutoryRule(targetMonthYear);
  const epsCeiling = rule.epsWageCeiling;
  const edliCeiling = rule.edliWageCeiling;

  const employeeEpf = Math.round(epfWages * 0.12);

  let epsWages = 0;
  let edliWages = 0;
  let employerEps = 0;

  if (isHigherPensionOpted) {
    // For members who opted for Pension on Higher Wages (POHW):
    // EPS wages are not capped at the statutory ceiling
    epsWages = epfWages;
    edliWages = Math.min(epfWages, edliCeiling);

    const baseEps = Math.round(Math.min(epsWages, rule.pohwThreshold) * 0.0833);
    const excessEpsWage = Math.max(0, epsWages - rule.pohwThreshold);
    const surcharge = Math.round(excessEpsWage * (0.0833 + rule.pohwSurchargeRate));
    employerEps = baseEps + surcharge;
  } else {
    // Standard member: Strictly 8.33% up to statutory ceiling, ZERO surcharge
    epsWages = Math.min(epfWages, epsCeiling);
    edliWages = Math.min(epfWages, edliCeiling);
    employerEps = Math.round(epsWages * 0.0833);
  }

  // Employer PF contribution (Account 1): strictly Due EPF - Due EPS (EPFO ECR rule RFE-37)
  const employerEpf = Math.round(epfWages * 0.12) - employerEps;

  const actualCtc = Math.round(grossWage + employeeEpf);
  const netPayment = Math.round(grossWage - employeeEpf - refund);

  return {
    actualCtc,
    grossWage,
    basicWage: Math.round(basicWage),
    bonusAmount: Math.round(finalBonus),
    bonusDays: numBonusDays,
    bonusType,
    isBonusPfApplicable,
    epfWages: Math.round(epfWages),
    epsWages: Math.round(epsWages),
    edliWages: Math.round(edliWages),
    employeeEpf,
    employerEps,
    employerEpf,
    netPayment,
    ncpDays,
    payGroup: "BANK_EPF",
    appliedCeiling: epsCeiling,
  };
}
