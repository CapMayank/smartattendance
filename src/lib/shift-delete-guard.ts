import { prisma } from '@/lib/prisma'

/** Number of teachers, shift changes and suggestions that still point at a shift. */
export async function shiftUsageCount(shiftId: string): Promise<number> {
  const [teachers, changes, suggestions] = await Promise.all([
    prisma.staff.count({ where: { shiftId } }),
    prisma.shiftAssignment.count({ where: { shiftId } }),
    prisma.shiftSuggestion.count({ where: { suggestedShiftId: shiftId, status: { in: ['PENDING', 'APPROVING'] } } }),
  ])
  return teachers + changes + suggestions
}

export function shiftInUseMessage(n: number): string {
  return `This shift is in use by ${n} ${n === 1 ? 'teacher or shift change' : 'teachers or shift changes'}. Move them to another shift first.`
}
