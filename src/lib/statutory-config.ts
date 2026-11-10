/**
 * Statutory Configuration for EPFO (EPF, EPS, EDLI) Wage Ceilings and Contribution Rules.
 *
 * Slabs are versioned by `effectiveFromMonth` ("YYYY-MM").
 * When payroll is calculated for a given month/year:
 *  - Months prior to "2026-09" apply the historical ₹15,000 wage ceiling.
 *  - Months from "2026-09" onwards apply the ₹25,000 wage ceiling (Gazette Notification S.O. 5109(E)).
 *  - Future statutory revisions added via UI apply only from their `effectiveFromMonth` onwards,
 *    strictly preserving previous calculations for historical months.
 */

export interface StatutoryRule {
  id: string;
  effectiveFromMonth: string; // "YYYY-MM" format (e.g. "2014-09", "2026-09")
  epsWageCeiling: number;      // Statutory EPS wage ceiling (e.g. 15000, 25000)
  edliWageCeiling: number;     // Statutory EDLI wage ceiling (e.g. 15000, 25000)
  pohwThreshold: number;       // Surcharge threshold for Pension on Higher Wages optees
  pohwSurchargeRate: number;   // Surcharge rate (0.0116 = 1.16% under SC Nov 2022 / MoL May 2023)
  label: string;
}

export const DEFAULT_STATUTORY_RULES: StatutoryRule[] = [
  {
    id: "statutory-2014-09",
    effectiveFromMonth: "2014-09",
    epsWageCeiling: 15000,
    edliWageCeiling: 15000,
    pohwThreshold: 15000,
    pohwSurchargeRate: 0.0116,
    label: "Statutory Ceiling ₹15,000 (Sep 2014 – Aug 2026)",
  },
  {
    id: "statutory-2026-09",
    effectiveFromMonth: "2026-09",
    epsWageCeiling: 25000,
    edliWageCeiling: 25000,
    pohwThreshold: 25000,
    pohwSurchargeRate: 0.0116,
    label: "Statutory Ceiling ₹25,000 (Gazette S.O. 5109(E) from Sep 2026)",
  },
];

/**
 * Resolves the applicable statutory rule for a target month and year.
 *
 * @param targetMonthYear - "YYYY-MM" string (e.g. "2026-11", "2026-07") or null/undefined
 * @param customRules - Optional custom rules loaded from SystemSetting
 * @returns The matched StatutoryRule
 */
export function resolveStatutoryRule(
  targetMonthYear?: string | null,
  customRules?: StatutoryRule[] | null
): StatutoryRule {
  const rules = (customRules && customRules.length > 0) ? customRules : DEFAULT_STATUTORY_RULES;
  // Sort descending by effectiveFromMonth so newest comes first
  const sorted = [...rules].sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth));

  if (!targetMonthYear || typeof targetMonthYear !== "string" || !/^\d{4}-\d{2}/.test(targetMonthYear)) {
    // If target month is omitted, default to the latest rule
    return sorted[0];
  }

  const normalized = targetMonthYear.slice(0, 7);

  // Find first rule where effectiveFromMonth <= target
  const matched = sorted.find((r) => r.effectiveFromMonth <= normalized);
  return matched || sorted[sorted.length - 1]; // Fallback to earliest rule if before all
}
