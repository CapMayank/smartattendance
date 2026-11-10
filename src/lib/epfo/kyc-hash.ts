import crypto from 'crypto';
import { sanitizeEpfoName } from './mappings';
import type { EpfoPayrollInfoRecord } from './types';

export function computeKycHash(info: EpfoPayrollInfoRecord | null | undefined): string {
  if (!info) return '';

  const bankAccount = (info.bankAccount || '').trim();
  const ifsc = (info.ifsc || '').trim().toUpperCase();
  const nameAsPerBank = sanitizeEpfoName(info.nameAsPerBank);
  const pan = (info.pan || '').trim().toUpperCase();
  const nameOnPan = sanitizeEpfoName(info.nameOnPan);
  const aadhaar = (info.aadhaar || '').trim();
  const nameOnAadhaar = sanitizeEpfoName(info.nameOnAadhaar);

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
