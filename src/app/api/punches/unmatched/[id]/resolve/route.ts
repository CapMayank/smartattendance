import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { startOfDay, endOfDay } from 'date-fns';
import { recalculateAttendance } from '@/lib/attendance';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN']);
    if (auth.errorResponse) return auth.errorResponse;

    const { id } = await params;
    const punch = await prisma.unmatchedPunch.findUnique({
      where: { id },
    });

    if (!punch) {
      return NextResponse.json({ error: 'Unmatched punch not found' }, { status: 404 });
    }

    if (punch.resolvedAt) {
      return NextResponse.json({ error: 'Punch already resolved' }, { status: 400 });
    }

    const body = await req.json();
    const { action, staffId } = body || {};

    if (action !== 'ATTACH' && action !== 'DISMISS') {
      return NextResponse.json({ error: 'Invalid action. Must be ATTACH or DISMISS' }, { status: 400 });
    }

    if (action === 'DISMISS') {
      await prisma.$transaction(async (tx: any) => {
        await tx.unmatchedPunch.update({
          where: { id },
          data: {
            resolvedAt: new Date(),
            resolvedByUserId: auth.user.id,
            resolution: 'DISMISSED',
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: auth.user.id,
            action: 'UNMATCHED_PUNCH_DISMISSED',
            targetType: 'UnmatchedPunch',
            targetId: id,
          },
        });
      });

      return NextResponse.json({ success: true });
    }

    if (action === 'ATTACH') {
      const targetStaffId = staffId || punch.attachedStaffId;
      if (!targetStaffId) {
        return NextResponse.json({ error: 'staffId is required to attach punch' }, { status: 400 });
      }

      const staff = await prisma.staff.findUnique({
        where: { id: targetStaffId },
      });

      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.attendanceLog.create({
          data: {
            staffId: staff.id,
            timestamp: punch.timestamp,
            type: punch.type,
          },
        });

        await tx.unmatchedPunch.update({
          where: { id },
          data: {
            resolvedAt: new Date(),
            resolvedByUserId: auth.user.id,
            resolution: 'ATTACHED',
            attachedStaffId: staff.id,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: auth.user.id,
            action: 'UNMATCHED_PUNCH_ATTACHED',
            targetType: 'UnmatchedPunch',
            targetId: id,
            details: JSON.stringify({ staffId: staff.id }),
          },
        });
      });

      // Trigger recalculation for punch date outside transaction so the committed AttendanceLog is read
      await recalculateAttendance(startOfDay(punch.timestamp), endOfDay(punch.timestamp));

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('POST Resolve Punch Error:', error);
    return NextResponse.json({ error: 'Failed to resolve punch' }, { status: 500 });
  }
}
