import crypto from 'crypto';

/**
 * Generates an unambiguous, random temporary password.
 * Defaults to 10 alphanumeric characters (excluding confusing characters like 0, O, 1, l, I).
 */
export function generateTemporaryPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars[bytes[i] % chars.length];
  }
  return pass;
}
