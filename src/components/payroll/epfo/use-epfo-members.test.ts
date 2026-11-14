import { describe, it, expect } from 'vitest';
import { isValidUan, splitReadiness, type EpfoMemberRow } from './use-epfo-members';

const member = (o: Partial<EpfoMemberRow>): EpfoMemberRow => ({
  id: 'a', machineId: '1', name: 'A', nextAction: 'NEEDS_REGISTRATION',
  readiness: { ready: true, errors: [] }, ...o,
});

describe('isValidUan', () => {
  it('accepts exactly 12 digits', () => {
    expect(isValidUan('100248330106')).toBe(true);
    expect(isValidUan(' 100248330106 ')).toBe(true);
  });
  it('rejects anything else', () => {
    for (const bad of ['12345', '1002483301a6', '', '1002483301067']) expect(isValidUan(bad)).toBe(false);
  });
});

describe('splitReadiness', () => {
  it('separates ready members from skipped ones with their reasons', () => {
    const res = splitReadiness([
      member({ id: 'ok' }),
      member({ id: 'bad', name: 'Priya', readiness: { ready: false, errors: [{ field: 'dob', message: 'Date of birth is required' }] } }),
    ]);
    expect(res.ready.map((m) => m.id)).toEqual(['ok']);
    expect(res.skipped).toEqual([{ id: 'bad', name: 'Priya', reasons: ['Date of birth is required'] }]);
  });
});
