import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { istDateKey } from '@/lib/dashboard-calc'
import { ALWAYS } from '@/lib/shift-lookup'
import {
  applyShiftChange,
  isValidDayKey,
  previewShiftChange,
  START_BEFORE_ALWAYS_ERROR,
} from '@/lib/shift-change-service'
import type { ChangeRequest } from '@/lib/shift-change'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    if (!id || !id.trim()) return NextResponse.json({ error: 'Staff id required' }, { status: 400 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    const { shiftId, effectiveFrom, dryRun } = body as { shiftId?: unknown; effectiveFrom?: unknown; dryRun?: unknown }

    if (shiftId !== null && typeof shiftId !== 'string') {
      return NextResponse.json({ error: 'shiftId must be a shift id or null' }, { status: 400 })
    }
    if (effectiveFrom !== undefined && !isValidDayKey(effectiveFrom)) {
      return NextResponse.json({ error: 'effectiveFrom must be a valid YYYY-MM-DD date' }, { status: 400 })
    }
    if (effectiveFrom !== undefined && effectiveFrom < ALWAYS) {
      return NextResponse.json({ error: START_BEFORE_ALWAYS_ERROR }, { status: 400 })
    }
    if (dryRun !== undefined && typeof dryRun !== 'boolean') {
      return NextResponse.json({ error: 'dryRun must be a boolean' }, { status: 400 })
    }
    if (shiftId !== null) {
      const shift = await prisma.shift.findUnique({ where: { id: shiftId } })
      if (!shift) return NextResponse.json({ error: 'Unknown shift' }, { status: 400 })
    }
    const staff = await prisma.staff.findUnique({ where: { id }, select: { id: true } })
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    const req: ChangeRequest = {
      staffId: id,
      shiftId,
      effectiveFrom: effectiveFrom ?? istDateKey(new Date()),
      source: 'MANUAL',
      createdByUserId: session.user?.id,
    }
    if (dryRun === true) return NextResponse.json(await previewShiftChange(req))
    return NextResponse.json(await applyShiftChange(req))
  } catch (error) {
    console.error('Shift change error:', error)
    return NextResponse.json({ error: 'Failed to change shift' }, { status: 500 })
  }
}
