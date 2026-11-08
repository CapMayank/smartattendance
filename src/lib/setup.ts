import { prisma } from '@/lib/prisma'

export const DEFAULT_SETUP_SECRET = 'intime-sarvodaya-setup-2026'

/**
 * Returns the configured setup secret key from environment variables or default.
 */
export function getSetupSecret(): string {
  return (
    process.env.SETUP_SECRET ||
    process.env.INITIAL_SETUP_KEY ||
    DEFAULT_SETUP_SECRET
  )
}

/**
 * Verifies if the provided secret matches the configured setup secret key.
 */
export function verifySetupSecret(secret: string): boolean {
  if (!secret || typeof secret !== 'string') return false
  return secret.trim() === getSetupSecret().trim()
}

/**
 * Determines whether the initial setup has been successfully completed.
 * - Checks SystemSetting key 'SETUP_COMPLETED' === 'true'
 */
export async function isSetupCompleted(): Promise<boolean> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'SETUP_COMPLETED' },
    })

    return setting?.value === 'true'
  } catch (err) {
    console.error('[setup] Error checking setup completion:', err)
    return false
  }
}
