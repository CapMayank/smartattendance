import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { data } = await request.json()
    if (!Array.isArray(data)) return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })

    let processedCount = 0

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

      // Upsert Staff
      await prisma.staff.upsert({
        where: { machineId },
        update: {
          name,
          departmentId,
          designationId,
          shiftId
        },
        create: {
          machineId,
          name,
          departmentId,
          designationId,
          shiftId
        }
      })

      processedCount++
    }

    return NextResponse.json({ success: true, processedCount })
  } catch (error) {
    console.error('Bulk Import Error:', error)
    return NextResponse.json({ error: 'Failed to process bulk import' }, { status: 500 })
  }
}
