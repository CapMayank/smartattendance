import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import fs from 'node:fs'
import path from 'node:path'

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
  })
})
