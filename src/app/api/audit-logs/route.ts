import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')?.trim() || ''
    const targetType = searchParams.get('targetType')?.trim() || ''
    const q = searchParams.get('q')?.trim().toLowerCase() || ''
    const rawLimit = parseInt(searchParams.get('limit') || '200', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 200

    const where: Record<string, unknown> = {}
    if (action) where.action = action
    if (targetType) where.targetType = targetType

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { at: 'desc' },
      take: limit,
    })

    const actorIds = Array.from(
      new Set(logs.map((l) => l.actorUserId).filter((id): id is string => Boolean(id)))
    )

    const actors =
      actorIds.length > 0 && prisma.user?.findMany
        ? await prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, email: true, role: true },
          })
        : []

    const actorById = new Map(actors.map((u) => [u.id, u]))

    const enriched = logs
      .map((log) => {
        let parsedDetails: Record<string, unknown> | null = null
        if (log.details) {
          try {
            parsedDetails = JSON.parse(log.details)
          } catch {
            parsedDetails = { raw: log.details }
          }
        }
        const actor = log.actorUserId ? actorById.get(log.actorUserId) ?? null : null
        return {
          id: log.id,
          at: log.at,
          actorUserId: log.actorUserId,
          actorName: actor?.name || actor?.email || (log.actorUserId ? 'Admin User' : 'System'),
          actorRole: actor?.role || null,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          details: log.details,
          parsedDetails,
        }
      })
      .filter((row) => {
        if (!q) return true
        return (
          row.action.toLowerCase().includes(q) ||
          row.targetType.toLowerCase().includes(q) ||
          (row.targetId ?? '').toLowerCase().includes(q) ||
          row.actorName.toLowerCase().includes(q) ||
          (row.details ?? '').toLowerCase().includes(q)
        )
      })

    return NextResponse.json({ items: enriched })
  } catch (error) {
    console.error('[audit-logs] GET failed:', error)
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 })
  }
}
