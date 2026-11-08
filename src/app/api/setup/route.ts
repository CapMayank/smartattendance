import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isSetupCompleted, verifySetupSecret } from '@/lib/setup'
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
  const completed = await isSetupCompleted()
  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: {
      id: true,
      name: true,
      email: true,
      staffId: true,
    },
  })

  const existingStaff = await prisma.staff.findMany({
    select: {
      id: true,
      name: true,
      machineId: true,
      employeeCode: true,
      joiningDate: true,
    },
    orderBy: { machineId: 'asc' },
  })

  return NextResponse.json({
    setupCompleted: completed,
    requiresSecret: !completed,
    adminUsers,
    existingStaff,
  })
}

export async function POST(request: Request) {
  const alreadyCompleted = await isSetupCompleted()
  if (alreadyCompleted) {
    return NextResponse.json({ error: 'Setup already completed' }, { status: 400 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { secret, adminAction, adminUserId, existingStaffId, adminProfile, staffJoiningDates } = body || {}

  if (!verifySetupSecret(secret)) {
    return NextResponse.json({ error: 'Invalid setup secret code' }, { status: 401 })
  }

  if (adminAction !== 'LINK' && adminAction !== 'CREATE') {
    return NextResponse.json({ error: 'adminAction must be LINK or CREATE' }, { status: 400 })
  }

  if (adminAction === 'LINK') {
    if (!existingStaffId || !adminUserId) {
      return NextResponse.json({ error: 'existingStaffId and adminUserId are required for LINK action' }, { status: 400 })
    }
  }

  if (adminAction === 'CREATE') {
    if (!adminProfile || !adminProfile.name || !adminProfile.machineId || !adminProfile.joiningDate) {
      return NextResponse.json({ error: 'name, machineId, and joiningDate are required for adminProfile' }, { status: 400 })
    }
    if (!isValidDateKey(adminProfile.joiningDate)) {
      return NextResponse.json({ error: 'joiningDate must be in valid YYYY-MM-DD format' }, { status: 400 })
    }
  }

  const yearSeqMap = new Map<number, number>()

  async function getNextSeq(year: number, tx: any): Promise<string> {
    if (!yearSeqMap.has(year)) {
      const existing = await tx.staff.findMany({
        where: { employeeCode: { startsWith: `SAR-${year}-` } },
        select: { employeeCode: true },
      })
      let max = 0
      for (const s of existing) {
        if (!s.employeeCode) continue
        const parsed = parseEmployeeCode(s.employeeCode)
        if (parsed && parsed.year === year && parsed.sequence > max) {
          max = parsed.sequence
        }
      }
      yearSeqMap.set(year, max)
    }
    const currentMax = (yearSeqMap.get(year) || 0) + 1
    yearSeqMap.set(year, currentMax)
    return formatEmployeeCode(year, currentMax)
  }

  const generatedCredentials: Array<{
    name: string
    machineId: string
    employeeCode: string
    temporaryPassword?: string
  }> = []

  try {
    await prisma.$transaction(async (tx: any) => {
      // Step 1: Admin Profile Linking or Creation
      if (adminAction === 'CREATE') {
        const year = parseInt(adminProfile.joiningDate.slice(0, 4), 10)
        const employeeCode = await getNextSeq(year, tx)

        const staff = await tx.staff.create({
          data: {
            name: adminProfile.name.trim(),
            machineId: String(adminProfile.machineId).trim(),
            employeeCode,
            joiningDate: adminProfile.joiningDate,
            departmentId: adminProfile.departmentId || null,
            designationId: adminProfile.designationId || null,
            shiftId: adminProfile.shiftId || null,
          },
        })

        await tx.employmentPeriod.create({
          data: {
            staffId: staff.id,
            startDate: adminProfile.joiningDate,
            endDate: null,
            createdByUserId: adminUserId || null,
          },
        })

        await tx.staffPayrollInfo.create({
          data: {
            staffId: staff.id,
            payGroup: adminProfile.payGroup || 'BANK_EPF',
          },
        })

        if (adminProfile.shiftId) {
          await tx.shiftAssignment.create({
            data: {
              staffId: staff.id,
              shiftId: adminProfile.shiftId,
              effectiveFrom: adminProfile.joiningDate,
              source: 'INITIAL',
              createdByUserId: adminUserId || null,
            },
          })
        }

        if (adminUserId) {
          await tx.user.update({
            where: { id: adminUserId },
            data: { staffId: staff.id, role: 'ADMIN' },
          })
        }
      } else if (adminAction === 'LINK') {
        const staff = await tx.staff.findUnique({
          where: { id: existingStaffId },
        })

        if (!staff) {
          throw new Error(`Staff with id ${existingStaffId} not found`)
        }

        let updatedJoiningDate = staff.joiningDate
        let updatedEmployeeCode = staff.employeeCode

        if (!updatedJoiningDate) {
          updatedJoiningDate = new Date().toISOString().slice(0, 10)
        }

        if (!updatedEmployeeCode) {
          const year = parseInt(updatedJoiningDate.slice(0, 4), 10)
          updatedEmployeeCode = await getNextSeq(year, tx)
        }

        if (updatedJoiningDate !== staff.joiningDate || updatedEmployeeCode !== staff.employeeCode) {
          await tx.staff.update({
            where: { id: existingStaffId },
            data: {
              joiningDate: updatedJoiningDate,
              employeeCode: updatedEmployeeCode,
            },
          })
        }

        const existingPeriod = await tx.employmentPeriod.findFirst({
          where: { staffId: existingStaffId },
        })
        if (!existingPeriod) {
          await tx.employmentPeriod.create({
            data: {
              staffId: existingStaffId,
              startDate: updatedJoiningDate,
              createdByUserId: adminUserId || null,
            },
          })
        }

        const existingPayroll = await tx.staffPayrollInfo.findUnique({
          where: { staffId: existingStaffId },
        })
        if (!existingPayroll) {
          await tx.staffPayrollInfo.create({
            data: {
              staffId: existingStaffId,
              payGroup: 'BANK_EPF',
            },
          })
        }

        if (adminUserId) {
          await tx.user.update({
            where: { id: adminUserId },
            data: { staffId: existingStaffId, role: 'ADMIN' },
          })
        }
      }

      // Step 2: Batch Onboarding of Existing Staff (Optional)
      if (Array.isArray(staffJoiningDates) && staffJoiningDates.length > 0) {
        for (const item of staffJoiningDates) {
          if (!item.machineId || !item.joiningDate) continue
          const staff = await tx.staff.findUnique({
            where: { machineId: String(item.machineId).trim() },
          })
          if (!staff) continue

          let code = staff.employeeCode
          let date = staff.joiningDate || item.joiningDate

          if (!code) {
            const yr = parseInt(date.slice(0, 4), 10)
            code = await getNextSeq(yr, tx)
          }

          if (code !== staff.employeeCode || date !== staff.joiningDate) {
            await tx.staff.update({
              where: { id: staff.id },
              data: {
                employeeCode: code,
                joiningDate: date,
              },
            })
          }

          const period = await tx.employmentPeriod.findFirst({
            where: { staffId: staff.id },
          })
          if (!period) {
            await tx.employmentPeriod.create({
              data: {
                staffId: staff.id,
                startDate: date,
                createdByUserId: adminUserId || null,
              },
            })
          }

          await tx.staffPayrollInfo.upsert({
            where: { staffId: staff.id },
            create: {
              staffId: staff.id,
              payGroup: item.payGroup || 'BANK_EPF',
            },
            update: item.payGroup ? { payGroup: item.payGroup } : {},
          })

          const user = await tx.user.findFirst({
            where: { staffId: staff.id },
          })
          if (!user) {
            const tempPassword = generateTemporaryPassword(10)
            const hashedPassword = await bcrypt.hash(tempPassword, 10)
            await tx.user.create({
              data: {
                name: staff.name,
                role: 'EMPLOYEE',
                password: hashedPassword,
                mustChangePassword: true,
                staffId: staff.id,
              },
            })
            generatedCredentials.push({
              name: staff.name,
              machineId: staff.machineId,
              employeeCode: code,
              temporaryPassword: tempPassword,
            })
          }
        }
      }

      // Step 3: Complete Setup & Lock Gate
      await tx.systemSetting.upsert({
        where: { key: 'SETUP_COMPLETED' },
        create: { key: 'SETUP_COMPLETED', value: 'true' },
        update: { value: 'true' },
      })

      await tx.auditLog.create({
        data: {
          action: 'SYSTEM_SETUP_COMPLETED',
          actorUserId: adminUserId || null,
          targetType: 'System',
          targetId: 'SETUP',
          details: JSON.stringify({
            completedAt: new Date().toISOString(),
            adminAction,
            adminUserId,
            onboardedStaffCount: staffJoiningDates?.length || 0,
          }),
        },
      })
    })

    const response = NextResponse.json({
      success: true,
      message: 'Setup completed successfully',
      generatedCredentials,
    })

    response.cookies.set('setup-completed', 'true', {
      path: '/',
      httpOnly: false,
      maxAge: 31536000, // 1 year
    })

    return response
  } catch (error: any) {
    console.error('[setup] Error executing setup transaction:', error)
    return NextResponse.json(
      { error: error?.message || 'Setup transaction failed' },
      { status: 500 }
    )
  }
}
