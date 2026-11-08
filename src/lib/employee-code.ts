export const EMPLOYEE_CODE_PREFIX = 'SAR' as const;

export type LoginIdentifier =
  | { type: 'email'; value: string }
  | { type: 'code'; value: string };

/**
 * Formats an employee code given a 4-digit year and positive sequence number.
 * Minimum 3-digit padding for sequence; expands if sequence >= 1000.
 *
 * @example
 * formatEmployeeCode(2024, 1) // "SAR-2024-001"
 * formatEmployeeCode(2024, 42) // "SAR-2024-042"
 * formatEmployeeCode(2024, 1050) // "SAR-2024-1050"
 */
export function formatEmployeeCode(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid year: ${year}. Expected a 4-digit integer year.`);
  }
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error(`Invalid sequence: ${sequence}. Expected a positive integer sequence.`);
  }

  const paddedSequence = sequence.toString().padStart(3, '0');
  return `${EMPLOYEE_CODE_PREFIX}-${year}-${paddedSequence}`;
}

export const generateEmployeeCode = formatEmployeeCode;

/**
 * Parses an employee code matching `^SAR-(\d{4})-(\d+)$` (case-insensitive).
 * Returns null if the code does not match.
 */
export function parseEmployeeCode(code: string): {
  prefix: string;
  year: number;
  sequence: number;
} | null {
  if (!code || typeof code !== 'string') {
    return null;
  }

  const trimmed = code.trim();
  const match = /^SAR-(\d{4})-(\d+)$/i.exec(trimmed);
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const sequence = parseInt(match[2], 10);

  if (isNaN(year) || isNaN(sequence) || sequence <= 0) {
    return null;
  }

  return {
    prefix: EMPLOYEE_CODE_PREFIX,
    year,
    sequence,
  };
}

/**
 * Normalizes a login identifier input (either an email address or employee code/username).
 * - If input contains `@`, trims and lowercases as email.
 * - Otherwise trims, uppercases, and extracts SAR-YYYY-NNN format if recognizable.
 * - Falls back to trimmed uppercase string for unrecognized usernames.
 */
export function normalizeLoginIdentifier(input: string): LoginIdentifier {
  if (typeof input !== 'string') {
    return { type: 'code', value: '' };
  }

  const trimmed = input.trim();
  if (trimmed.includes('@')) {
    return {
      type: 'email',
      value: trimmed.toLowerCase(),
    };
  }

  const rawUpper = trimmed.toUpperCase();
  const compact = rawUpper.replace(/[\s-]+/g, '');
  const match = /^SAR(\d{4})(\d+)$/.exec(compact);

  if (match) {
    const year = parseInt(match[1], 10);
    const sequence = parseInt(match[2], 10);
    if (year >= 1000 && year <= 9999 && sequence > 0) {
      return {
        type: 'code',
        value: formatEmployeeCode(year, sequence),
      };
    }
  }

  return {
    type: 'code',
    value: rawUpper,
  };
}
