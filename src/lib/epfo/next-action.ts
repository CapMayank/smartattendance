import { computeKycHash } from './kyc-hash';
import type { EpfoMemberInput, EpfoNextAction, EpfoPeriodRecord } from './types';

export function getLatestEmploymentPeriod(member: EpfoMemberInput): EpfoPeriodRecord | null {
  if (!member.employmentPeriods || member.employmentPeriods.length === 0) return null;
  return member.employmentPeriods.slice().sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

export function getEpfoNextAction(member: EpfoMemberInput): EpfoNextAction {
  const latestPeriod = getLatestEmploymentPeriod(member);
  const payGroup = member.payrollInfo?.payGroup || 'BANK_EPF';
  const hasEpfHistory =
    payGroup === 'BANK_EPF' ||
    (member.payrollInfo?.payGroupChanges || []).some((c) => c.payGroup === 'BANK_EPF');

  if (!hasEpfHistory) {
    return 'HIDDEN';
  }

  // Exited and never registered on EPFO
  if (latestPeriod?.endDate && !latestPeriod.epfoJoinExportedAt) {
    return 'HIDDEN';
  }

  // 1. NEEDS_EXIT: Latest period has endDate, join was exported, exit not yet exported
  if (latestPeriod?.endDate && latestPeriod.epfoJoinExportedAt && !latestPeriod.epfoExitExportedAt) {
    return 'NEEDS_EXIT';
  }

  // 2. Active period, join not yet exported
  if (!latestPeriod?.endDate && !latestPeriod?.epfoJoinExportedAt) {
    if (payGroup !== 'BANK_EPF') {
      return 'HIDDEN';
    }
    return 'NEEDS_REGISTRATION';
  }

  // If latest period is closed and exit exported, closed member
  if (latestPeriod?.endDate && latestPeriod.epfoExitExportedAt) {
    return 'UP_TO_DATE';
  }

  // 3. AWAITING_UAN: Join exported, UAN empty
  const uan = (member.payrollInfo?.uan || '').trim();
  if (!uan) {
    return 'AWAITING_UAN';
  }

  // 4. NEEDS_KYC: UAN present and (epfoKycExportedAt is null OR hash mismatch)
  const kycHash = computeKycHash(member.payrollInfo);
  if (
    !member.payrollInfo?.epfoKycExportedAt ||
    !kycHash ||
    member.payrollInfo?.epfoKycExportedHash !== kycHash
  ) {
    return 'NEEDS_KYC';
  }

  return 'UP_TO_DATE';
}
