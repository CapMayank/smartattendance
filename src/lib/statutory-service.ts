import { prisma } from "@/lib/prisma";
import { DEFAULT_STATUTORY_RULES, StatutoryRule, resolveStatutoryRule } from "./statutory-config";

export const STATUTORY_RULES_SETTING_KEY = "STATUTORY_RULES";

/**
 * Loads statutory rules from SystemSetting or falls back to DEFAULT_STATUTORY_RULES.
 */
export async function getStatutoryRules(): Promise<StatutoryRule[]> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: STATUTORY_RULES_SETTING_KEY },
    });

    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as StatutoryRule[];
      }
    }
  } catch (error) {
    console.error("Failed to parse statutory rules from SystemSetting:", error);
  }

  return DEFAULT_STATUTORY_RULES;
}

/**
 * Resolves the statutory rule for a specific target month/year (e.g. "2026-11").
 */
export async function getStatutoryRuleForMonth(
  targetMonthYear?: string | null
): Promise<StatutoryRule> {
  const rules = await getStatutoryRules();
  return resolveStatutoryRule(targetMonthYear, rules);
}
