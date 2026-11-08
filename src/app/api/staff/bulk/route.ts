import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { istDateKey } from '@/lib/dashboard-calc'
import { applyShiftChange } from '@/lib/shift-change-service'
import { resolveCsvShift } from '@/lib/csv-shift'
import { formatEmployeeCode, parseEmployeeCode } from '@/lib/employee-code'
import { generateTemporaryPassword } from '@/lib/temporary-password'
import bcrypt from 'bcryptjs'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDateKey(val: unknown): val is string {
  if (typeof val !== 'string' || !DATE_REGEX.test(val)) return false
  const d = new Date(`${val}T00:00:00Z`)
  return !isNaN(d.getTime())
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { data } = await request.json()
    if (!Array.isArray(data)) return NextResponse.json({ error: 'Invalid data format' }, { status: 400 })

    let processedCount = 0
    let recalculationFailed = 0
    const todayKey = istDateKey(new Date())

    // Fetch existing staff to identify existing vs new machine IDs
    const existingStaff = await prisma.staff.findMany({
      select: { id: true, machineId: true, shiftId: true }
    })
    const existingByMachineId = new Map(existingStaff.map((s) => [s.machineId, s]))

    // Validation pass: ensure all new machine IDs have joiningDate
    const validationErrors: { row: number; machineId: string; error: string }[] = []
    const seenNewMachineIds = new Set<string>()

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const name = row['Name']?.trim()
      const machineId = row['Machine ID']?.toString().trim()
      if (!name || !machineId) continue

      const isExisting = existingByMachineId.has(machineId) || seenNewMachineIds.has(machineId)
      const joiningDate = (
        row['Joining Date'] ||
        row['joiningDate'] ||
        row['DOJ'] ||
        row['D.O.J.'] ||
        row['JoiningDate']
      )?.toString().trim()

      if (!isExisting) {
        if (!joiningDate || !isValidDateKey(joiningDate)) {
          validationErrors.push({
            row: i + 1,
            machineId,
            error: 'Joining Date (YYYY-MM-DD) is required for new staff',
          })
        } else {
          seenNewMachineIds.add(machineId)
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed for one or more rows', errors: validationErrors },
        { status: 400 }
      )
    }

    // Fetch existing default shift to fall back on if needed
    let defaultShift = await prisma.shift.findFirst({ where: { name: 'General Shift' } })
    if (!defaultShift) {
      defaultShift = await prisma.shift.create({
        data: { name: 'General Shift', startTime: '09:55', endTime: '17:00' }
      })
    }
    const shiftsByName = new Map<string, string>()
    for (const s of await prisma.shift.findMany()) if (!shiftsByName.has(s.name)) shiftsByName.set(s.name, s.id)

    // Pre-cache highest sequence numbers per year
    const nextSeqByYear = new Map<number, number>()

    for (const row of data) {
      const name = row['Name']?.trim()
      const machineId = row['Machine ID']?.toString().trim()
      const deptName = row['Department']?.trim()
      const desigName = row['Designation']?.trim()
      const joiningDate = (
        row['Joining Date'] ||
        row['joiningDate'] ||
        row['DOJ'] ||
        row['D.O.J.'] ||
        row['JoiningDate']
      )?.toString().trim()

      if (!name || !machineId) continue // Skip invalid rows

      let departmentId = null
      let designationId = null

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

      const existing = existingByMachineId.get(machineId)
      const decision = resolveCsvShift({
        isNew: !existing,
        existingShiftId: existing?.shiftId ?? null,
        shiftCell: row['Shift'],
        shiftsByName,
        defaultShiftId: defaultShift.id,
      })

      if (existing) {
        // Update existing staff
        await prisma.staff.update({
          where: { machineId },
          data: {
            name,
            departmentId,
            designationId,
          },
        })

        if (decision.action === 'set') {
          const result = await applyShiftChange({
            staffId: existing.id,
            shiftId: decision.shiftId,
            effectiveFrom: todayKey,
            source: 'MANUAL',
            createdByUserId: auth.user.id,
          })
          if (!result.recalculated) recalculationFailed++
        }
      } else {
        // Create new staff with code, period, payroll info, user and audit log
        const chosenShiftId = decision.action === 'set' ? decision.shiftId : defaultShift.id
        const year = parseInt(joiningDate!.slice(0, 4), 10)

        if (!nextSeqByYear.has(year)) {
          const staffInYear = await prisma.staff.findMany({
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
          nextSeqByYear.set(year, maxSeq + 1)
        }

        const seq = nextSeqByYear.get(year)!
        nextSeqByYear.set(year, seq + 1)
        const employeeCode = formatEmployeeCode(year, seq)

        const tempPassword = generateTemporaryPassword(10)
        const hashedPassword = await bcrypt.hash(tempPassword, 10)

        const newStaff = await prisma.$transaction(async (tx) => {
          const staff = await tx.staff.create({
            data: {
              machineId,
              name,
              employeeCode,
              joiningDate,
              departmentId,
              designationId,
              shiftId: chosenShiftId,
            },
          })

          await tx.employmentPeriod.create({
            data: {
              staffId: staff.id,
              startDate: joiningDate!,
              endDate: null,
              createdByUserId: auth.user.id,
            },
          })

          await tx.staffPayrollInfo.create({
            data: {
              staffId: staff.id,
              payGroup: 'BANK_EPF',
            },
          })

          if (chosenShiftId) {
            await tx.shiftAssignment.create({
              data: {
                staffId: staff.id,
                shiftId: chosenShiftId,
                effectiveFrom: joiningDate!,
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
                shiftId: chosenShiftId,
                payGroup: 'BANK_EPF',
              }),
            },
          })

          return staff
        })

        existingByMachineId.set(machineId, { id: newStaff.id, machineId, shiftId: chosenShiftId })
      }

      processedCount++
    }

    return NextResponse.json({ success: true, processedCount, recalculationFailed })
  } catch (error) {
    console.error('Bulk Import Error:', error)
    return NextResponse.json({ error: 'Failed to process bulk import' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

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
          createdByUserId: auth.user.id,
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
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })

    // Deletion guard: Check attendanceLogs, dailyRecords, monthlyPayrolls, and shiftAssignments > 1
    const [logCount, recordCount, payrollCount] = await Promise.all([
      prisma.attendanceLog.count({ where: { staffId: { in: ids } } }),
      prisma.dailyRecord.count({ where: { staffId: { in: ids } } }),
      prisma.monthlyPayroll.count({ where: { staffId: { in: ids } } }),
    ])

    if (logCount > 0 || recordCount > 0 || payrollCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete staff member with attendance or payroll history. Use Exit instead.' },
        { status: 409 }
      )
    }

    for (const staffId of ids) {
      const assignmentCount = await prisma.shiftAssignment.count({ where: { staffId } })
      if (assignmentCount > 1) {
        return NextResponse.json(
          { error: 'Cannot delete staff member with attendance or payroll history. Use Exit instead.' },
          { status: 409 }
        )
      }
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.shiftAssignment.deleteMany({ where: { staffId: { in: ids } } })
      await tx.payGroupChange.deleteMany({ where: { staffPayrollInfo: { staffId: { in: ids } } } })
      await tx.staffPayrollInfo.deleteMany({ where: { staffId: { in: ids } } })
      await tx.user.deleteMany({ where: { staffId: { in: ids } } })
      await tx.employmentPeriod.deleteMany({ where: { staffId: { in: ids } } })
      await tx.staff.deleteMany({ where: { id: { in: ids } } })
    })

    return NextResponse.json({ success: true, count: ids.length })
  } catch (error) {
    console.error('Bulk Delete Error:', error)
    return NextResponse.json({ error: 'Failed to process bulk delete' }, { status: 500 })
  }
}
