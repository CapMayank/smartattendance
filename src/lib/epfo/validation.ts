import {
  computeEpfJoiningDate,
  mapGender,
  mapMaritalStatus,
  mapRelationship,
  parseIsoDateKey,
  sanitizeEpfoName,
} from './mappings';
import { getEpfoNextAction, getLatestEmploymentPeriod } from './next-action';
import type {
  EpfoDocType,
  EpfoMemberInput,
  EpfoNextAction,
  EpfoValidationError,
  EpfoValidationResult,
} from './types';

const UAN_REGEX = /^\d{12}$/;
const AADHAAR_REGEX = /^[2-9]\d{11}$/;
const PAN_REGEX = /^[A-Z]{5}\d{4}[A-Z]$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const BANK_ACC_REGEX = /^\d{9,18}$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;

export function validateForRegistration(member: EpfoMemberInput): EpfoValidationResult {
  const errors: EpfoValidationError[] = [];
  const info = member.payrollInfo;

  if (info?.uan && !UAN_REGEX.test(info.uan.trim())) {
    errors.push({ field: 'uan', message: 'UAN must be a 12-digit number' });
  }

  const doj = computeEpfJoiningDate(member);
  if (!doj) {
    errors.push({ field: 'doj', message: 'Joining date is required' });
  }

  const dobIso = parseIsoDateKey(info?.dob);
  if (!dobIso) {
    errors.push({ field: 'dob', message: 'Date of birth is required' });
  } else if (doj) {
    const [dobY, dobM, dobD] = dobIso.split('-').map(Number);
    const [dojY, dojM, dojD] = doj.split('-').map(Number);
    let age = dojY - dobY;
    if (dojM < dobM || (dojM === dobM && dojD < dobD)) {
      age--;
    }
    if (age < 14) {
      errors.push({ field: 'dob', message: 'Member must be at least 14 years old at joining' });
    }
  }

  if (!mapGender(info?.gender)) {
    errors.push({ field: 'gender', message: 'Gender must be Male, Female, or Other' });
  }

  if (!sanitizeEpfoName(info?.fatherHusbandName)) {
    errors.push({ field: 'fatherHusbandName', message: 'Father or Husband name is required' });
  }

  if (!mapRelationship(info?.relationship)) {
    errors.push({ field: 'relationship', message: 'EPFO accepts only Father (F) or Husband (H)' });
  }

  const mobile = (info?.mobileNumber || '').trim();
  if (!MOBILE_REGEX.test(mobile)) {
    errors.push({ field: 'mobileNumber', message: 'Mobile number must be a valid 10-digit Indian number' });
  }

  if (!mapMaritalStatus(info?.maritalStatus)) {
    errors.push({ field: 'maritalStatus', message: 'Marital status is required' });
  }

  const ctc = typeof info?.monthlyCtc === 'number' ? info.monthlyCtc : 0;
  if (ctc <= 0) {
    errors.push({ field: 'monthlyCtc', message: 'Monthly CTC must be greater than 0' });
  }

  const aadhaar = (info?.aadhaar || '').trim();
  if (!AADHAAR_REGEX.test(aadhaar)) {
    errors.push({ field: 'aadhaar', message: 'Aadhaar must be a 12-digit number not starting with 0 or 1' });
  }

  if (info?.isInternationalWorker === 'Y') {
    if (!info.passportNumber?.trim()) {
      errors.push({ field: 'passportNumber', message: 'Passport number is required for international workers' });
    }
    if (!parseIsoDateKey(info.passportValidFrom)) {
      errors.push({ field: 'passportValidFrom', message: 'Passport valid from date is required' });
    }
    if (!parseIsoDateKey(info.passportValidTill)) {
      errors.push({ field: 'passportValidTill', message: 'Passport valid till date is required' });
    }
  }

  const ifsc = (info?.ifsc || '').trim().toUpperCase();
  if (ifsc && !IFSC_REGEX.test(ifsc)) {
    errors.push({ field: 'ifsc', message: 'IFSC code must be 11 characters with 0 at 5th character' });
  }

  const bankAcc = (info?.bankAccount || '').trim();
  if (bankAcc && !BANK_ACC_REGEX.test(bankAcc)) {
    errors.push({ field: 'bankAccount', message: 'Bank account must be 9 to 18 digits' });
  }

  const pan = (info?.pan || '').trim().toUpperCase();
  if (pan && !PAN_REGEX.test(pan)) {
    errors.push({ field: 'pan', message: 'PAN must be 10 characters (e.g. ABCDE1234F)' });
  }

  return {
    ready: errors.length === 0,
    errors,
  };
}

