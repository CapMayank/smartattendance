// Retention cleanup for punch photos. Throttled through Policy.photoCleanupRanAt, claimed
// atomically (same pattern as shift detection in shift-suggestions.ts).

import { prisma } from '@/lib/prisma'
import { PHOTO_CONFIG } from '@/lib/photo-config'

const HOUR_MS = 3600000
const DAY_MS = 86400000
/** An unreferenced profile copy is a leftover of a lost pin race once it is this old. */
const ORPHAN_PROFILE_DAYS = 1

/**
 * Deletes punch photos older than the retention window (never a profile copy that a teacher
 * still uses) plus orphan profile copies. Returns `ran: false` when another run is recent.
 */
export async function runPhotoCleanup(now: Date = new Date()): Promise<{ ran: boolean; deleted: number }> {
  const policy = await prisma.policy.findFirst()
  if (!policy) {
    await prisma.policy.create({ data: { photoCleanupRanAt: now } })
  } else {
    const cutoff = new Date(now.getTime() - PHOTO_CONFIG.cleanupThrottleHours * HOUR_MS)
    const claimed = await prisma.policy.updateMany({
      where: { id: policy.id, OR: [{ photoCleanupRanAt: null }, { photoCleanupRanAt: { lt: cutoff } }] },
      data: { photoCleanupRanAt: now },
    })
    if (claimed.count === 0) return { ran: false, deleted: 0 }
  }

  const old = new Date(now.getTime() - PHOTO_CONFIG.retentionDays * DAY_MS)
  const orphanBefore = new Date(now.getTime() - ORPHAN_PROFILE_DAYS * DAY_MS)
  const res = await prisma.punchPhoto.deleteMany({
    where: {
      OR: [
        { isProfile: false, takenAt: { lt: old } },
        { isProfile: true, createdAt: { lt: orphanBefore }, profileOf: { none: {} } },
      ],
    },
  })
  return { ran: true, deleted: res.count }
}
