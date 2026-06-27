import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const staff = await prisma.staff.findMany({ 
    include: { department: true, designation: true, shift: true },
    orderBy: { createdAt: 'desc' } 
  })
  return NextResponse.json(staff)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await request.json()
    const staff = await prisma.staff.create({ data })
    return NextResponse.json(staff, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const ids = searchParams.get('ids')

    if (ids) {
      const idArray = ids.split(',').filter(Boolean)
      await prisma.staff.deleteMany({ where: { id: { in: idArray } } })
      return NextResponse.json({ success: true, count: idArray.length })
    } else if (id) {
      await prisma.staff.delete({ where: { id } })
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'ID or IDs required' }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await request.json()
    const { id, ...updateData } = data
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    
    // Ensure nulls are handled for optional relations
    const staff = await prisma.staff.update({ 
      where: { id },
      data: {
        name: updateData.name,
        machineId: updateData.machineId,
        departmentId: updateData.departmentId || null,
        designationId: updateData.designationId || null,
        shiftId: updateData.shiftId || null,
      }
    })
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}
