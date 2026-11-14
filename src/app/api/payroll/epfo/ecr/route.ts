import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import { isEcrRow, summarizeEcrMonths, type EcrPayrollRow } from '@/lib/epfo/summary';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const auth = await requireRole(session, ['ADMIN']);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get('month');
  const yearParam = searchParams.get('year');
  const wantsDetail = monthParam !== null || yearParam !== null;

  let month = 0;
  let year = 0;
  if (wantsDetail) {
    month = Number(monthParam);
    year = Number(yearParam);
    if (!Number.isInteger(month) || !Number.isInteger(year) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
    }
  }

  const rows = (await prisma.monthlyPayroll.findMany({
    ...(wantsDetail ? { where: { month, year } } : {}),
    include: { staff: { include: { payrollInfo: true } } },
  })) as any[];

  const toEcrRow = (p: any): EcrPayrollRow => ({
    month: p.month,
    year: p.year,
    isLocked: p.isLocked,
    payGroup: p.payGroup,
    staffPayGroup: p.staff?.payrollInfo?.payGroup ?? null,
    grossWage: p.grossWage,
    epfWages: p.epfWages,
    epsWages: p.epsWages,
    edliWages: p.edliWages,
    employeeEpf: p.employeeEpf,
    employerEps: p.employerEps,
    employerEpf: p.employerEpf,
    ncpDays: p.ncpDays,
  });

  const months = summarizeEcrMonths(rows.map(toEcrRow));

  if (!wantsDetail) {
    return NextResponse.json({ months });
  }

  const summary = months[0];
  if (!summary) {
    return NextResponse.json({ error: 'No ECR data for this month' }, { status: 404 });
  }

  const members = rows
    .filter((p) => isEcrRow(toEcrRow(p)))
    .map((p) => ({
      staffId: p.staffId as string,
      name: (p.staff?.payrollInfo?.nameOnUan || p.staff?.name || '') as string,
      uan: (p.staff?.payrollInfo?.uan || '') as string,
      epfWages: Math.round(p.epfWages),
      employeeEpf: Math.round(p.employeeEpf),
      ncpDays: p.ncpDays as number,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ month: summary, members });
}
