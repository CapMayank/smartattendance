import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  staff: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  employmentPeriod: {
    update: vi.fn(),
  },
  staffPayrollInfo: {
    update: vi.fn(),
  },
  monthlyPayroll: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callbacksOrArray: any) => {
    if (Array.isArray(callbacksOrArray)) {
      return Promise.all(callbacksOrArray);
    }
    return callbacksOrArray(mockPrisma);
  }),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}));

vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

import { getServerSession } from 'next-auth/next';
import { GET as getMembers } from './members/route';
import { POST as exportFile } from './export/[type]/route';
import { POST as markStaff } from './mark/route';

const sessionMock = vi.mocked(getServerSession);

const adminUser = {
  id: 'u-admin',
  role: 'ADMIN',
  disabledAt: null,
  mustChangePassword: false,
  staff: null,
  approverDepartments: [],
};

const employeeUser = {
  id: 'u-emp',
  role: 'EMPLOYEE',
  disabledAt: null,
  mustChangePassword: false,
  staff: null,
  approverDepartments: [],
};

const sampleMemberDb = {
  id: 's1',
  machineId: '101',
  employeeCode: 'EMP101',
  name: 'Ramesh Kumar',
  joiningDate: '2026-09-01',
  department: { name: 'Academics' },
  designation: { name: 'Teacher' },
  employmentPeriods: [
    {
      id: 'p1',
      startDate: '2026-09-01',
      endDate: null,
      exitReason: null,
      epfoJoinExportedAt: null,
      epfoExitExportedAt: null,
      epfoExitCode: null,
    },
  ],
  payrollInfo: {
    payGroup: 'BANK_EPF',
    monthlyCtc: 22400,
    dob: new Date('1990-05-15'),
    gender: 'Male',
    fatherHusbandName: 'Suresh Kumar',
    relationship: 'Father',
    mobileNumber: '9876543210',
    maritalStatus: 'Married',
    bankAccount: '123456789012',
    ifsc: 'SBIN0001234',
    nameAsPerBank: 'RAMESH KUMAR',
    pan: 'ABCDE1234F',
    nameOnPan: 'RAMESH KUMAR',
    aadhaar: '234567890123',
    nameOnAadhaar: 'RAMESH KUMAR',
    uan: '100234567890',
    nameOnUan: 'RAMESH KUMAR',
    epfoKycExportedAt: null,
    epfoKycExportedHash: null,
    payGroupChanges: [],
  },
};

describe('EPFO API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/payroll/epfo/members', () => {
    it('returns 403 for non-ADMIN', async () => {
      sessionMock.mockResolvedValueOnce({ user: { id: 'u-emp' } } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(employeeUser as any);

      const res = await getMembers();
      expect(res.status).toBe(403);
    });

    it('returns enriched members and counts for ADMIN', async () => {
      sessionMock.mockResolvedValueOnce({ user: { id: 'u-admin' } } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser as any);
      mockPrisma.staff.findMany.mockResolvedValueOnce([sampleMemberDb as any]);

      const res = await getMembers();
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.members).toHaveLength(1);
      expect(json.members[0].id).toBe('s1');
      expect(json.members[0].nextAction).toBe('NEEDS_REGISTRATION');
      expect(json.members[0].readiness.ready).toBe(true);
      expect(json.counts.NEEDS_REGISTRATION).toBe(1);
    });
  });

  describe('POST /api/payroll/epfo/export/[type]', () => {
    it('exports registration file, updates active period, and writes audit log without raw PII', async () => {
      sessionMock.mockResolvedValueOnce({ user: { id: 'u-admin' } } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser as any);
      mockPrisma.staff.findMany.mockResolvedValueOnce([sampleMemberDb as any]);

      const req = new Request('http://localhost/api/payroll/epfo/export/reg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffIds: ['s1'] }),
      });

      const res = await exportFile(req, { params: Promise.resolve({ type: 'reg' }) });
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Disposition')).toContain('EPFO_REG_');

      const text = await res.text();
      expect(text).toContain('100234567890#~#');
      expect(mockPrisma.employmentPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: expect.objectContaining({ epfoJoinExportedAt: expect.any(Date) }),
        })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'EPFO_EXPORT_REG',
            details: expect.not.stringContaining('234567890123'), // no Aadhaar
          }),
        })
      );
    });

    it('returns 422 if all selected members fail validation for exit export', async () => {
      sessionMock.mockResolvedValueOnce({ user: { id: 'u-admin' } } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser as any);
      // Member without exit date
      mockPrisma.staff.findMany.mockResolvedValueOnce([sampleMemberDb as any]);

      const req = new Request('http://localhost/api/payroll/epfo/export/exit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffIds: ['s1'] }),
      });

      const res = await exportFile(req, { params: Promise.resolve({ type: 'exit' }) });
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.skipped).toHaveLength(1);
    });

    it('updates epfoKycExportedAt only for members with valid KYC lines (Review Focus #5)', async () => {
      sessionMock.mockResolvedValueOnce({ user: { id: 'u-admin' } } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser as any);

      const validKycMember = { ...sampleMemberDb, id: 's-valid' };
      const invalidKycMember = {
        ...sampleMemberDb,
        id: 's-invalid',
        payrollInfo: {
          ...sampleMemberDb.payrollInfo,
          bankAccount: null,
          pan: null,
          aadhaar: '012345678901', // invalid
        },
      };

      mockPrisma.staff.findMany.mockResolvedValueOnce([validKycMember as any, invalidKycMember as any]);

      const req = new Request('http://localhost/api/payroll/epfo/export/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffIds: ['s-valid', 's-invalid'], docTypes: ['B', 'P', 'A'] }),
      });

      const res = await exportFile(req, { params: Promise.resolve({ type: 'kyc' }) });
      expect(res.status).toBe(200);

      expect(mockPrisma.staffPayrollInfo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { staffId: 's-valid' },
          data: expect.objectContaining({ epfoKycExportedAt: expect.any(Date) }),
        })
      );
      expect(mockPrisma.staffPayrollInfo.update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { staffId: 's-invalid' },
        })
      );
    });
  });

  describe('POST /api/payroll/epfo/mark', () => {
    it('marks staff as already filed and records audit log', async () => {
      sessionMock.mockResolvedValueOnce({ user: { id: 'u-admin' } } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser as any);
      mockPrisma.staff.findMany.mockResolvedValueOnce([sampleMemberDb as any]);

      const req = new Request('http://localhost/api/payroll/epfo/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffIds: ['s1'], mode: 'MARK_FILED', target: 'REG' }),
      });

      const res = await markStaff(req);
      expect(res.status).toBe(200);
      expect(mockPrisma.employmentPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: expect.objectContaining({ epfoJoinExportedAt: expect.any(Date) }),
        })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'EPFO_MARK_FILED' }),
        })
      );
    });

    it('resets exported tracking back to pending on undo', async () => {
      sessionMock.mockResolvedValueOnce({ user: { id: 'u-admin' } } as any);
      mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser as any);
      mockPrisma.staff.findMany.mockResolvedValueOnce([sampleMemberDb as any]);

      const req = new Request('http://localhost/api/payroll/epfo/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffIds: ['s1'], mode: 'RESET_PENDING', target: 'REG' }),
      });

      const res = await markStaff(req);
      expect(res.status).toBe(200);
      expect(mockPrisma.employmentPeriod.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1' },
          data: expect.objectContaining({ epfoJoinExportedAt: null }),
        })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'EPFO_RESET_PENDING' }),
        })
      );
    });
  });
});
