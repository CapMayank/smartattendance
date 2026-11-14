import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  staff: { findMany: vi.fn() },
  monthlyPayroll: { findMany: vi.fn() },
  auditLog: { create: vi.fn(), findMany: vi.fn() },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { getServerSession } from 'next-auth/next';
import { GET as getSummary } from './summary/route';
import { GET as getEcr } from './ecr/route';
import { GET as exportPayroll } from '../export/[type]/route';

const sessionMock = vi.mocked(getServerSession);
const base = { disabledAt: null, mustChangePassword: false, staff: null, approverDepartments: [] };
const admin = { id: 'u-admin', role: 'ADMIN', ...base };
const employee = { id: 'u-emp', role: 'EMPLOYEE', ...base };

const asAdmin = () => {
  sessionMock.mockResolvedValueOnce({ user: { id: 'u-admin' } } as any);
  mockPrisma.user.findUnique.mockResolvedValueOnce(admin as any);
};
const asEmployee = () => {
  sessionMock.mockResolvedValueOnce({ user: { id: 'u-emp' } } as any);
  mockPrisma.user.findUnique.mockResolvedValueOnce(employee as any);
};

const payroll = (o: any = {}) => ({
  month: 10, year: 2026, isLocked: true, payGroup: 'BANK_EPF',
  grossWage: 16800, epfWages: 15000, epsWages: 15000, edliWages: 15000,
  employeeEpf: 1800, employerEps: 1250, employerEpf: 550, ncpDays: 0, refundOfAdvance: 0, netPayment: 15000,
  staffId: 's1',
  staff: { id: 's1', name: 'Ramesh Kumar', machineId: '1', payrollInfo: { payGroup: 'BANK_EPF', uan: '100234567890', nameOnUan: 'RAMESH KUMAR' } },
  ...o,
});

const staffDb = {
  id: 's1', machineId: '101', employeeCode: 'E1', name: 'Ramesh Kumar', joiningDate: '2026-09-01',
  employmentPeriods: [{ id: 'p1', startDate: '2026-09-01', endDate: null, exitReason: null, epfoJoinExportedAt: null, epfoExitExportedAt: null, epfoExitCode: null }],
  payrollInfo: null,
};

describe('GET /api/payroll/epfo/summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.monthlyPayroll.findMany.mockResolvedValue([]);
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
  });

  it('returns 403 for non-admin', async () => {
    asEmployee();
    expect((await getSummary()).status).toBe(403);
  });

  it('returns counts, compliance, latest ECR and activity; tolerates null payrollInfo', async () => {
    asAdmin();
    mockPrisma.staff.findMany.mockResolvedValueOnce([staffDb]);
    mockPrisma.monthlyPayroll.findMany.mockResolvedValueOnce([payroll(), payroll({ month: 9 })]);
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([
      { id: 'a1', at: new Date('2026-11-14T10:00:00Z'), action: 'EPFO_EXPORT_REG', details: '{"exportedStaffIds":["s1"]}' },
    ]);

    const res = await getSummary();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.counts.NEEDS_REGISTRATION).toBe(1);
    expect(json.compliancePercent).toBe(0);
    expect(json.latestEcr.month).toBe(10);
    expect(json.recentActivity[0].text).toBe('Registration file exported · 1 member');
    expect(json.needsAttention[0].staffId).toBe('s1');
  });
});

describe('GET /api/payroll/epfo/ecr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  const req = (qs = '') => new Request(`http://localhost/api/payroll/epfo/ecr${qs}`);

  it('returns 403 for non-admin', async () => {
    asEmployee();
    expect((await getEcr(req())).status).toBe(403);
  });

  it('lists months and leaves out a cash-only month', async () => {
    asAdmin();
    mockPrisma.monthlyPayroll.findMany.mockResolvedValueOnce([
      payroll(),
      payroll({ month: 8, payGroup: 'CASH' }),
    ]);
    const json = await (await getEcr(req())).json();
    expect(json.months.map((m: any) => m.month)).toEqual([10]);
  });

  it('returns a month with its members', async () => {
    asAdmin();
    mockPrisma.monthlyPayroll.findMany.mockResolvedValueOnce([payroll()]);
    const res = await getEcr(req('?month=10&year=2026'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.month.members).toBe(1);
    expect(json.members[0]).toMatchObject({ staffId: 's1', name: 'RAMESH KUMAR', uan: '100234567890', epfWages: 15000, employeeEpf: 1800 });
  });

  it('rejects non-numeric month/year with 400 and unknown month with 404', async () => {
    asAdmin();
    expect((await getEcr(req('?month=abc&year=2026'))).status).toBe(400);
    asAdmin();
    mockPrisma.monthlyPayroll.findMany.mockResolvedValueOnce([]);
    expect((await getEcr(req('?month=1&year=2020'))).status).toBe(404);
  });
});

describe('ECR download audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs EPFO_ECR_DOWNLOAD when the ECR text file is downloaded', async () => {
    asAdmin();
    mockPrisma.monthlyPayroll.findMany.mockResolvedValueOnce([payroll()]);
    const res = await exportPayroll(
      new Request('http://localhost/api/payroll/export/ecr-text?month=10&year=2026'),
      { params: Promise.resolve({ type: 'ecr-text' }) }
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'EPFO_ECR_DOWNLOAD',
        details: JSON.stringify({ month: 10, year: 2026, format: 'text' }),
      }),
    });
  });
});
