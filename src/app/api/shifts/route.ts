import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await request.json()
    const shift = await prisma.shift.create({ data })
    return NextResponse.json(shift, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create shift' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    await prisma.shift.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await request.json()
    const { id, name, startTime, endTime } = data
    if (!id || !name || !startTime || !endTime) return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    const shift = await prisma.shift.update({
      where: { id },
      data: { name, startTime, endTime }
    })
    return NextResponse.json(shift)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update shift' }, { status: 500 })
  }
}
