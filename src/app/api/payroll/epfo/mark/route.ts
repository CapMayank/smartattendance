import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import { computeKycHash } from '@/lib/epfo/kyc-hash';
import { getLatestEmploymentPeriod } from '@/lib/epfo/next-action';
import type { EpfoMemberInput } from '@/lib/epfo/types';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const auth = await requireRole(session, ['ADMIN']);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  let body: {
    staffIds?: string[];
    mode?: 'MARK_FILED' | 'RESET_PENDING';
    target?: 'REG' | 'EXIT' | 'KYC';
  } = {};

  try {
    body = await req.json();
  } catch {
    return new NextResponse('Invalid JSON body', { status: 400 });
  }

  const { staffIds, mode, target } = body;

  if (!Array.isArray(staffIds) || staffIds.length === 0) {
    return NextResponse.json({ error: 'staffIds required' }, { status: 400 });
  }

  if (mode !== 'MARK_FILED' && mode !== 'RESET_PENDING') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  if (target !== 'REG' && target !== 'EXIT' && target !== 'KYC') {
    return NextResponse.json({ error: 'Invalid target' }, { status: 400 });
  }

  const staffList = (await prisma.staff.findMany({
    where: { id: { in: staffIds } },
    include: {
      payrollInfo: true,
      employmentPeriods: {
        orderBy: { startDate: 'desc' },
      },
    },
  })) as unknown as EpfoMemberInput[];

  const now = new Date();
  let updatedCount = 0;

  await prisma.$transaction(async (tx: any) => {
    for (const member of staffList) {
      const period = getLatestEmploymentPeriod(member);

      if (target === 'REG') {
        if (period) {
          await tx.employmentPeriod.update({
            where: { id: period.id },
            data: {
              epfoJoinExportedAt: mode === 'MARK_FILED' ? now : null,
            },
          });
          updatedCount++;
        }
      } else if (target === 'EXIT') {
        if (period) {
          await tx.employmentPeriod.update({
            where: { id: period.id },
            data: {
              epfoExitExportedAt: mode === 'MARK_FILED' ? now : null,
              epfoExitCode: mode === 'MARK_FILED' ? period.epfoExitCode : null,
            },
          });
          updatedCount++;
        }
      } else if (target === 'KYC') {
        if (member.payrollInfo) {
          const hash = mode === 'MARK_FILED' ? computeKycHash(member.payrollInfo) : null;
          await tx.staffPayrollInfo.update({
            where: { staffId: member.id },
            data: {
              epfoKycExportedAt: mode === 'MARK_FILED' ? now : null,
              epfoKycExportedHash: hash,
            },
          });
          updatedCount++;
        }
      }
    }

    await tx.auditLog.create({
      data: {
        action: mode === 'MARK_FILED' ? 'EPFO_MARK_FILED' : 'EPFO_RESET_PENDING',
        targetType: 'EPFO',
        details: JSON.stringify({
          target,
          mode,
          staffIds,
          updatedCount,
        }),
      },
    });
  });

  return NextResponse.json({ updatedCount });
}
