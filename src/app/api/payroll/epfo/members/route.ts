import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/rbac';
import { defaultExitReasonCode, parseIsoDateKey } from '@/lib/epfo/mappings';
import { getEpfoNextAction, getLatestEmploymentPeriod } from '@/lib/epfo/next-action';
import type { EpfoNextAction } from '@/lib/epfo/types';
import { validateForNextAction } from '@/lib/epfo/validation';

export async function GET() {
  const session = await getServerSession(authOptions);
  const auth = await requireRole(session, ['ADMIN']);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  const staffList = await prisma.staff.findMany({
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
    orderBy: {
      name: 'asc',
    },
  });

  const counts: Record<EpfoNextAction, number> = {
    NEEDS_REGISTRATION: 0,
    AWAITING_UAN: 0,
    NEEDS_EXIT: 0,
    NEEDS_KYC: 0,
    UP_TO_DATE: 0,
    HIDDEN: 0,
  };

  const membersWithLockedStatus = await Promise.all(
    staffList.map(async (staffMember) => {
      const nextAction = getEpfoNextAction(staffMember as any);
      counts[nextAction] = (counts[nextAction] || 0) + 1;

      if (nextAction === 'HIDDEN') {
        return null;
      }

      const readiness = validateForNextAction(staffMember as any, nextAction);
      const latestPeriod = getLatestEmploymentPeriod(staffMember as any);

      let defaultExitCode = null;
      let exitMonthPayrollLocked = false;

      if (latestPeriod?.endDate) {
        defaultExitCode = defaultExitReasonCode(
          latestPeriod.exitReason,
          staffMember.payrollInfo?.dob,
          latestPeriod.endDate
        );

        if (nextAction === 'NEEDS_EXIT') {
          const iso = parseIsoDateKey(latestPeriod.endDate);
          if (iso) {
            const [yStr, mStr] = iso.split('-');
            const year = Number(yStr);
            const month = Number(mStr);
            const payroll = await prisma.monthlyPayroll.findFirst({
              where: {
                staffId: staffMember.id,
                month,
                year,
              },
            });
            exitMonthPayrollLocked = Boolean(payroll?.isLocked);
          }
        }
      }

      return {
        id: staffMember.id,
        machineId: staffMember.machineId,
        employeeCode: staffMember.employeeCode,
        name: staffMember.name,
        department: staffMember.department ? { name: staffMember.department.name } : null,
        designation: staffMember.designation ? { name: staffMember.designation.name } : null,
        joiningDate: staffMember.joiningDate,
        payrollInfo: staffMember.payrollInfo,
        employmentPeriods: staffMember.employmentPeriods,
        nextAction,
        readiness,
        defaultExitCode,
        exitMonthPayrollLocked,
      };
    })
  );

  const members = membersWithLockedStatus.filter((m) => m !== null);

  return NextResponse.json({ members, counts });
}
