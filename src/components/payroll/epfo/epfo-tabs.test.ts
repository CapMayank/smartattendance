import { describe, expect, it } from 'vitest';
import { EPFO_TAB_IDS, parseTab, tabCounts } from './epfo-tabs';

describe('parseTab', () => {
  it('accepts every known tab id', () => {
    for (const id of EPFO_TAB_IDS) expect(parseTab(id)).toBe(id);
  });
  it('falls back to overview for null, empty and unknown values', () => {
    expect(parseTab(null)).toBe('overview');
    expect(parseTab('')).toBe('overview');
    expect(parseTab('bogus')).toBe('overview');
  });
});

describe('tabCounts', () => {
  it('sums registration + awaiting UAN and excludes hidden from all', () => {
    const c = { NEEDS_REGISTRATION: 3, AWAITING_UAN: 1, NEEDS_EXIT: 1, NEEDS_KYC: 2, UP_TO_DATE: 38, HIDDEN: 9 };
    expect(tabCounts(c, 12)).toEqual({ registration: 4, kyc: 2, exit: 1, ecr: 12, all: 45 });
  });
});
