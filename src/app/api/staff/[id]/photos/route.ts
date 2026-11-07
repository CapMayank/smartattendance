import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

function parseLimit(raw: string | null): number {
  const n = raw === null || raw.trim() === '' ? NaN : Number(raw)
  if (!Number.isFinite(n)) return DEFAULT_LIMIT
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(n)))
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    if (!id || !id.trim()) return NextResponse.json({ error: 'Staff id required' }, { status: 400 })

    const staff = await prisma.staff.findUnique({ where: { id }, select: { id: true } })
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    const limit = parseLimit(new URL(request.url).searchParams.get('limit'))
    const rows = await prisma.punchPhoto.findMany({
      where: { staffId: id, isProfile: false },
      orderBy: { takenAt: 'desc' },
      take: limit,
      select: { id: true, takenAt: true },
    })
    return NextResponse.json(rows.map((r) => ({ id: r.id, takenAt: r.takenAt })))
  } catch (error) {
    console.error('Photo list error:', error)
    return NextResponse.json({ error: 'Failed to load photos' }, { status: 500 })
  }
}
