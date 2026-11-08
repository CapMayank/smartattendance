import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { recalculateRange } from '@/lib/attendance-range'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { startDate, endDate } = await request.json().catch(() => ({}));

    // If no dates provided, calculate from the earliest log up to today
    let startD = startDate ? new Date(startDate) : null;
    let endD = endDate ? new Date(endDate) : new Date();

    if (!startD) {
      const earliestLog = await prisma.attendanceLog.findFirst({
        orderBy: { timestamp: 'asc' }
      });
      if (earliestLog) {
        startD = earliestLog.timestamp;
      } else {
        startD = new Date(); // Today
      }
    }

    const { days, records } = await recalculateRange({ startDate: startD, endDate: endD })

    return NextResponse.json({ success: true, recalculatedDays: days, processedRecords: records });

  } catch (error: any) {
    console.error('Recalculate Error:', error);
    return NextResponse.json({ error: 'Failed to recalculate data' }, { status: 500 });
  }
}