export function validateForExit(member: EpfoMemberInput): EpfoValidationResult {
  const errors: EpfoValidationError[] = [];
  const info = member.payrollInfo;
  const latestPeriod = getLatestEmploymentPeriod(member);

  const uan = (info?.uan || '').trim();
  if (!UAN_REGEX.test(uan)) {
    errors.push({ field: 'uan', message: '12-digit UAN is required for exit mark' });
  }

  const endDate = parseIsoDateKey(latestPeriod?.endDate);
  if (!endDate) {
    errors.push({ field: 'endDate', message: 'Exit date is required' });
  } else {
    const doj = computeEpfJoiningDate(member);
    if (doj && endDate < doj) {
      errors.push({ field: 'endDate', message: 'Exit date cannot be earlier than EPF joining date' });
    }
  }

  if (!latestPeriod?.exitReason?.trim()) {
    errors.push({ field: 'exitReason', message: 'Exit reason is required' });
  }

  return {
    ready: errors.length === 0,
    errors,
  };
}

export function validateForKyc(
  member: EpfoMemberInput,
  docTypes: EpfoDocType[] = ['B', 'P', 'A']
): EpfoValidationResult & {
  validDocs: EpfoDocType[];
  skippedDocs: Array<{ docType: EpfoDocType; reason: string }>;
} {
  const errors: EpfoValidationError[] = [];
  const validDocs: EpfoDocType[] = [];
  const skippedDocs: Array<{ docType: EpfoDocType; reason: string }> = [];
  const info = member.payrollInfo;

  const uan = (info?.uan || '').trim();
  if (!UAN_REGEX.test(uan)) {
    errors.push({ field: 'uan', message: '12-digit UAN is required for KYC seeding' });
  }

  for (const doc of docTypes) {
    if (doc === 'B') {
      const bankAcc = (info?.bankAccount || '').trim();
      const ifsc = (info?.ifsc || '').trim().toUpperCase();
      const name = sanitizeEpfoName(info?.nameAsPerBank || member.name);
      if (BANK_ACC_REGEX.test(bankAcc) && IFSC_REGEX.test(ifsc) && name) {
        validDocs.push('B');
      } else {
        const reason = !bankAcc
          ? 'Missing bank account number'
          : !BANK_ACC_REGEX.test(bankAcc)
          ? 'Invalid bank account number (9-18 digits required)'
          : !ifsc
          ? 'Missing IFSC code'
          : !IFSC_REGEX.test(ifsc)
          ? 'Invalid IFSC code (must have 0 at 5th character)'
          : 'Missing name on bank account';
        skippedDocs.push({ docType: 'B', reason });
      }
    } else if (doc === 'P') {
      const pan = (info?.pan || '').trim().toUpperCase();
      const name = sanitizeEpfoName(info?.nameOnPan || member.name);
      if (PAN_REGEX.test(pan) && name) {
        validDocs.push('P');
      } else {
        const reason = !pan
          ? 'Missing PAN'
          : !PAN_REGEX.test(pan)
          ? 'Invalid PAN format (e.g. ABCDE1234F)'
          : 'Missing name on PAN';
        skippedDocs.push({ docType: 'P', reason });
      }
    } else if (doc === 'A') {
      const aadhaar = (info?.aadhaar || '').trim();
      const name = sanitizeEpfoName(info?.nameOnAadhaar || member.name);
      if (AADHAAR_REGEX.test(aadhaar) && name) {
        validDocs.push('A');
      } else {
        const reason = !aadhaar
          ? 'Missing Aadhaar number'
          : !AADHAAR_REGEX.test(aadhaar)
          ? 'Invalid Aadhaar (must be 12 digits not starting with 0 or 1)'
          : 'Missing name on Aadhaar';
        skippedDocs.push({ docType: 'A', reason });
      }
    }
  }

  if (validDocs.length === 0) {
    errors.push({
      field: 'kyc',
      message: 'At least one valid document (Bank, PAN, or Aadhaar) is required',
    });
  }

  return {
    ready: errors.length === 0 && validDocs.length > 0,
    errors,
    validDocs,
    skippedDocs,
  };
}

export function validateForNextAction(
  member: EpfoMemberInput,
  action?: EpfoNextAction
): EpfoValidationResult {
  const targetAction = action || getEpfoNextAction(member);

  switch (targetAction) {
    case 'NEEDS_REGISTRATION':
      return validateForRegistration(member);
    case 'NEEDS_EXIT':
      return validateForExit(member);
    case 'NEEDS_KYC': {
      const kyc = validateForKyc(member);
      return { ready: kyc.ready, errors: kyc.errors };
    }
    case 'AWAITING_UAN': {
      const uan = (member.payrollInfo?.uan || '').trim();
      if (!UAN_REGEX.test(uan)) {
        return {
          ready: false,
          errors: [{ field: 'uan', message: 'UAN is awaiting entry from EPFO portal' }],
        };
      }
      return { ready: true, errors: [] };
    }
    case 'UP_TO_DATE':
      return { ready: true, errors: [] };
    case 'HIDDEN':
    default:
      return { ready: false, errors: [] };
  }
}
