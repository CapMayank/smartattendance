import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
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

function parsePayGroup(val: unknown): 'BANK_EPF' | 'CASH' | null {
  if (typeof val !== 'string') return null
  const upper = val.trim().toUpperCase()
  if (upper === 'CASH') return 'CASH'
  if (upper === 'BANK_EPF' || upper === 'BANK' || upper === 'BANK / EPF' || upper === 'EPF') return 'BANK_EPF'
  return null
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
    const generatedCredentials: Array<{
      name: string
      machineId: string
      employeeCode: string
      temporaryPassword: string
    }> = []

    // Fetch existing staff to identify existing vs new machine IDs
    const existingStaff = await prisma.staff.findMany({
      select: { id: true, machineId: true, shiftId: true, employeeCode: true, joiningDate: true }
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
      } else if (joiningDate && !isValidDateKey(joiningDate)) {
        validationErrors.push({
          row: i + 1,
          machineId,
          error: 'Joining Date must be in YYYY-MM-DD format',
        })
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
    const allocateCodeForYear = async (year: number) => {
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
      return formatEmployeeCode(year, seq)
    }

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
      const explicitPayGroup = parsePayGroup(row['Pay Group'] || row['payGroup'] || row['PayGroup'])

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
        const needsOnboarding = !existing.employeeCode && joiningDate && isValidDateKey(joiningDate)
        let newEmployeeCode: string | undefined
        if (needsOnboarding) {
          const year = parseInt(joiningDate.slice(0, 4), 10)
          newEmployeeCode = await allocateCodeForYear(year)
        }

        const updatePayload: Record<string, unknown> = {
          name,
          departmentId,
          designationId,
        }
        if (joiningDate && isValidDateKey(joiningDate) && !existing.joiningDate) {
          updatePayload.joiningDate = joiningDate
        }
        if (newEmployeeCode) {
          updatePayload.employeeCode = newEmployeeCode
        }

        await prisma.staff.update({
          where: { machineId },
          data: updatePayload,
        })

        if (explicitPayGroup && prisma.staffPayrollInfo?.upsert) {
          await prisma.staffPayrollInfo.upsert({
            where: { staffId: existing.id },
            update: { payGroup: explicitPayGroup },
            create: { staffId: existing.id, payGroup: explicitPayGroup },
          })
        }

        if (needsOnboarding && newEmployeeCode) {
          if (prisma.employmentPeriod?.findFirst) {
            const periodExists = await prisma.employmentPeriod.findFirst({ where: { staffId: existing.id } })
            if (!periodExists) {
              await prisma.employmentPeriod.create({
                data: {
                  staffId: existing.id,
                  startDate: joiningDate!,
                  endDate: null,
                  createdByUserId: auth.user.id,
                },
              })
            }
          }
          if (prisma.user?.findFirst) {
            const userExists = await prisma.user.findFirst({ where: { staffId: existing.id } })
            if (!userExists) {
              const tempPassword = generateTemporaryPassword(10)
              const hashedPassword = await bcrypt.hash(tempPassword, 10)
              await prisma.user.create({
                data: {
                  name,
                  role: 'EMPLOYEE',
                  password: hashedPassword,
                  mustChangePassword: true,
                  staffId: existing.id,
                },
              })
              generatedCredentials.push({
                name,
                machineId,
                employeeCode: newEmployeeCode,
                temporaryPassword: tempPassword,
              })
            }
          }
          existing.employeeCode = newEmployeeCode
          existing.joiningDate = joiningDate!
        }

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
        const chosenPayGroup = explicitPayGroup || 'BANK_EPF'
        const year = parseInt(joiningDate!.slice(0, 4), 10)
        const employeeCode = await allocateCodeForYear(year)

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
              payGroup: chosenPayGroup,
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
                payGroup: chosenPayGroup,
              }),
            },
          })

          return staff
        })

        generatedCredentials.push({
          name,
          machineId,
          employeeCode,
          temporaryPassword: tempPassword,
        })

        existingByMachineId.set(machineId, {
          id: newStaff.id,
          machineId,
          shiftId: chosenShiftId,
          employeeCode,
          joiningDate: joiningDate!,
        })
      }

      processedCount++
    }

    return NextResponse.json({ success: true, processedCount, recalculationFailed, generatedCredentials })
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

    const selfStaffId = auth.user.staffId ?? auth.user.staff?.id
    if (selfStaffId && ids.includes(selfStaffId)) {
      return NextResponse.json(
        { error: 'Cannot delete your own staff record while signed in.' },
        { status: 400 }
      )
    }

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

    if (prisma.user?.count) {
      const deletingAdminCount = await prisma.user.count({
        where: { staffId: { in: ids }, role: 'ADMIN', disabledAt: null },
      })
      if (deletingAdminCount > 0) {
        const totalActiveAdmins = await prisma.user.count({
          where: { role: 'ADMIN', disabledAt: null },
        })
        if (totalActiveAdmins - deletingAdminCount < 1) {
          return NextResponse.json(
            { error: 'Cannot delete the last remaining active Admin user' },
            { status: 400 }
          )
        }
      }
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (tx.punchPhoto?.deleteMany) {
        await tx.punchPhoto.deleteMany({ where: { staffId: { in: ids } } })
      }
      if (tx.shiftSuggestion?.deleteMany) {
        await tx.shiftSuggestion.deleteMany({ where: { staffId: { in: ids } } })
      }
      if (tx.approverDepartment?.deleteMany) {
        await tx.approverDepartment.deleteMany({ where: { user: { staffId: { in: ids } } } })
      }
      await tx.shiftAssignment.deleteMany({ where: { staffId: { in: ids } } })
      await tx.payGroupChange.deleteMany({ where: { staffPayrollInfo: { staffId: { in: ids } } } })
      await tx.staffPayrollInfo.deleteMany({ where: { staffId: { in: ids } } })
      await tx.user.deleteMany({ where: { staffId: { in: ids } } })
      await tx.employmentPeriod.deleteMany({ where: { staffId: { in: ids } } })
      await tx.staff.deleteMany({ where: { id: { in: ids } } })
      if (tx.auditLog?.create) {
        await tx.auditLog.create({
          data: {
            actorUserId: auth.user.id,
            action: 'STAFF_DELETE',
            targetType: 'Staff',
            targetId: ids[0],
            details: JSON.stringify({ deletedStaffIds: ids }),
          },
        })
      }
    })

    return NextResponse.json({ success: true, count: ids.length })
  } catch (error) {
    console.error('Bulk Delete Error:', error)
    return NextResponse.json({ error: 'Failed to process bulk delete' }, { status: 500 })
  }
}
