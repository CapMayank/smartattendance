import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import { getEpfoNextAction } from '@/lib/epfo/next-action';
import type { EpfoNextAction } from '@/lib/epfo/types';
import { validateForNextAction } from '@/lib/epfo/validation';
import {
  buildNeedsAttention,
  computeCompliancePercent,
  describeEpfoAction,
  summarizeEcrMonths,
  type EpfoCounts,
} from '@/lib/epfo/summary';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await requireRole(session, ['ADMIN']);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const [staffList, payrollRows, activity] = await Promise.all([
    prisma.staff.findMany({
      include: {
        payrollInfo: { include: { payGroupChanges: true } },
        employmentPeriods: { orderBy: { startDate: 'desc' } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.monthlyPayroll.findMany({
      include: { staff: { include: { payrollInfo: true } } },
    }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: 'EPFO_' } },
      orderBy: { at: 'desc' },
      take: 5,
    }),
  ]);

  const counts: EpfoCounts = {
    NEEDS_REGISTRATION: 0,
    AWAITING_UAN: 0,
    NEEDS_EXIT: 0,
    NEEDS_KYC: 0,
    UP_TO_DATE: 0,
    HIDDEN: 0,
  };

  const attentionInput = [];
  for (const s of staffList) {
    const nextAction: EpfoNextAction = getEpfoNextAction(s as any);
    counts[nextAction] += 1;
    if (nextAction === 'HIDDEN') continue;
    attentionInput.push({
      id: s.id,
      name: s.name,
      nextAction,
      readiness: validateForNextAction(s as any, nextAction),
      employmentPeriods: s.employmentPeriods as any,
    });
  }

  const months = summarizeEcrMonths(
    payrollRows.map((p: any) => ({
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
    }))
  );

  return NextResponse.json({
    counts,
    compliancePercent: computeCompliancePercent(counts),
    needsAttention: buildNeedsAttention(attentionInput, new Date()),
    latestEcr: months[0] ?? null,
    recentActivity: activity.map((a: any) => ({
      id: a.id,
      at: new Date(a.at).toISOString(),
      text: describeEpfoAction(a.action, a.details),
    })),
  });
}
