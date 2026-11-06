import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { istDateKey } from '@/lib/dashboard-calc'
import { applyShiftChange, isValidDayKey, syncCurrentShifts } from '@/lib/shift-change-service'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Staff.shiftId follows a future-dated assignment once its start date arrives
  await syncCurrentShifts()
  const staff = await prisma.staff.findMany({ 
    include: { department: true, designation: true, shift: true }
  })
  
  // Sort numerically by machineId so they appear in logical order everywhere (e.g. dropdowns)
  staff.sort((a, b) => a.machineId.localeCompare(b.machineId, undefined, { numeric: true }))
  
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
    if (updateData.effectiveFrom !== undefined && !isValidDayKey(updateData.effectiveFrom)) {
      return NextResponse.json({ error: 'effectiveFrom must be a valid YYYY-MM-DD date' }, { status: 400 })
    }

    const current = await prisma.staff.findUnique({ where: { id }, select: { shiftId: true } })
    if (!current) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    const nextShiftId: string | null = updateData.shiftId || null
    const shiftChanges = updateData.shiftId !== undefined && nextShiftId !== current.shiftId
    if (shiftChanges && nextShiftId !== null && !(await prisma.shift.findUnique({ where: { id: nextShiftId } }))) {
      return NextResponse.json({ error: 'Unknown shift' }, { status: 400 })
    }

    // Ensure nulls are handled for optional relations. The shift is changed through the
    // shift change service (dated history + recalculation), never written here.
    let staff = await prisma.staff.update({ 
      where: { id },
      data: {
        name: updateData.name,
        machineId: updateData.machineId,
        departmentId: updateData.departmentId || null,
        designationId: updateData.designationId || null,
      }
    })

    if (shiftChanges) {
      const shiftChange = await applyShiftChange({
        staffId: id,
        shiftId: nextShiftId,
        effectiveFrom: updateData.effectiveFrom ?? istDateKey(new Date()),
        source: 'MANUAL',
        createdByUserId: session.user?.id,
      })
      staff = (await prisma.staff.findUnique({ where: { id } })) ?? staff
      return NextResponse.json({ ...staff, shiftChange })
    }
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}
