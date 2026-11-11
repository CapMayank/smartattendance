import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { isTimeHHMM } from '@/lib/validators'
import { shiftUsageCount, shiftInUseMessage } from '@/lib/shift-delete-guard'

export async function GET() {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN', 'APPROVER'])
  if (auth.errorResponse) return auth.errorResponse

  let shifts = await prisma.shift.findMany({ orderBy: { createdAt: 'desc' } })
  
  if (shifts.length === 0) {
    const defaultShift = await prisma.shift.create({
      data: {
        name: 'General Shift',
        startTime: '09:55',
        endTime: '17:00'
      }
    })
    shifts = [defaultShift]
  }

  return NextResponse.json(shifts)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await request.json().catch(() => null)
    const field = (key: string): string | null => {
      const v = body && typeof body === 'object' ? (body as Record<string, unknown>)[key] : undefined
      return typeof v === 'string' && v.trim() !== '' ? v.trim() : null
    }
    const name = field('name')
    const startTime = field('startTime')
    const endTime = field('endTime')
    if (!name || !startTime || !endTime) {
      return NextResponse.json({ error: 'name, startTime and endTime are required' }, { status: 400 })
    }
    if (!isTimeHHMM(startTime) || !isTimeHHMM(endTime)) {
      return NextResponse.json({ error: 'startTime and endTime must be HH:MM (24-hour)' }, { status: 400 })
    }
    // Only these three fields: every other property in the body is ignored
    const shift = await prisma.shift.create({ data: { name, startTime, endTime } })
    return NextResponse.json(shift, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const inUse = await shiftUsageCount(id)
    if (inUse > 0) return NextResponse.json({ error: shiftInUseMessage(inUse) }, { status: 409 })
    await prisma.shift.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const { id, name, startTime, endTime } = data
    if (!id || !name || !startTime || !endTime) return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Shift name is required' }, { status: 400 })
    }
    if (!isTimeHHMM(startTime) || !isTimeHHMM(endTime)) {
      return NextResponse.json({ error: 'startTime and endTime must be HH:MM (24-hour)' }, { status: 400 })
    }
    if (!(await prisma.shift.findUnique({ where: { id } }))) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 })
    }
    const shift = await prisma.shift.update({
      where: { id },
      data: { name: name.trim(), startTime, endTime }
    })
    return NextResponse.json(shift)
  } catch {
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }
}
