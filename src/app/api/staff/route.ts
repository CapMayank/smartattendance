import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole, getApproverDepartmentIds } from "@/lib/rbac"
import { istDateKey } from '@/lib/dashboard-calc'
import { ALWAYS } from '@/lib/shift-lookup'
import { applyShiftChange, isValidDayKey, START_BEFORE_ALWAYS_ERROR, syncCurrentShifts } from '@/lib/shift-change-service'
import { formatEmployeeCode, parseEmployeeCode } from '@/lib/employee-code'
import { generateTemporaryPassword } from '@/lib/temporary-password'
import { calculateStaffPayroll, type PayGroup } from '@/lib/payroll-calc'
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
  const allStaff = await prisma.staff.findMany({ 
    include: {
      department: true,
      designation: true,
      shift: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          disabledAt: true,
          mustChangePassword: true,
          approvesAllDepartments: true,
          approverDepartments: {
            select: {
              departmentId: true,
            },
          },
        },
      },
      payrollInfo: {
        select: {
          payGroup: true,
          monthlyCtc: true,
          bankAccount: true,
          ifsc: true,
          nameAsPerBank: true,
          uan: true,
          nameOnUan: true,
          pan: true,
          aadhaar: true,
          dob: true,
          gender: true,
          fatherHusbandName: true,
          relationship: true,
          mobileNumber: true,
          email: true,
          nationality: true,
          qualification: true,
        },
      },
      employmentPeriods: {
        orderBy: { startDate: 'desc' },
      },
    }
  })

  const allowedDepartmentIds = getApproverDepartmentIds(auth.user)
  const staff =
    allowedDepartmentIds !== null
      ? allStaff.filter((s) => s.departmentId !== null && allowedDepartmentIds.includes(s.departmentId))
      : allStaff

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
    const {
      name,
      machineId,
      joiningDate,
      departmentId,
      designationId,
      shiftId,
      payGroup,
      role,
      email,
      approvesAllDepartments,
      approverDepartmentIds,
      mobileNumber,
      gender,
      dob,
      fatherHusbandName,
      relationship,
      qualification,
      nationality,
      bankAccount,
      ifsc,
      nameAsPerBank,
      pan,
      aadhaar,
      uan,
    } = data

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
    const userRole = role === 'ADMIN' || role === 'APPROVER' || role === 'EMPLOYEE' ? role : 'EMPLOYEE'
    const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : undefined
    const isApproverAllDepts = userRole === 'APPROVER' ? approvesAllDepartments !== false : false
    const scopedDeptIds: string[] =
      userRole === 'APPROVER' && !isApproverAllDepts && Array.isArray(approverDepartmentIds)
        ? approverDepartmentIds.filter((d: unknown): d is string => typeof d === 'string' && d.trim().length > 0)
        : []

    const temporaryPassword = generateTemporaryPassword(10)
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

    const createdStaff = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          payGroup: payGroup === 'CASH' ? 'CASH' : 'BANK_EPF',
          ...(mobileNumber !== undefined ? { mobileNumber: mobileNumber ? String(mobileNumber).trim() : null } : {}),
          ...(gender !== undefined ? { gender: gender ? String(gender).trim() : null } : {}),
          ...(dob ? { dob: new Date(dob) } : {}),
          ...(fatherHusbandName !== undefined ? { fatherHusbandName: fatherHusbandName ? String(fatherHusbandName).trim() : null } : {}),
          ...(relationship !== undefined ? { relationship: relationship ? String(relationship).trim() : null } : {}),
          ...(qualification !== undefined ? { qualification: qualification ? String(qualification).trim() : null } : {}),
          ...(nationality !== undefined ? { nationality: nationality ? String(nationality).trim() : null } : {}),
          ...(bankAccount !== undefined ? { bankAccount: bankAccount ? String(bankAccount).trim() : null } : {}),
          ...(ifsc !== undefined ? { ifsc: ifsc ? String(ifsc).trim().toUpperCase() : null } : {}),
          ...(nameAsPerBank !== undefined ? { nameAsPerBank: nameAsPerBank ? String(nameAsPerBank).trim() : null } : {}),
          ...(pan !== undefined ? { pan: pan ? String(pan).trim().toUpperCase() : null } : {}),
          ...(aadhaar !== undefined ? { aadhaar: aadhaar ? String(aadhaar).trim() : null } : {}),
          ...(uan !== undefined ? { uan: uan ? String(uan).trim() : null } : {}),
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
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

      const userCreateData: Prisma.UserUncheckedCreateInput = {
        name: staff.name,
        role: userRole,
        password: hashedPassword,
        mustChangePassword: true,
        staffId: staff.id,
        ...(userRole === 'APPROVER' ? { approvesAllDepartments: isApproverAllDepts } : {}),
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      }

      const createdUser = await tx.user.create({
        data: userCreateData,
      })

      if (userRole === 'APPROVER' && scopedDeptIds.length > 0 && tx.approverDepartment?.createMany) {
        await tx.approverDepartment.createMany({
          data: scopedDeptIds.map((deptId) => ({
            userId: createdUser.id,
            departmentId: deptId,
          })),
        })
      }

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
            payGroup: payGroup === 'CASH' ? 'CASH' : 'BANK_EPF',
            role: userRole,
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

    const selfStaffId = auth.user.staffId ?? auth.user.staff?.id
    if (selfStaffId && idList.includes(selfStaffId)) {
      return NextResponse.json(
        { error: 'Cannot delete your own staff record while signed in.' },
        { status: 400 }
      )
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

    if (prisma.user?.count) {
      const deletingAdminCount = await prisma.user.count({
        where: { staffId: { in: idList }, role: 'ADMIN', disabledAt: null },
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
        await tx.punchPhoto.deleteMany({ where: { staffId: { in: idList } } })
      }
      if (tx.shiftSuggestion?.deleteMany) {
        await tx.shiftSuggestion.deleteMany({ where: { staffId: { in: idList } } })
      }
      if (tx.approverDepartment?.deleteMany) {
        await tx.approverDepartment.deleteMany({ where: { user: { staffId: { in: idList } } } })
      }
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
      if (tx.auditLog?.create) {
        await tx.auditLog.create({
          data: {
            actorUserId: auth.user.id,
            action: 'STAFF_DELETE',
            targetType: 'Staff',
            targetId: idList[0],
            details: JSON.stringify({ deletedStaffIds: idList }),
          },
        })
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

    const current = await prisma.staff.findUnique({
      where: { id },
      select: {
        shiftId: true,
        employeeCode: true,
        joiningDate: true,
      },
    })
    if (!current) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })

    const nextShiftId: string | null = updateData.shiftId || null
    const shiftChanges = updateData.shiftId !== undefined && nextShiftId !== current.shiftId
    if (shiftChanges && nextShiftId !== null && !(await prisma.shift.findUnique({ where: { id: nextShiftId } }))) {
      return NextResponse.json({ error: 'Unknown shift' }, { status: 400 })
    }

    let generatedEmployeeCode = current.employeeCode
    let updatedJoiningDate = current.joiningDate
    let issuedTemporaryPassword: string | undefined

    if (updateData.joiningDate && isValidDateKey(updateData.joiningDate)) {
      const nextJoinDate: string = updateData.joiningDate
      updatedJoiningDate = nextJoinDate
      if (!generatedEmployeeCode) {
        const year = parseInt(nextJoinDate.slice(0, 4), 10)
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
        generatedEmployeeCode = formatEmployeeCode(year, maxSeq + 1)
      }
    }

    const staffUpdateFields: Record<string, unknown> = {
      name: updateData.name,
      machineId: updateData.machineId,
      departmentId: updateData.departmentId || null,
      designationId: updateData.designationId || null,
    }
    if (updatedJoiningDate !== current.joiningDate) {
      staffUpdateFields.joiningDate = updatedJoiningDate
    }
    if (generatedEmployeeCode !== current.employeeCode) {
      staffUpdateFields.employeeCode = generatedEmployeeCode
    }

    // Ensure nulls are handled for optional relations. The shift is changed through the
    // shift change service (dated history + recalculation), never written here.
    let staff = await prisma.staff.update({ 
      where: { id },
      data: staffUpdateFields,
    })

    // Optional onboarding / access / payGroup / KYC updates when provided from unified Staff & Access modal
    const hasPayrollOrKyc =
      updateData.payGroup !== undefined ||
      updateData.mobileNumber !== undefined ||
      updateData.gender !== undefined ||
      updateData.dob !== undefined ||
      updateData.fatherHusbandName !== undefined ||
      updateData.relationship !== undefined ||
      updateData.qualification !== undefined ||
      updateData.nationality !== undefined ||
      updateData.bankAccount !== undefined ||
      updateData.ifsc !== undefined ||
      updateData.nameAsPerBank !== undefined ||
      updateData.pan !== undefined ||
      updateData.aadhaar !== undefined ||
      updateData.uan !== undefined

    if (hasPayrollOrKyc && prisma.staffPayrollInfo?.upsert) {
      const payrollUpdateData: Record<string, unknown> = {}
      if (updateData.payGroup && (updateData.payGroup === 'BANK_EPF' || updateData.payGroup === 'CASH')) {
        payrollUpdateData.payGroup = updateData.payGroup
      }
      if (updateData.mobileNumber !== undefined) payrollUpdateData.mobileNumber = updateData.mobileNumber ? String(updateData.mobileNumber).trim() : null
      if (updateData.gender !== undefined) payrollUpdateData.gender = updateData.gender ? String(updateData.gender).trim() : null
      if (updateData.dob !== undefined) payrollUpdateData.dob = updateData.dob ? new Date(updateData.dob) : null
      if (updateData.fatherHusbandName !== undefined) payrollUpdateData.fatherHusbandName = updateData.fatherHusbandName ? String(updateData.fatherHusbandName).trim() : null
      if (updateData.relationship !== undefined) payrollUpdateData.relationship = updateData.relationship ? String(updateData.relationship).trim() : null
      if (updateData.qualification !== undefined) payrollUpdateData.qualification = updateData.qualification ? String(updateData.qualification).trim() : null
      if (updateData.nationality !== undefined) payrollUpdateData.nationality = updateData.nationality ? String(updateData.nationality).trim() : null
      if (updateData.bankAccount !== undefined) payrollUpdateData.bankAccount = updateData.bankAccount ? String(updateData.bankAccount).trim() : null
      if (updateData.ifsc !== undefined) payrollUpdateData.ifsc = updateData.ifsc ? String(updateData.ifsc).trim().toUpperCase() : null
      if (updateData.nameAsPerBank !== undefined) payrollUpdateData.nameAsPerBank = updateData.nameAsPerBank ? String(updateData.nameAsPerBank).trim() : null
      if (updateData.pan !== undefined) payrollUpdateData.pan = updateData.pan ? String(updateData.pan).trim().toUpperCase() : null
      if (updateData.aadhaar !== undefined) payrollUpdateData.aadhaar = updateData.aadhaar ? String(updateData.aadhaar).trim() : null
      if (updateData.uan !== undefined) payrollUpdateData.uan = updateData.uan ? String(updateData.uan).trim() : null
      if (updateData.isHigherPensionOpted !== undefined) payrollUpdateData.isHigherPensionOpted = Boolean(updateData.isHigherPensionOpted)

      const existingPayrollInfo = prisma.staffPayrollInfo.findUnique
        ? await prisma.staffPayrollInfo.findUnique({ where: { staffId: id } })
        : null

      const updatedPayrollInfo = await prisma.staffPayrollInfo.upsert({
        where: { staffId: id },
        update: payrollUpdateData,
        create: {
          staffId: id,
          payGroup: updateData.payGroup || 'BANK_EPF',
          ...payrollUpdateData,
        },
      })

      if (
        updateData.payGroup &&
        existingPayrollInfo &&
        existingPayrollInfo.payGroup !== updateData.payGroup &&
        prisma.payGroupChange?.create
      ) {
          const currentMonthKey = istDateKey(new Date()).slice(0, 7)
          await prisma.payGroupChange.create({
            data: {
              staffPayrollInfoId: updatedPayrollInfo.id,
              payGroup: updateData.payGroup,
              effectiveFromMonth: currentMonthKey,
              createdByUserId: auth.user.id,
            },
          })
        }

        if (
          existingPayrollInfo &&
          existingPayrollInfo.payGroup !== updateData.payGroup &&
          prisma.monthlyPayroll?.findMany
        ) {
          const unlockedRows = await prisma.monthlyPayroll.findMany({
            where: { staffId: id, isLocked: false },
          })
          const payGroup = (updatedPayrollInfo.payGroup as PayGroup) || 'BANK_EPF'
          const monthlyCtc = updatedPayrollInfo.monthlyCtc || 0
          for (const row of unlockedRows) {
            const targetMonthYear = `${row.year}-${String(row.month).padStart(2, '0')}`
            const calc = calculateStaffPayroll({
              payGroup,
              monthlyCtc,
              presentDays: row.presentDays,
              totalDays: row.totalDays,
              refundOfAdvance: row.refundOfAdvance,
              bonusAmount: row.bonusAmount,
              bonusDays: row.bonusDays ?? 0,
              bonusType: (row.bonusType as 'DAYS' | 'FLAT' | 'CUSTOM') ?? 'CUSTOM',
              isBonusPfApplicable: row.isBonusPfApplicable,
              targetMonthYear,
              isHigherPensionOpted: !!updatedPayrollInfo.isHigherPensionOpted,
            })
            if (calc) {
              await prisma.monthlyPayroll.update({
                where: { id: row.id },
                data: { ...calc },
              })
            }
          }
        }
      }

    if (updatedJoiningDate && prisma.employmentPeriod?.findFirst) {
      const existingPeriod = await prisma.employmentPeriod.findFirst({ where: { staffId: id } })
      if (!existingPeriod) {
        await prisma.employmentPeriod.create({
          data: {
            staffId: id,
            startDate: updatedJoiningDate,
            endDate: null,
            createdByUserId: auth.user.id,
          },
        })
      }
    }

    if (
      (updateData.role !== undefined ||
        updateData.email !== undefined ||
        updateData.approvesAllDepartments !== undefined ||
        updateData.approverDepartmentIds !== undefined ||
        generatedEmployeeCode !== current.employeeCode) &&
      prisma.user?.findFirst
    ) {
      const existingUser = await prisma.user.findFirst({ where: { staffId: id } })
      const nextRole =
        updateData.role === 'ADMIN' || updateData.role === 'APPROVER' || updateData.role === 'EMPLOYEE'
          ? updateData.role
          : undefined
      const nextEmail =
        typeof updateData.email === 'string'
          ? updateData.email.trim() ? updateData.email.trim().toLowerCase() : null
          : undefined

      if (existingUser) {
        if (nextRole && nextRole !== 'ADMIN' && existingUser.role === 'ADMIN' && existingUser.disabledAt === null) {
          const activeAdminCount = await prisma.user.count({
            where: { role: 'ADMIN', disabledAt: null },
          })
          if (activeAdminCount <= 1) {
            return NextResponse.json(
              { error: 'Cannot demote the last remaining active Admin user' },
              { status: 400 }
            )
          }
        }
        const effectiveRole = nextRole || existingUser.role
        const userUpdate: Record<string, unknown> = {
          name: updateData.name || staff.name,
        }
        if (nextRole) userUpdate.role = nextRole
        if (nextEmail !== undefined) userUpdate.email = nextEmail
        if (effectiveRole === 'APPROVER' && updateData.approvesAllDepartments !== undefined) {
          userUpdate.approvesAllDepartments = Boolean(updateData.approvesAllDepartments)
        } else if (effectiveRole !== 'APPROVER') {
          userUpdate.approvesAllDepartments = false
        }

        await prisma.user.update({
          where: { id: existingUser.id },
          data: userUpdate,
        })

        if (prisma.approverDepartment?.deleteMany) {
          if (effectiveRole !== 'APPROVER' || updateData.approvesAllDepartments === true) {
            await prisma.approverDepartment.deleteMany({ where: { userId: existingUser.id } })
          } else if (Array.isArray(updateData.approverDepartmentIds)) {
            await prisma.approverDepartment.deleteMany({ where: { userId: existingUser.id } })
            const scopedIds = updateData.approverDepartmentIds.filter(
              (d: unknown): d is string => typeof d === 'string' && d.trim().length > 0
            )
            if (scopedIds.length > 0 && prisma.approverDepartment.createMany) {
              await prisma.approverDepartment.createMany({
                data: scopedIds.map((departmentId: string) => ({
                  userId: existingUser.id,
                  departmentId,
                })),
              })
            }
          }
        }
      } else if (generatedEmployeeCode) {
        issuedTemporaryPassword = generateTemporaryPassword(10)
        const hashedPassword = await bcrypt.hash(issuedTemporaryPassword, 10)
        const effectiveRole = nextRole || 'EMPLOYEE'
        const isApproverAll = effectiveRole === 'APPROVER' ? updateData.approvesAllDepartments !== false : false
        const createdUser = await prisma.user.create({
          data: {
            name: updateData.name || staff.name,
            email: nextEmail || null,
            role: effectiveRole,
            password: hashedPassword,
            mustChangePassword: true,
            staffId: id,
            approvesAllDepartments: isApproverAll,
          },
        })
        if (
          effectiveRole === 'APPROVER' &&
          !isApproverAll &&
          Array.isArray(updateData.approverDepartmentIds) &&
          prisma.approverDepartment?.createMany
        ) {
          const scopedIds = updateData.approverDepartmentIds.filter(
            (d: unknown): d is string => typeof d === 'string' && d.trim().length > 0
          )
          if (scopedIds.length > 0) {
            await prisma.approverDepartment.createMany({
              data: scopedIds.map((departmentId: string) => ({
                userId: createdUser.id,
                departmentId,
              })),
            })
          }
        }
      }
    }

    if (prisma.auditLog?.create) {
      await prisma.auditLog.create({
        data: {
          actorUserId: auth.user.id,
          action: 'STAFF_UPDATE',
          targetType: 'Staff',
          targetId: id,
          details: JSON.stringify({
            name: staff.name,
            machineId: staff.machineId,
            employeeCode: generatedEmployeeCode,
            joiningDate: updatedJoiningDate,
            payGroup: updateData.payGroup,
            role: updateData.role,
          }),
        },
      })
    }

    if (shiftChanges) {
      const shiftChange = await applyShiftChange({
        staffId: id,
        shiftId: nextShiftId,
        effectiveFrom: updateData.effectiveFrom ?? istDateKey(new Date()),
        source: 'MANUAL',
        createdByUserId: session!.user?.id,
      })
      staff = (await prisma.staff.findUnique({ where: { id } })) ?? staff
      return NextResponse.json({
        ...staff,
        shiftChange,
        ...(issuedTemporaryPassword ? { temporaryPassword: issuedTemporaryPassword } : {}),
      })
    }
    return NextResponse.json({
      ...staff,
      ...(issuedTemporaryPassword ? { temporaryPassword: issuedTemporaryPassword } : {}),
    })
  } catch {
    return NextResponse.json({ error: 'Failed to update staff' }, { status: 500 })
  }
}
