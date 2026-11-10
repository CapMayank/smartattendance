import { calculateStaffPayroll } from '../payroll-calc';
import {
  computeEpfJoiningDate,
  defaultExitReasonCode,
  formatEpfoDate,
  mapGender,
  mapMaritalStatus,
  mapRelationship,
  sanitizeEpfoName,
  sanitizeEpfoText,
} from './mappings';
import { getLatestEmploymentPeriod } from './next-action';
import type {
  EpfoDocType,
  EpfoExitReasonCode,
  EpfoMemberInput,
} from './types';
import { validateForKyc } from './validation';

export const EPFO_DELIMITER = '#~#';

export function buildRegistrationLine(member: EpfoMemberInput): string {
  const info = member.payrollInfo || {};
  const latestPeriod = getLatestEmploymentPeriod(member);
  const epfJoinDate = computeEpfJoiningDate(member);

  const uan = (info.uan || '').trim();
  const name = sanitizeEpfoName(
    uan
      ? info.nameOnUan || info.nameOnAadhaar || member.name
      : info.nameOnAadhaar || info.nameOnUan || member.name
  );

  const wages = Math.round(
    calculateStaffPayroll({
      payGroup: 'BANK_EPF',
      monthlyCtc: info.monthlyCtc || 0,
      presentDays: 30,
      totalDays: 30,
    })?.epfWages ?? 0
  );

  const cols = [
    uan,                                                                     // 1. UAN
    sanitizeEpfoText(info.previousMemberId || ''),                           // 2. Previous Member ID
    name,                                                                    // 3. Name
    formatEpfoDate(info.dob),                                                // 4. DOB
    formatEpfoDate(epfJoinDate),                                             // 5. DOJ
    mapGender(info.gender),                                                  // 6. Gender
    sanitizeEpfoName(info.fatherHusbandName),                                // 7. Father/Husband Name
    mapRelationship(info.relationship) || '',                                // 8. Relationship
    (info.mobileNumber || '').trim(),                                        // 9. Mobile
    sanitizeEpfoText(info.email || ''),                                      // 10. Email
    (info.nationality || 'INDIAN').trim().toUpperCase(),                     // 11. Nationality
    String(wages),                                                           // 12. Monthly Wages
    sanitizeEpfoText(info.qualification || ''),                              // 13. Qualification
    mapMaritalStatus(info.maritalStatus),                                    // 14. Marital Status
    info.isInternationalWorker === 'Y' ? 'Y' : 'N',                          // 15. International Worker
    info.isInternationalWorker === 'Y'
      ? sanitizeEpfoText(info.countryOfOrigin || '')
      : 'INDIA',                                                             // 16. Country of Origin
    sanitizeEpfoText(info.passportNumber || ''),                             // 17. Passport Number
    formatEpfoDate(info.passportValidFrom),                                  // 18. Passport Valid From
    formatEpfoDate(info.passportValidTill),                                  // 19. Passport Valid Till
    info.isPhysicalHandicap === 'Y' ? 'Y' : 'N',                             // 20. Physical Handicap
    info.locomotive === 'Y' ? 'Y' : 'N',                                     // 21. Locomotive
    info.hearing === 'Y' ? 'Y' : 'N',                                        // 22. Hearing
    info.visual === 'Y' ? 'Y' : 'N',                                         // 23. Visual
    (info.bankAccount || '').trim(),                                         // 24. Bank Account
    (info.ifsc || '').trim().toUpperCase(),                                  // 25. IFSC
    sanitizeEpfoName(info.nameAsPerBank || member.name),                     // 26. Name As Per Bank
    (info.pan || '').trim().toUpperCase(),                                   // 27. PAN
    sanitizeEpfoName(info.nameOnPan || member.name),                         // 28. Name On PAN
    (info.aadhaar || '').trim(),                                             // 29. Aadhaar
    sanitizeEpfoName(info.nameOnAadhaar || member.name),                     // 30. Name On Aadhaar
  ];

  return cols.join(EPFO_DELIMITER);
}

export function buildRegistrationFile(members: EpfoMemberInput[]): string {
  return members.map(buildRegistrationLine).join('\n');
}

export function buildExitLine(
  member: EpfoMemberInput,
  overrideReasonCode?: EpfoExitReasonCode
): string {
  const uan = (member.payrollInfo?.uan || '').trim();
  const latestPeriod = getLatestEmploymentPeriod(member);
  const exitDate = formatEpfoDate(latestPeriod?.endDate);
  const reasonCode =
    overrideReasonCode ||
    (latestPeriod?.epfoExitCode as EpfoExitReasonCode) ||
    defaultExitReasonCode(latestPeriod?.exitReason, member.payrollInfo?.dob, latestPeriod?.endDate);

  return [uan, exitDate, reasonCode].join(EPFO_DELIMITER);
}

export function buildExitFile(
  items: Array<{ member: EpfoMemberInput; reasonCode?: EpfoExitReasonCode }>
): string {
  return items.map(({ member, reasonCode }) => buildExitLine(member, reasonCode)).join('\n');
}

export function buildKycFile(
  members: EpfoMemberInput[],
  docTypes: EpfoDocType[] = ['B', 'P', 'A']
): {
  content: string;
  exportedStaffIds: string[];
  skipped: Array<{ staffId: string; staffName: string; docType: EpfoDocType; reason: string }>;
} {
  const lines: string[] = [];
  const exportedStaffIds: string[] = [];
  const skipped: Array<{ staffId: string; staffName: string; docType: EpfoDocType; reason: string }> = [];

  for (const member of members) {
    const kycRes = validateForKyc(member, docTypes);
    const info = member.payrollInfo || {};
    const uan = (info.uan || '').trim();

    if (kycRes.ready && kycRes.validDocs.length > 0) {
      exportedStaffIds.push(member.id);

      for (const doc of kycRes.validDocs) {
        if (doc === 'B') {
          const bankAccount = (info.bankAccount || '').trim();
          const ifsc = (info.ifsc || '').trim().toUpperCase();
          const nameAsPerBank = sanitizeEpfoName(info.nameAsPerBank || member.name);
          lines.push([uan, 'B', bankAccount, nameAsPerBank, ifsc].join(EPFO_DELIMITER));
        } else if (doc === 'P') {
          const pan = (info.pan || '').trim().toUpperCase();
          const nameOnPan = sanitizeEpfoName(info.nameOnPan || member.name);
          lines.push([uan, 'P', pan, nameOnPan, ''].join(EPFO_DELIMITER));
        } else if (doc === 'A') {
          const aadhaar = (info.aadhaar || '').trim();
          const nameOnAadhaar = sanitizeEpfoName(info.nameOnAadhaar || member.name);
          lines.push([uan, 'A', aadhaar, nameOnAadhaar, ''].join(EPFO_DELIMITER));
        }
      }
    }

    if (!kycRes.ready && kycRes.errors.some((e) => e.field === 'uan')) {
      for (const doc of docTypes) {
        skipped.push({
          staffId: member.id,
          staffName: member.name,
          docType: doc,
          reason: 'Invalid or missing 12-digit UAN',
        });
      }
    } else {
      for (const s of kycRes.skippedDocs) {
        skipped.push({
          staffId: member.id,
          staffName: member.name,
          docType: s.docType,
          reason: s.reason,
        });
      }
    }
  }

  return {
    content: lines.join('\n'),
    exportedStaffIds,
    skipped,
  };
}
