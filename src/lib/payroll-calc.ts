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
}

/**
 * Calculates monthly payroll for a staff member based on their pay group.
 * Supports:
 *  - "BANK_EPF": CTC divided by 1.12 with statutory EPFO ECR EPF/EPS/EDLI contributions
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
  const epsWages = Math.min(epfWages, 25000);
  const edliWages = Math.min(epfWages, 25000);

  const employeeEpf = Math.round(epfWages * 0.12);

  // EPFO ECR calculation for EPS (Account 10):
  // 8.33% on EPS wages (up to 25,000)
  // PLUS 1.16% on wages exceeding 15,000 for POHW cases (EPFO ECR rule RFE-25)
  const baseEps = Math.round(epsWages * 0.0833);
  const excessEpsWage = Math.max(0, epsWages - 15000);
  const pohwSurcharge = Math.round(excessEpsWage * 0.0116);
  const employerEps = baseEps + pohwSurcharge;

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
  };
}
