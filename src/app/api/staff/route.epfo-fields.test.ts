import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  staff: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  staffPayrollInfo: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((cb: any) => cb(mockPrisma)),
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
import { PUT } from './route';

const sessionMock = vi.mocked(getServerSession);

const adminUser = {
  id: 'u-admin',
  role: 'ADMIN',
  disabledAt: null,
  mustChangePassword: false,
  staff: null,
  approverDepartments: [],
};

describe('PUT /api/staff EPFO fields persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists maritalStatus, nameOnAadhaar, nameOnPan, nameOnUan, previousMemberId, and disability/international fields into prisma.staffPayrollInfo.upsert', async () => {
    sessionMock.mockResolvedValueOnce({ user: { id: 'u-admin' } } as any);
    mockPrisma.user.findUnique.mockResolvedValueOnce(adminUser as any);
    mockPrisma.staff.findUnique.mockResolvedValueOnce({
      id: 's1',
      name: 'Ramesh Kumar',
      departmentId: null,
      user: null,
      employmentPeriods: [{ id: 'p1', startDate: '2026-01-01', endDate: null }],
    } as any);
    mockPrisma.staff.update.mockResolvedValueOnce({ id: 's1' } as any);
    mockPrisma.staffPayrollInfo.findUnique.mockResolvedValueOnce({
      id: 'spi-1',
      staffId: 's1',
      payGroup: 'BANK_EPF',
    } as any);
    mockPrisma.staffPayrollInfo.upsert.mockResolvedValueOnce({
      id: 'spi-1',
      staffId: 's1',
    } as any);

    const payload = {
      id: 's1',
      name: 'Ramesh Kumar',
      maritalStatus: 'Married',
      nameOnAadhaar: 'RAMESH KUMAR',
      nameOnPan: 'RAMESH KUMAR',
      nameOnUan: 'RAMESH KUMAR',
      previousMemberId: 'MH/BAN/0012345/000/0000123',
      isInternationalWorker: 'Y',
      countryOfOrigin: 'NEPAL',
      passportNumber: 'Z1234567',
      passportValidFrom: '2020-01-01',
      passportValidTill: '2030-01-01',
      isPhysicalHandicap: 'Y',
      locomotive: 'Y',
      hearing: 'N',
      visual: 'N',
    };

    const req = new Request('http://localhost/api/staff', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.staffPayrollInfo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { staffId: 's1' },
        update: expect.objectContaining({
          maritalStatus: 'Married',
          nameOnAadhaar: 'RAMESH KUMAR',
          nameOnPan: 'RAMESH KUMAR',
          nameOnUan: 'RAMESH KUMAR',
          previousMemberId: 'MH/BAN/0012345/000/0000123',
          isInternationalWorker: 'Y',
          countryOfOrigin: 'NEPAL',
          passportNumber: 'Z1234567',
          isPhysicalHandicap: 'Y',
          locomotive: 'Y',
          hearing: 'N',
          visual: 'N',
        }),
      })
    );
  });
});
