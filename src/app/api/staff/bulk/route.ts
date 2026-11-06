import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { istDateKey } from '@/lib/dashboard-calc'
import { applyShiftChange } from '@/lib/shift-change-service'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data } = await request.json()
    if (!Array.isArray(data)) return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })

    let processedCount = 0
    const todayKey = istDateKey(new Date())

    // Fetch existing default shift to fall back on if needed
    let defaultShift = await prisma.shift.findFirst({ where: { name: 'General Shift' } })
    if (!defaultShift) {
      defaultShift = await prisma.shift.create({
        data: { name: 'General Shift', startTime: '09:55', endTime: '17:00' }
      })
    }

    for (const row of data) {
      const name = row['Name']?.trim()
      const machineId = row['Machine ID']?.toString().trim()
      const deptName = row['Department']?.trim()
      const desigName = row['Designation']?.trim()
      const shiftName = row['Shift']?.trim()

      if (!name || !machineId) continue // Skip invalid rows

      let departmentId = null
      let designationId = null
      let shiftId = defaultShift.id

      // Smart Upsert Department
      if (deptName) {
        let dept = await prisma.department.findUnique({ where: { name: deptName } })
        if (!dept) dept = await prisma.department.create({ data: { name: deptName } })
        departmentId = dept.id
      }

      // Smart Upsert Designation
      if (desigName) {
        let desig = await prisma.designation.findUnique({ where: { name: desigName } })
        if (!desig) desig = await prisma.designation.create({ data: { name: desigName } })
        designationId = desig.id
      }

      // Find Shift by Name
      if (shiftName) {
        const shift = await prisma.shift.findFirst({ where: { name: shiftName } })
        if (shift) shiftId = shift.id
        // We don't auto-create shifts purely by name because we don't know the times, we just fallback to default.
      }

      // Upsert Staff. An existing teacher's shift changes through the shift change
      // service (dated history + recalculation); only a new teacher gets shiftId directly.
      const existing = await prisma.staff.findUnique({ where: { machineId }, select: { id: true, shiftId: true } })
      await prisma.staff.upsert({
        where: { machineId },
        update: {
          name,
          departmentId,
          designationId
        },
        create: {
          machineId,
          name,
          departmentId,
          designationId,
          shiftId
        }
      })
      if (existing && existing.shiftId !== shiftId) {
        await applyShiftChange({
          staffId: existing.id,
          shiftId,
          effectiveFrom: todayKey,
          source: 'MANUAL',
          createdByUserId: session.user?.id,
        })
      }

      processedCount++
    }

    return NextResponse.json({ success: true, processedCount })
  } catch (error) {
    console.error('Bulk Import Error:', error)
    return NextResponse.json({ error: 'Failed to process bulk import' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { ids, departmentId, designationId, shiftId } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })

    const nextShiftId: string | null = shiftId || null
    if (shiftId !== undefined && nextShiftId !== null && !(await prisma.shift.findUnique({ where: { id: nextShiftId } }))) {
      return NextResponse.json({ error: 'Unknown shift' }, { status: 400 })
    }

    const dataToUpdate: { departmentId?: string | null; designationId?: string | null } = {}
    if (departmentId !== undefined) dataToUpdate.departmentId = departmentId || null
    if (designationId !== undefined) dataToUpdate.designationId = designationId || null

    if (Object.keys(dataToUpdate).length > 0) {
      await prisma.staff.updateMany({
        where: { id: { in: ids } },
        data: dataToUpdate
      })
    }

    // Shifts change through the shift change service (dated history + recalculation)
    if (shiftId !== undefined) {
      const effectiveFrom = istDateKey(new Date())
      const selected = await prisma.staff.findMany({ where: { id: { in: ids } }, select: { id: true, shiftId: true } })
      const notRecalculated: string[] = []
      for (const staff of selected) {
        if (staff.shiftId === nextShiftId) continue
        const result = await applyShiftChange({
          staffId: staff.id,
          shiftId: nextShiftId,
          effectiveFrom,
          source: 'MANUAL',
          createdByUserId: session.user?.id,
        })
        if (!result.recalculated) notRecalculated.push(staff.id)
      }
      return NextResponse.json({ success: true, notRecalculated })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bulk Update Error:', error)
    return NextResponse.json({ error: 'Failed to process bulk update' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })

    await prisma.staff.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Bulk Delete Error:', error)
    return NextResponse.json({ error: 'Failed to process bulk delete' }, { status: 500 })
  }
}
