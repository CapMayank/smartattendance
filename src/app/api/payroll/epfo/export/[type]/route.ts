import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { format } from 'date-fns';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import {
  buildExitFile,
  buildKycFile,
  buildRegistrationFile,
} from '@/lib/epfo/formats';
import { computeKycHash } from '@/lib/epfo/kyc-hash';
import { defaultExitReasonCode } from '@/lib/epfo/mappings';
import { getLatestEmploymentPeriod } from '@/lib/epfo/next-action';
import type { EpfoDocType, EpfoExitReasonCode, EpfoMemberInput } from '@/lib/epfo/types';
import { validateForExit, validateForRegistration } from '@/lib/epfo/validation';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await requireRole(session, ['ADMIN']);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const { type } = await params;
  if (!['reg', 'exit', 'kyc'].includes(type)) {
    return new NextResponse('Invalid export type', { status: 400 });
  }

  let body: {
    staffIds?: string[];
    exitCodes?: Record<string, EpfoExitReasonCode>;
    docTypes?: EpfoDocType[];
  } = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse('Invalid JSON body', { status: 400 });
  }

  const staffIds = Array.isArray(body.staffIds) ? body.staffIds : [];
  if (staffIds.length === 0) {
    return NextResponse.json({ error: 'No staff selected' }, { status: 400 });
  }

  const staffList = (await prisma.staff.findMany({
    where: {
      id: { in: staffIds },
    },
    include: {
      department: true,
      designation: true,
      payrollInfo: {
        include: {
          payGroupChanges: true,
        },
      },
      employmentPeriods: {
        orderBy: {
          startDate: 'desc',
        },
      },
    },
  })) as unknown as EpfoMemberInput[];

  const now = new Date();
  const timestamp = format(now, 'yyyyMMdd_HHmm');

  if (type === 'reg') {
    const validMembers: EpfoMemberInput[] = [];
    const skipped: Array<{ staffId: string; staffName: string; errors: string[] }> = [];

    for (const member of staffList) {
      const res = validateForRegistration(member);
      if (res.ready) {
        validMembers.push(member);
      } else {
        skipped.push({
          staffId: member.id,
          staffName: member.name,
          errors: res.errors.map((e) => e.field),
        });
      }
    }

    if (validMembers.length === 0) {
      return NextResponse.json(
        { error: 'No valid members to export', skipped },
        { status: 422 }
      );
    }

    const content = buildRegistrationFile(validMembers);
    const exportedStaffIds = validMembers.map((m) => m.id);

    await prisma.$transaction(async (tx: any) => {
      for (const member of validMembers) {
        const period = getLatestEmploymentPeriod(member);
        if (period) {
          await tx.employmentPeriod.update({
            where: { id: period.id },
            data: { epfoJoinExportedAt: now },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: 'EPFO_EXPORT_REG',
          targetType: 'EPFO',
          details: JSON.stringify({
            type: 'reg',
            exportedStaffIds,
            skipped,
          }),
        },
      });
    });

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="EPFO_REG_${timestamp}.txt"`,
        'Content-Type': 'text/plain',
        'X-Epfo-Summary': JSON.stringify({
          exportedCount: validMembers.length,
          skippedCount: skipped.length,
        }),
      },
    });
  }

  if (type === 'exit') {
    const validItems: Array<{ member: EpfoMemberInput; reasonCode?: EpfoExitReasonCode }> = [];
    const skipped: Array<{ staffId: string; staffName: string; errors: string[] }> = [];

    for (const member of staffList) {
      const res = validateForExit(member);
      if (res.ready) {
        validItems.push({
          member,
          reasonCode: body.exitCodes?.[member.id],
        });
      } else {
        skipped.push({
          staffId: member.id,
          staffName: member.name,
          errors: res.errors.map((e) => e.field),
        });
      }
    }

    if (validItems.length === 0) {
      return NextResponse.json(
        { error: 'No valid members to export', skipped },
        { status: 422 }
      );
    }

    const content = buildExitFile(validItems);
    const exportedStaffIds = validItems.map((item) => item.member.id);

    await prisma.$transaction(async (tx: any) => {
      for (const item of validItems) {
        const period = getLatestEmploymentPeriod(item.member);
        if (period) {
          const finalReasonCode =
            item.reasonCode ||
            defaultExitReasonCode(
              period.exitReason,
              item.member.payrollInfo?.dob,
              period.endDate
            );
          await tx.employmentPeriod.update({
            where: { id: period.id },
            data: {
              epfoExitExportedAt: now,
              epfoExitCode: finalReasonCode,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: 'EPFO_EXPORT_EXIT',
          targetType: 'EPFO',
          details: JSON.stringify({
            type: 'exit',
            exportedStaffIds,
            skipped,
          }),
        },
      });
    });

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="EPFO_EXIT_${timestamp}.txt"`,
        'Content-Type': 'text/plain',
        'X-Epfo-Summary': JSON.stringify({
          exportedCount: validItems.length,
          skippedCount: skipped.length,
        }),
      },
    });
  }

  if (type === 'kyc') {
    const docTypes = body.docTypes || ['B', 'P', 'A'];
    const kycResult = buildKycFile(staffList, docTypes);

    if (kycResult.exportedStaffIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid KYC records to export', skipped: kycResult.skipped },
        { status: 422 }
      );
    }

    await prisma.$transaction(async (tx: any) => {
      for (const id of kycResult.exportedStaffIds) {
        const member = staffList.find((m) => m.id === id);
        if (member?.payrollInfo) {
          const hash = computeKycHash(member.payrollInfo);
          await tx.staffPayrollInfo.update({
            where: { staffId: id },
            data: {
              epfoKycExportedAt: now,
              epfoKycExportedHash: hash,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          action: 'EPFO_EXPORT_KYC',
          targetType: 'EPFO',
          details: JSON.stringify({
            type: 'kyc',
            exportedStaffIds: kycResult.exportedStaffIds,
            skippedCount: kycResult.skipped.length,
          }),
        },
      });
    });

    return new NextResponse(kycResult.content, {
      status: 200,
      headers: {
        'Content-Disposition': `attachment; filename="EPFO_KYC_${timestamp}.txt"`,
        'Content-Type': 'text/plain',
        'X-Epfo-Summary': JSON.stringify({
          exportedCount: kycResult.exportedStaffIds.length,
          skippedCount: kycResult.skipped.length,
        }),
      },
    });
  }

  return new NextResponse('Unsupported export type', { status: 400 });
}
