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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function loadWizardData() {
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

  return { adminUsers, existingStaff }
}

// This endpoint is public (it must work before anyone can sign in), so it only reports
// whether setup is done. Admin and staff lists are returned by POST { action: 'VERIFY' }
// after the setup secret has been checked.
export async function GET() {
  const completed = await isSetupCompleted()
  return NextResponse.json({
    setupCompleted: completed,
    requiresSecret: !completed,
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

  const { secret, adminAction, adminUserId, existingStaffId, adminProfile, staffJoiningDates, adminAccount } = body || {}

  if (!verifySetupSecret(secret)) {
    return NextResponse.json({ error: 'Invalid setup secret code' }, { status: 401 })
  }

  // Step 1 of the wizard: confirm the secret and hand back what the next steps need.
  if (body?.action === 'VERIFY') {
    return NextResponse.json({ ok: true, ...(await loadWizardData()) })
  }

  if (adminAction !== 'LINK' && adminAction !== 'CREATE') {
    return NextResponse.json({ error: 'adminAction must be LINK or CREATE' }, { status: 400 })
  }

  // The administrator login: either an existing ADMIN user, or (fresh install, no admin
  // user yet) a new account created from the email and password entered in the wizard.
  let newAdminAccount: { email: string; hashedPassword: string } | null = null
  if (adminUserId) {
    const adminUser = await prisma.user.findUnique({ where: { id: String(adminUserId) } })
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Selected administrator user was not found' }, { status: 400 })
    }
  } else {
    const email = typeof adminAccount?.email === 'string' ? adminAccount.email.trim().toLowerCase() : ''
    const password = typeof adminAccount?.password === 'string' ? adminAccount.password : ''
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Select an administrator user, or provide an email and password to create one' },
        { status: 400 }
      )
    }
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Administrator email is not valid' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Administrator password must be at least 8 characters' }, { status: 400 })
    }
    if (await prisma.user.findUnique({ where: { email } })) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    newAdminAccount = { email, hashedPassword: await bcrypt.hash(password, 10) }
  }

  if (adminAction === 'LINK') {
    if (!existingStaffId) {
      return NextResponse.json({ error: 'existingStaffId is required for LINK action' }, { status: 400 })
    }
  }

  if (adminAction === 'CREATE') {
    if (!adminProfile || !adminProfile.name || !adminProfile.machineId || !adminProfile.joiningDate) {
      return NextResponse.json({ error: 'name, machineId, and joiningDate are required for adminProfile' }, { status: 400 })
    }
    if (!isValidDateKey(adminProfile.joiningDate)) {
      return NextResponse.json({ error: 'joiningDate must be in valid YYYY-MM-DD format' }, { status: 400 })
    }
    const machineIdTaken = await prisma.staff.findUnique({
      where: { machineId: String(adminProfile.machineId).trim() },
    })
    if (machineIdTaken) {
      return NextResponse.json(
        { error: 'This Machine ID already belongs to a staff member. Use "Link to Existing Staff" instead.' },
        { status: 409 }
      )
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

  // Points the administrator login at the admin's staff record.
  async function attachAdminLogin(tx: any, staffId: string, staffName: string) {
    // A staff record can only have one login: free it from any other user first.
    await tx.user.updateMany({
      where: { staffId, ...(adminUserId ? { id: { not: adminUserId } } : {}) },
      data: { staffId: null },
    })
    if (adminUserId) {
      await tx.user.update({
        where: { id: adminUserId },
        data: { staffId, role: 'ADMIN' },
      })
    } else if (newAdminAccount) {
      await tx.user.create({
        data: {
          name: staffName,
          email: newAdminAccount.email,
          password: newAdminAccount.hashedPassword,
          role: 'ADMIN',
          mustChangePassword: false,
          staffId,
        },
      })
    }
  }

  const generatedCredentials: Array<{
    name: string
    machineId: string
    employeeCode: string
    temporaryPassword?: string
  }> = []

  // Pre-compute bcrypt password hashes outside the DB transaction so CPU-bound
  // hashing of 20+ staff passwords never blocks or expires the interactive transaction.
  const batchItems: Array<{ machineId: string; joiningDate: string; payGroup?: string }> =
    Array.isArray(staffJoiningDates) ? staffJoiningDates : []

  const precomputedPasswords = await Promise.all(
    batchItems.map(async () => {
      const tempPassword = generateTemporaryPassword(10)
      const hashedPassword = await bcrypt.hash(tempPassword, 10)
      return { tempPassword, hashedPassword }
    })
  )

  try {
    await prisma.$transaction(
      async (tx: any) => {
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

          await attachAdminLogin(tx, staff.id, staff.name)
        } else if (adminAction === 'LINK') {
          const staff = await tx.staff.findUnique({
            where: { id: existingStaffId },
          })

          if (!staff) {
            throw new Error(`Staff with id ${existingStaffId} not found`)
          }

          const matchingCsvEntry = batchItems.find(
            (item) => item?.machineId && String(item.machineId).trim() === String(staff.machineId).trim()
          )

          let updatedJoiningDate =
            staff.joiningDate ||
            (matchingCsvEntry?.joiningDate ? String(matchingCsvEntry.joiningDate).trim() : null)
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
                payGroup: matchingCsvEntry?.payGroup || 'BANK_EPF',
              },
            })
          }

          await attachAdminLogin(tx, existingStaffId, staff.name)
        }

        // Step 2: Batch Onboarding of Existing Staff (Optional)
        if (batchItems.length > 0) {
          for (let i = 0; i < batchItems.length; i++) {
            const item = batchItems[i]
            if (!item.machineId || !item.joiningDate) continue
            const staff = await tx.staff.findUnique({
              where: { machineId: String(item.machineId).trim() },
            })
            if (!staff) continue

            let code = staff.employeeCode
            const date = staff.joiningDate || String(item.joiningDate).trim()

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
              const { tempPassword, hashedPassword } = precomputedPasswords[i]
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
              onboardedStaffCount: batchItems.length,
            }),
          },
        })
      },
      { maxWait: 10000, timeout: 60000 }
    )

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
