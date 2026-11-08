import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { istDateKey } from '@/lib/dashboard-calc';
import { formatEmployeeCode, parseEmployeeCode } from '@/lib/employee-code';
import { generateTemporaryPassword } from '@/lib/temporary-password';
import bcrypt from 'bcryptjs';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateKey(val: unknown): val is string {
  if (typeof val !== 'string' || !DATE_REGEX.test(val)) return false;
  const d = new Date(`${val}T00:00:00Z`);
  return !isNaN(d.getTime());
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const auth = await requireRole(session, ['ADMIN']);
  if (auth.errorResponse) return auth.errorResponse;

  try {
    const { id } = await params;
    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        employmentPeriods: { orderBy: { startDate: 'desc' } },
        user: true,
      },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    const body = await request.json();
    const action = body?.action;

    if (action === 'EXIT') {
      const { lastWorkingDay, exitReason, notes } = body;

      if (!isValidDateKey(lastWorkingDay)) {
        return NextResponse.json(
          { error: 'lastWorkingDay must be a valid YYYY-MM-DD date' },
          { status: 400 }
        );
      }

      if (!exitReason || typeof exitReason !== 'string' || exitReason.trim() === '') {
        return NextResponse.json(
          { error: 'exitReason is required' },
          { status: 400 }
        );
      }

      const activePeriod = staff.employmentPeriods.find((p) => p.endDate === null);
      if (!activePeriod) {
        return NextResponse.json(
          { error: 'Staff has no active employment period' },
          { status: 400 }
        );
      }

      if (lastWorkingDay < activePeriod.startDate) {
        return NextResponse.json(
          { error: 'lastWorkingDay cannot be before joining date' },
          { status: 400 }
        );
      }

      const todayKey = istDateKey(new Date());

      const period = await prisma.$transaction(async (tx) => {
        const updatedPeriod = await tx.employmentPeriod.update({
          where: { id: activePeriod.id },
          data: {
            endDate: lastWorkingDay,
            exitReason: exitReason.trim(),
            notes: notes ? String(notes).trim() : null,
          },
        });

        if (lastWorkingDay <= todayKey && staff.user) {
          await tx.user.update({
            where: { id: staff.user.id },
            data: { disabledAt: new Date() },
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId: auth.user.id,
            action: 'STAFF_EXIT',
            targetType: 'Staff',
            targetId: staff.id,
            details: JSON.stringify({
              periodId: activePeriod.id,
              lastWorkingDay,
              exitReason: exitReason.trim(),
              notes: notes || null,
            }),
          },
        });

        return updatedPeriod;
      });

      return NextResponse.json({ success: true, period });
    }

    if (action === 'REJOIN') {
      const { joiningDate, departmentId, designationId, shiftId, payGroup } = body;

      if (!isValidDateKey(joiningDate)) {
        return NextResponse.json(
          { error: 'joiningDate must be a valid YYYY-MM-DD date' },
          { status: 400 }
        );
      }

      const activePeriod = staff.employmentPeriods.find((p) => p.endDate === null);
      if (activePeriod) {
        return NextResponse.json(
          { error: 'Staff already has an active employment period' },
          { status: 400 }
        );
      }

      const lastPeriod = staff.employmentPeriods[0];
      if (lastPeriod?.endDate && joiningDate <= lastPeriod.endDate) {
        return NextResponse.json(
          { error: 'joiningDate must be strictly after the previous employment period end date' },
          { status: 400 }
        );
      }

      if (shiftId) {
        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift) {
          return NextResponse.json({ error: 'Shift not found' }, { status: 400 });
        }
      }

      const tempPassword = generateTemporaryPassword(10);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const result = await prisma.$transaction(async (tx) => {
        const newPeriod = await tx.employmentPeriod.create({
          data: {
            staffId: staff.id,
            startDate: joiningDate,
            endDate: null,
            createdByUserId: auth.user.id,
          },
        });

        const staffUpdateData: Record<string, unknown> = {};
        if (departmentId !== undefined) staffUpdateData.departmentId = departmentId || null;
        if (designationId !== undefined) staffUpdateData.designationId = designationId || null;
        if (shiftId !== undefined) staffUpdateData.shiftId = shiftId || null;

        const updatedStaff = Object.keys(staffUpdateData).length > 0
          ? await tx.staff.update({
              where: { id: staff.id },
              data: staffUpdateData,
            })
          : staff;

        if (shiftId) {
          await tx.shiftAssignment.upsert({
            where: {
              staffId_effectiveFrom: {
                staffId: staff.id,
                effectiveFrom: joiningDate,
              },
            },
            update: {
              shiftId,
              source: 'REJOIN',
              createdByUserId: auth.user.id,
            },
            create: {
              staffId: staff.id,
              shiftId,
              effectiveFrom: joiningDate,
              source: 'REJOIN',
              createdByUserId: auth.user.id,
            },
          });
        }

        if (payGroup) {
          await tx.staffPayrollInfo.upsert({
            where: { staffId: staff.id },
            update: { payGroup },
            create: { staffId: staff.id, payGroup },
          });
        }

        if (staff.user) {
          await tx.user.update({
            where: { id: staff.user.id },
            data: {
              disabledAt: null,
              password: hashedPassword,
              mustChangePassword: true,
            },
          });
        } else {
          await tx.user.create({
            data: {
              name: staff.name,
              role: 'EMPLOYEE',
              password: hashedPassword,
              mustChangePassword: true,
              staffId: staff.id,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId: auth.user.id,
            action: 'STAFF_REJOIN',
            targetType: 'Staff',
            targetId: staff.id,
            details: JSON.stringify({
              periodId: newPeriod.id,
              joiningDate,
              departmentId,
              designationId,
              shiftId,
              payGroup,
            }),
          },
        });

        return { staff: updatedStaff, period: newPeriod };
      });

      return NextResponse.json({
        success: true,
        staff: result.staff,
        period: result.period,
        employeeCode: staff.employeeCode,
        temporaryPassword: tempPassword,
      });
    }

    if (action === 'RESET_PASSWORD') {
      const requestedJoiningDate = isValidDateKey(body?.joiningDate)
        ? body.joiningDate
        : staff.joiningDate || istDateKey(new Date());

      const tempPassword = generateTemporaryPassword(10);
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const employeeCode = await prisma.$transaction(async (tx: any) => {
        let code = staff.employeeCode;
        const jDate = staff.joiningDate || requestedJoiningDate;

        if (!code) {
          const year = parseInt(jDate.slice(0, 4), 10);
          const staffInYear = await tx.staff.findMany({
            where: { employeeCode: { startsWith: `SAR-${year}-` } },
            select: { employeeCode: true },
          });

          let maxSeq = 0;
          for (const s of staffInYear) {
            if (!s.employeeCode) continue;
            const parsed = parseEmployeeCode(s.employeeCode);
            if (parsed && parsed.year === year && parsed.sequence > maxSeq) {
              maxSeq = parsed.sequence;
            }
          }
          code = formatEmployeeCode(year, maxSeq + 1);
        }

        if (code !== staff.employeeCode || jDate !== staff.joiningDate) {
          await tx.staff.update({
            where: { id: staff.id },
            data: {
              employeeCode: code,
              joiningDate: jDate,
            },
          });
        }

        if (!staff.employmentPeriods || staff.employmentPeriods.length === 0) {
          await tx.employmentPeriod.create({
            data: {
              staffId: staff.id,
              startDate: jDate,
              endDate: null,
              createdByUserId: auth.user.id,
            },
          });
        }

        if (staff.user) {
          await tx.user.update({
            where: { id: staff.user.id },
            data: {
              password: hashedPassword,
              mustChangePassword: true,
              disabledAt: null,
            },
          });
        } else {
          await tx.user.create({
            data: {
              name: staff.name,
              role: 'EMPLOYEE',
              password: hashedPassword,
              mustChangePassword: true,
              staffId: staff.id,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId: auth.user.id,
            action: 'PASSWORD_RESET',
            targetType: 'Staff',
            targetId: staff.id,
            details: JSON.stringify({
              employeeCode: code,
              resetAt: new Date().toISOString(),
            }),
          },
        });

        return code;
      });

      return NextResponse.json({
        success: true,
        employeeCode,
        temporaryPassword: tempPassword,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Supported actions: EXIT, REJOIN, RESET_PASSWORD' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Staff Lifecycle Error:', error);
    return NextResponse.json({ error: 'Failed to process staff lifecycle transition' }, { status: 500 });
  }
}
