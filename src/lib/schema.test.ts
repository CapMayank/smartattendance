import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'
import { createFakePrisma } from '../test-utils/fake-prisma'

describe('Prisma Schema and Client', () => {
  const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma')
  const schemaContent = fs.readFileSync(schemaPath, 'utf8')

  const getModel = (modelName: string) => {
    return Prisma.dmmf.datamodel.models.find((m) => m.name === modelName)
  }

  describe('User model updates', () => {
    it('has role, staffId, mustChangePassword, disabledAt, approvesAllDepartments and relations', () => {
      const user = getModel('User')
      expect(user).toBeDefined()

      const fieldNames = user!.fields.map((f) => f.name)
      expect(fieldNames).toContain('role')
      expect(fieldNames).toContain('staffId')
      expect(fieldNames).toContain('mustChangePassword')
      expect(fieldNames).toContain('disabledAt')
      expect(fieldNames).toContain('approvesAllDepartments')
      expect(fieldNames).toContain('staff')
      expect(fieldNames).toContain('approverDepartments')

      const roleField = user!.fields.find((f) => f.name === 'role')
      expect(roleField?.default).toBe('ADMIN')

      const staffIdField = user!.fields.find((f) => f.name === 'staffId')
      expect(staffIdField?.isUnique).toBe(true)

      const mustChangePassword = user!.fields.find((f) => f.name === 'mustChangePassword')
      expect(mustChangePassword?.default).toBe(false)

      const approvesAllDepartments = user!.fields.find((f) => f.name === 'approvesAllDepartments')
      expect(approvesAllDepartments?.default).toBe(false)
    })
  })

  describe('Staff model updates and restrict constraints', () => {
    it('has employeeCode, joiningDate, user, and employmentPeriods', () => {
      const staff = getModel('Staff')
      expect(staff).toBeDefined()

      const fieldNames = staff!.fields.map((f) => f.name)
      expect(fieldNames).toContain('employeeCode')
      expect(fieldNames).toContain('joiningDate')
      expect(fieldNames).toContain('user')
      expect(fieldNames).toContain('employmentPeriods')

      const employeeCodeField = staff!.fields.find((f) => f.name === 'employeeCode')
      expect(employeeCodeField?.isUnique).toBe(true)
    })

    it('replaces Cascade with Restrict on key Staff relationships in schema.prisma', () => {
      // Check schema file directly for onDelete: Restrict
      expect(schemaContent).toMatch(/model AttendanceLog[\s\S]*?staff\s+Staff\s+@relation\(fields:\s*\[staffId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/)
      expect(schemaContent).toMatch(/model DailyRecord[\s\S]*?staff\s+Staff\s+@relation\(fields:\s*\[staffId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/)
      expect(schemaContent).toMatch(/model StaffPayrollInfo[\s\S]*?staff\s+Staff\s+@relation\(fields:\s*\[staffId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/)
      expect(schemaContent).toMatch(/model MonthlyPayroll[\s\S]*?staff\s+Staff\s+@relation\(fields:\s*\[staffId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/)
      expect(schemaContent).toMatch(/model ShiftAssignment[\s\S]*?staff\s+Staff\s+@relation\(fields:\s*\[staffId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/)
      expect(schemaContent).toMatch(/model ShiftSuggestion[\s\S]*?staff\s+Staff\s+@relation\(fields:\s*\[staffId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/)
      expect(schemaContent).toMatch(/model PunchPhoto[\s\S]*?staff\s+Staff\s+@relation\("PunchPhotoOwner",\s*fields:\s*\[staffId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/)
    })
  })

  describe('StaffPayrollInfo and MonthlyPayroll additions', () => {
    it('adds payGroup and payGroupChanges to StaffPayrollInfo', () => {
      const payrollInfo = getModel('StaffPayrollInfo')
      expect(payrollInfo).toBeDefined()

      const fieldNames = payrollInfo!.fields.map((f) => f.name)
      expect(fieldNames).toContain('payGroup')
      expect(fieldNames).toContain('payGroupChanges')
      expect(fieldNames).toEqual(
        expect.arrayContaining(['epfoKycExportedAt', 'epfoKycExportedHash'])
      )

      const payGroupField = payrollInfo!.fields.find((f) => f.name === 'payGroup')
      expect(payGroupField?.default).toBe('BANK_EPF')
    })

    it('adds payGroup to MonthlyPayroll', () => {
      const monthlyPayroll = getModel('MonthlyPayroll')
      expect(monthlyPayroll).toBeDefined()

      const fieldNames = monthlyPayroll!.fields.map((f) => f.name)
      expect(fieldNames).toContain('payGroup')

      const payGroupField = monthlyPayroll!.fields.find((f) => f.name === 'payGroup')
      expect(payGroupField?.default).toBe('BANK_EPF')
    })
  })

  describe('New models', () => {
    it('defines EmploymentPeriod', () => {
      const model = getModel('EmploymentPeriod')
      expect(model).toBeDefined()

      const fieldNames = model!.fields.map((f) => f.name)
      expect(fieldNames).toEqual(
        expect.arrayContaining([
          'id',
          'staffId',
          'startDate',
          'endDate',
          'exitReason',
          'notes',
          'createdByUserId',
          'createdAt',
          'updatedAt',
          'staff',
          'epfoJoinExportedAt',
          'epfoExitExportedAt',
          'epfoExitCode',
        ])
      )
    })

    it('defines ApproverDepartment', () => {
      const model = getModel('ApproverDepartment')
      expect(model).toBeDefined()

      const fieldNames = model!.fields.map((f) => f.name)
      expect(fieldNames).toEqual(
        expect.arrayContaining(['id', 'userId', 'departmentId', 'createdAt', 'user', 'department'])
      )

      const deptModel = getModel('Department')
      expect(deptModel?.fields.map((f) => f.name)).toContain('approverDepartments')
    })

    it('defines PayGroupChange', () => {
      const model = getModel('PayGroupChange')
      expect(model).toBeDefined()

      const fieldNames = model!.fields.map((f) => f.name)
      expect(fieldNames).toEqual(
        expect.arrayContaining([
          'id',
          'staffPayrollInfoId',
          'payGroup',
          'effectiveFromMonth',
          'createdByUserId',
          'createdAt',
          'staffPayrollInfo',
        ])
      )
    })

    it('defines UnmatchedPunch', () => {
      const model = getModel('UnmatchedPunch')
      expect(model).toBeDefined()

      const fieldNames = model!.fields.map((f) => f.name)
      expect(fieldNames).toEqual(
        expect.arrayContaining([
          'id',
          'machineId',
          'timestamp',
          'type',
          'receivedAt',
          'reason',
          'resolvedAt',
          'resolvedByUserId',
          'resolution',
          'attachedStaffId',
        ])
      )
    })

    it('defines AuditLog', () => {
      const model = getModel('AuditLog')
      expect(model).toBeDefined()

      const fieldNames = model!.fields.map((f) => f.name)
      expect(fieldNames).toEqual(
        expect.arrayContaining(['id', 'at', 'actorUserId', 'action', 'targetType', 'targetId', 'details'])
      )
    })

    it('defines SystemSetting', () => {
      const model = getModel('SystemSetting')
      expect(model).toBeDefined()

      const fieldNames = model!.fields.map((f) => f.name)
      expect(fieldNames).toEqual(
        expect.arrayContaining(['id', 'key', 'value', 'createdAt', 'updatedAt'])
      )

      const keyField = model!.fields.find((f) => f.name === 'key')
      expect(keyField?.isUnique).toBe(true)
    })

    it('defines PunchRequest model and Staff.punchRequests relation', () => {
      const model = getModel('PunchRequest')
      expect(model).toBeDefined()

      const fieldNames = model!.fields.map((f) => f.name)
      expect(fieldNames).toEqual(
        expect.arrayContaining([
          'id',
          'staffId',
          'date',
          'punchType',
          'requestedTime',
          'requestedInTime',
          'requestedOutTime',
          'reason',
          'explanation',
          'status',
          'decidedByUserId',
          'decidedAt',
          'decisionRemarks',
          'createdAt',
          'updatedAt',
          'staff',
        ])
      )

      const statusField = model!.fields.find((f) => f.name === 'status')
      expect(statusField?.default).toBe('PENDING')

      const staff = getModel('Staff')
      expect(staff?.fields.map((f) => f.name)).toContain('punchRequests')

      expect(schemaContent).toMatch(
        /model PunchRequest[\s\S]*?staff\s+Staff\s+@relation\(fields:\s*\[staffId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/
      )
    })
  })

  describe('fakePrisma punchRequest fixtures and operations', () => {
    it('supports punchRequest findMany, findUnique, create, update, and count in fakePrisma', async () => {
      const { client, punchRequests } = createFakePrisma({
        staff: [{ id: 's1', name: 'John Doe', shiftId: null, shift: null }],
        policy: null,
        holidays: [],
        lockedPayrolls: [],
        logs: [],
        punchRequests: [
          {
            id: 'pr-1',
            staffId: 's1',
            date: '2026-11-01',
            punchType: 'IN',
            requestedTime: '09:00',
            reason: 'FORGOT_SWIPE',
            status: 'PENDING',
          },
        ],
      })

      const prisma = client as any

      // findMany
      const all = await prisma.punchRequest.findMany()
      expect(all).toHaveLength(1)
      expect(all[0].id).toBe('pr-1')

      // findUnique
      const one = await prisma.punchRequest.findUnique({ where: { id: 'pr-1' } })
      expect(one?.id).toBe('pr-1')

      // create
      const created = await prisma.punchRequest.create({
        data: {
          staffId: 's1',
          date: '2026-11-02',
          punchType: 'OUT',
          requestedTime: '17:00',
          reason: 'DUTY_OUTSIDE',
        },
      })
      expect(created.id).toBeDefined()
      expect(created.status).toBe('PENDING')
      expect(punchRequests).toHaveLength(2)

      // update
      const updated = await prisma.punchRequest.update({
        where: { id: 'pr-1' },
        data: { status: 'APPROVED', decidedByUserId: 'u1' },
      })
      expect(updated.status).toBe('APPROVED')
      expect(updated.decidedByUserId).toBe('u1')

      // count
      const pendingCount = await prisma.punchRequest.count({ where: { status: 'PENDING' } })
      expect(pendingCount).toBe(1)
    })
  })

})

