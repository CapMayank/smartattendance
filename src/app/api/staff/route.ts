import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { istDateKey } from '@/lib/dashboard-calc'
import { ALWAYS } from '@/lib/shift-lookup'
import { applyShiftChange, isValidDayKey, START_BEFORE_ALWAYS_ERROR, syncCurrentShifts } from '@/lib/shift-change-service'
import { formatEmployeeCode, parseEmployeeCode } from '@/lib/employee-code'
import { generateTemporaryPassword } from '@/lib/temporary-password'
import bcrypt from 'bcryptjs'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDateKey(val: unknown): val is string {
  if (typeof val !== 'string' || !DATE_REGEX.test(val)) return false
  const d = new Date(`${val}T00:00:00Z`)
  return !isNaN(d.getTime())
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN', 'APPROVER'])
  if (auth.errorResponse) return auth.errorResponse

  // Staff.shiftId follows a future-dated assignment once its start date arrives
  try {
    await syncCurrentShifts()
  } catch (error) {
    // A sync failure must never break the staff list
    console.error('[staff] sync failed:', error)
  }
  const staff = await prisma.staff.findMany({ 
    include: { department: true, designation: true, shift: true }
  })
  
  // Sort numerically by machineId so they appear in logical order everywhere (e.g. dropdowns)
  staff.sort((a, b) => a.machineId.localeCompare(b.machineId, undefined, { numeric: true }))
  
  // profilePhotoId is a scalar column, so no image bytes are loaded for the list
  return NextResponse.json(staff.map((s) => ({ ...s, hasPhoto: s.profilePhotoId != null })))
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const { name, machineId, joiningDate, departmentId, designationId, shiftId, payGroup } = data

    if (!name || !machineId || !joiningDate) {
      return NextResponse.json({ error: 'Name, machineId, and joiningDate are required' }, { status: 400 })
    }

    if (!isValidDateKey(joiningDate)) {
      return NextResponse.json({ error: 'joiningDate must be a valid YYYY-MM-DD date' }, { status: 400 })
    }

    const existingStaff = await prisma.staff.findUnique({ where: { machineId: String(machineId).trim() } })
    if (existingStaff) {
      return NextResponse.json({ error: 'Machine ID already exists' }, { status: 409 })
    }

    if (shiftId) {
      const shiftExists = await prisma.shift.findUnique({ where: { id: shiftId } })
      if (!shiftExists) {
        return NextResponse.json({ error: 'Shift not found' }, { status: 400 })
      }
    }

    const year = parseInt(joiningDate.slice(0, 4), 10)

    const temporaryPassword = generateTemporaryPassword(10)
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

    const createdStaff = await prisma.$transaction(async (tx: any) => {
      // Find highest sequence number for that year among existing staff codes matching SAR-<year>-(\d+)
      const staffInYear = await tx.staff.findMany({
        where: { employeeCode: { startsWith: `SAR-${year}-` } },
        select: { employeeCode: true },
      })

      let maxSeq = 0
      for (const s of staffInYear) {
        if (!s.employeeCode) continue
        const parsed = parseEmployeeCode(s.employeeCode)
        if (parsed && parsed.year === year && parsed.sequence > maxSeq) {
          maxSeq = parsed.sequence
        }
      }

      const employeeCode = formatEmployeeCode(year, maxSeq + 1)

      const staff = await tx.staff.create({
        data: {
          name: name.trim(),
          machineId: String(machineId).trim(),
          employeeCode,
          joiningDate,
          departmentId: departmentId || null,
          designationId: designationId || null,
          shiftId: shiftId || null,
        },
      })

      await tx.employmentPeriod.create({
        data: {
          staffId: staff.id,
          startDate: joiningDate,
          endDate: null,
          createdByUserId: auth.user.id,
        },
      })

      await tx.staffPayrollInfo.create({
        data: {
          staffId: staff.id,
          payGroup: payGroup || 'BANK_EPF',
        },
      })

      if (shiftId) {
        await tx.shiftAssignment.create({
          data: {
            staffId: staff.id,
            shiftId,
            effectiveFrom: joiningDate,
            source: 'INITIAL',
            createdByUserId: auth.user.id,
          },
        })
      }

      await tx.user.create({
        data: {
          name: staff.name,
          role: 'EMPLOYEE',
          password: hashedPassword,
          mustChangePassword: true,
          staffId: staff.id,
        },
      })

      await tx.auditLog.create({
        data: {
          actorUserId: auth.user.id,
          action: 'STAFF_JOIN',
          targetType: 'Staff',
          targetId: staff.id,
          details: JSON.stringify({
            name: staff.name,
            machineId: staff.machineId,
            employeeCode,
            joiningDate,
            departmentId,
            designationId,
            shiftId,
            payGroup: payGroup || 'BANK_EPF',
          }),
        },
      })

      return staff
    })

    return NextResponse.json({ ...createdStaff, temporaryPassword }, { status: 201 })
  } catch (error) {
    console.error('Failed to create staff:', error)
    return NextResponse.json({ error: 'Failed to create staff' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const ids = searchParams.get('ids')

    const idList = ids ? ids.split(',').filter(Boolean) : id ? [id] : []
    if (idList.length === 0) {
      return NextResponse.json({ error: 'ID or IDs required' }, { status: 400 })
    }

    // Deletion guard: Check attendanceLogs, dailyRecords, monthlyPayrolls, and shiftAssignments > 1
    const [logCount, recordCount, payrollCount] = await Promise.all([
      prisma.attendanceLog.count({ where: { staffId: { in: idList } } }),
      prisma.dailyRecord.count({ where: { staffId: { in: idList } } }),
      prisma.monthlyPayroll.count({ where: { staffId: { in: idList } } }),
    ])

    if (logCount > 0 || recordCount > 0 || payrollCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete staff member with attendance or payroll history. Use Exit instead.' },
        { status: 409 }
      )
    }

    for (const staffId of idList) {
      const assignmentCount = await prisma.shiftAssignment.count({ where: { staffId } })
      if (assignmentCount > 1) {
        return NextResponse.json(
          { error: 'Cannot delete staff member with attendance or payroll history. Use Exit instead.' },
          { status: 409 }
        )
      }
    }

    await prisma.$transaction(async (tx: any) => {
      if (id && !ids) {
        await tx.shiftAssignment.deleteMany({ where: { staffId: id } })
        await tx.payGroupChange.deleteMany({ where: { staffPayrollInfo: { staffId: id } } })
        await tx.staffPayrollInfo.deleteMany({ where: { staffId: id } })
        await tx.user.deleteMany({ where: { staffId: id } })
        await tx.employmentPeriod.deleteMany({ where: { staffId: id } })
        await tx.staff.delete({ where: { id } })
      } else {
        await tx.shiftAssignment.deleteMany({ where: { staffId: { in: idList } } })
        await tx.payGroupChange.deleteMany({ where: { staffPayrollInfo: { staffId: { in: idList } } } })
        await tx.staffPayrollInfo.deleteMany({ where: { staffId: { in: idList } } })
        await tx.user.deleteMany({ where: { staffId: { in: idList } } })
        await tx.employmentPeriod.deleteMany({ where: { staffId: { in: idList } } })
        await tx.staff.deleteMany({ where: { id: { in: idList } } })
      }
    })

    return NextResponse.json({ success: true, count: idList.length })
  } catch (error) {
    console.error('Failed to delete staff:', error)
    return NextResponse.json({ error: 'Failed to delete staff' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const { id, ...updateData } = data
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    if (updateData.effectiveFrom !== undefined && !isValidDayKey(updateData.effectiveFrom)) {
      return NextResponse.json({ error: 'effectiveFrom must be a valid YYYY-MM-DD date' }, { status: 400 })
    }
    if (updateData.effectiveFrom !== undefined && updateData.effectiveFrom < ALWAYS) {
      return NextResponse.json({ error: START_BEFORE_ALWAYS_ERROR }, { status: 400 })
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
        createdByUserId: session!.user?.id,
      })
      staff = (await prisma.staff.findUnique({ where: { id } })) ?? staff
      return NextResponse.json({ ...staff, shiftChange })
    }
    return NextResponse.json(staff)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}
