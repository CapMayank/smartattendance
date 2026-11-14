import type { EpfoCounts } from '@/lib/epfo/summary';

export const EPFO_TAB_IDS = ['overview', 'registration', 'kyc', 'exit', 'ecr', 'all'] as const;
export type EpfoPageTab = (typeof EPFO_TAB_IDS)[number];

export function parseTab(value: string | null | undefined): EpfoPageTab {
  return (EPFO_TAB_IDS as readonly string[]).includes(value ?? '') ? (value as EpfoPageTab) : 'overview';
}

export function tabCounts(counts: EpfoCounts, ecrMonths: number) {
  return {
    registration: counts.NEEDS_REGISTRATION + counts.AWAITING_UAN,
    kyc: counts.NEEDS_KYC,
    exit: counts.NEEDS_EXIT,
    ecr: ecrMonths,
    all:
      counts.NEEDS_REGISTRATION + counts.AWAITING_UAN + counts.NEEDS_EXIT + counts.NEEDS_KYC + counts.UP_TO_DATE,
  };
}
