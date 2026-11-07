import { prisma } from '@/lib/prisma'

/** Same window as the approve lock in shift-suggestions.ts. */
const APPROVING_FRESH_MS = 5 * 60000

/** Number of teachers, shift changes and suggestions that still point at a shift. */
export async function shiftUsageCount(shiftId: string): Promise<number> {
  const [teachers, changes, suggestions] = await Promise.all([
    prisma.staff.count({ where: { shiftId } }),
    prisma.shiftAssignment.count({ where: { shiftId } }),
    // A stuck APPROVING row (older than the approve lock) must not block deletion
    prisma.shiftSuggestion.count({
      where: {
        suggestedShiftId: shiftId,
        OR: [{ status: 'PENDING' }, { status: 'APPROVING', updatedAt: { gte: new Date(Date.now() - APPROVING_FRESH_MS) } }],
      },
    }),
  ])
  return teachers + changes + suggestions
}

export function shiftInUseMessage(n: number): string {
  return `This shift is in use by ${n} ${n === 1 ? 'teacher or shift change' : 'teachers or shift changes'}. Move them to another shift first.`
}
