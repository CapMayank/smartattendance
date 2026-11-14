import crypto from 'crypto';
import type { EpfoPayrollInfoRecord } from './types';

/**
 * The KYC hash only detects changes. It must keep the name cleaning that was in
 * place when existing hashes were stored, otherwise every already-filed member
 * whose name has punctuation would flip back to "KYC pending".
 */
function hashName(val: string | null | undefined): string {
  if (!val) return '';
  const cleaned = val
    .replace(/#~#/g, '')
    .replace(/[#~]/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutTitles = cleaned.replace(/^(?:(?:MR|MRS|MS|MISS|DR|SHRI|SMT|KUMARI)\.?\s+)+/i, '');
  return withoutTitles.replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 100);
}

export function computeKycHash(info: EpfoPayrollInfoRecord | null | undefined): string {
  if (!info) return '';

  const bankAccount = (info.bankAccount || '').trim();
  const ifsc = (info.ifsc || '').trim().toUpperCase();
  const nameAsPerBank = hashName(info.nameAsPerBank);
  const pan = (info.pan || '').trim().toUpperCase();
  const nameOnPan = hashName(info.nameOnPan);
  const aadhaar = (info.aadhaar || '').trim();
  const nameOnAadhaar = hashName(info.nameOnAadhaar);

  if (!bankAccount && !pan && !aadhaar) {
    return '';
  }

  const payload = [
    bankAccount,
    ifsc,
    nameAsPerBank,
    pan,
    nameOnPan,
    aadhaar,
    nameOnAadhaar,
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}
