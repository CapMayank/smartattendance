import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  monthlyPayroll: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getServerSession } from "next-auth/next";
import { GET } from "./route";

const session = vi.mocked(getServerSession);

describe("GET /api/payroll/export/[type]", () => {
  const bankStaff = {
    id: "p1",
    payGroup: "BANK_EPF",
    grossWage: 20000,
    epfWages: 20000,
    epsWages: 20000,
    edliWages: 20000,
    employeeEpf: 2400,
    employerEps: 1666,
    employerEpf: 734,
    netPayment: 17600,
    ncpDays: 0,
    refundOfAdvance: 0,
    staff: {
      machineId: "001",
      name: "Bank Staff",
      payrollInfo: {
        payGroup: "BANK_EPF",
        nameAsPerBank: "Bank Staff",
        bankAccount: "123456789",
        uan: "100000000001",
        nameOnUan: "Bank Staff",
      },
    },
  };

  const cashStaff = {
    id: "p2",
    payGroup: "CASH",
    grossWage: 15000,
    epfWages: 0,
    epsWages: 0,
    edliWages: 0,
    employeeEpf: 0,
    employerEps: 0,
    employerEpf: 0,
    netPayment: 15000,
    ncpDays: 0,
    refundOfAdvance: 0,
    staff: {
      machineId: "002",
      name: "Cash Staff",
      payrollInfo: {
        payGroup: "CASH",
        nameAsPerBank: "Cash Staff",
        bankAccount: "",
        uan: "",
        nameOnUan: "",
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ id: "u1", name: "Admin", role: "ADMIN", disabledAt: null, mustChangePassword: false, staff: null, approverDepartments: [] });
    session.mockResolvedValue({ user: { id: "u1" } } as never);
    mockPrisma.monthlyPayroll.findMany.mockResolvedValue([bankStaff, cashStaff]);
  });

  it("returns 401 if unauthenticated", async () => {
    session.mockResolvedValue(null);
    const req = new Request("http://localhost/api/payroll/export/bank-payment?month=11&year=2026");
    const res = await GET(req, { params: Promise.resolve({ type: "bank-payment" }) });
    expect(res.status).toBe(401);
  });

  it("ecr-text export excludes CASH payGroup staff", async () => {
    const req = new Request("http://localhost/api/payroll/export/ecr-text?month=11&year=2026");
    const res = await GET(req, { params: Promise.resolve({ type: "ecr-text" }) });
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain("Bank Staff");
    expect(text).not.toContain("Cash Staff");
  });

  it("bank-payment export returns Excel and filters out CASH records", async () => {
    const req = new Request("http://localhost/api/payroll/export/bank-payment?month=11&year=2026");
    const res = await GET(req, { params: Promise.resolve({ type: "bank-payment" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toContain("Bank_Payment_NOVEMBER_2026.xlsx");
  });

  it("ecr-final export returns Excel and filters out CASH records", async () => {
    const req = new Request("http://localhost/api/payroll/export/ecr-final?month=11&year=2026");
    const res = await GET(req, { params: Promise.resolve({ type: "ecr-final" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toContain("ECR_Final_NOVEMBER_2026.xlsx");
  });

  it("bulk-reg export excludes CASH payGroup staff", async () => {
    const req = new Request("http://localhost/api/payroll/export/bulk-reg?month=11&year=2026");
    const res = await GET(req, { params: Promise.resolve({ type: "bulk-reg" }) });
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain("Bank Staff");
    expect(text).not.toContain("Cash Staff");
  });

  it("cash-payment export generates cash sheet for CASH payGroup staff", async () => {
    const req = new Request("http://localhost/api/payroll/export/cash-payment?month=11&year=2026");
    const res = await GET(req, { params: Promise.resolve({ type: "cash-payment" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toContain("Cash_Payment_NOVEMBER_2026.xlsx");
  });
});
