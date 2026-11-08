import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN', 'APPROVER'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { id } = await params
    if (!id || !id.trim()) return NextResponse.json({ error: 'Staff id required' }, { status: 400 })

    const staff = await prisma.staff.findUnique({ where: { id }, select: { id: true } })
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    const rows = await prisma.shiftAssignment.findMany({
      where: { staffId: id },
      orderBy: { effectiveFrom: 'desc' },
      include: { shift: { select: { name: true } } },
    })
    return NextResponse.json(
      rows.map((a) => ({
        id: a.id,
        effectiveFrom: a.effectiveFrom,
        shiftId: a.shiftId,
        shiftName: a.shift?.name ?? null,
        source: a.source,
        createdByUserId: a.createdByUserId,
        createdAt: a.createdAt,
      })),
    )
  } catch (error) {
    console.error('Shift history error:', error)
    return NextResponse.json({ error: 'Failed to load shift history' }, { status: 500 })
  }
}
