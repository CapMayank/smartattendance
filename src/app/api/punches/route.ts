import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole, canAccessStaff } from "@/lib/rbac"
import { startOfDay, endOfDay, parseISO, isValid } from 'date-fns'
import { recalculateAttendance } from '@/lib/attendance'
import { isEmployedOnDate } from '@/lib/employment'
import { istDateKey } from '@/lib/dashboard-calc'
import { isPunchType } from '@/lib/validators'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN', 'APPROVER', 'EMPLOYEE']);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get('staffId')
    const dateStr = searchParams.get('date') // YYYY-MM-DD

    if (!staffId || !dateStr) {
      return NextResponse.json({ error: 'Missing staffId or date' }, { status: 400 })
    }

    if (!(await canAccessStaff(auth.user, staffId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const date = parseISO(dateStr)
    if (!isValid(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }

    const rows = await prisma.attendanceLog.findMany({
      where: {
        staffId,
        timestamp: {
          gte: startOfDay(date),
          lte: endOfDay(date)
        }
      },
      orderBy: { timestamp: 'asc' },
      // Only the linked photo's id: the image bytes are never loaded here.
      include: { photo: { select: { id: true } } }
    })
    const logs = rows.map(({ photo, ...log }) => ({ ...log, photoId: photo?.id ?? null }))

    const hasExplicitOut = logs.some(l => l.type === 'OUT');
    const hasExplicitIn = logs.some(l => l.type === 'IN');
    const resultLogs = (logs.length > 1 && (!hasExplicitIn || !hasExplicitOut))
      ? logs.map((log, index) => ({
          ...log,
          type: (index === logs.length - 1 || index % 2 === 1) ? 'OUT' : 'IN'
        }))
      : (logs.length === 1 && logs[0].type !== 'OUT')
      ? [{ ...logs[0], type: 'IN' }]
      : logs;

    return NextResponse.json(resultLogs)
  } catch (error: unknown) {
    console.error("GET Punches Error:", error)
    return NextResponse.json({ error: 'Failed to fetch punches' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN']);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json()
    const { staffId, timestamp, type } = body

    if (!staffId || !timestamp || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!isPunchType(type)) {
      return NextResponse.json({ error: 'type must be IN or OUT' }, { status: 400 })
    }

    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: 'timestamp is not a valid date/time' }, { status: 400 })
    }

    const staff = await prisma.staff.findUnique({
      where: { id: String(staffId) },
      include: { employmentPeriods: { select: { startDate: true, endDate: true } } },
    })
    if (!staff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
    }
    if (!isEmployedOnDate(staff, istDateKey(date))) {
      return NextResponse.json({ error: 'Staff member was not employed on this date' }, { status: 400 })
    }

    // Guardrail: Cannot punch in the future
    if (date > new Date()) {
      return NextResponse.json({ error: 'Cannot add punches for future dates/times' }, { status: 400 })
    }

    // Guardrail: Check if payroll is locked for this month
    const month = date.getMonth() + 1 // 1-12
    const year = date.getFullYear()

    const lockedPayroll = await prisma.monthlyPayroll.findUnique({
      where: {
        staffId_month_year: {
          staffId,
          month,
          year
        }
      }
    })

    if (lockedPayroll?.isLocked) {
      return NextResponse.json({ error: 'Cannot modify punches for a locked payroll month' }, { status: 400 })
    }

    const log = await prisma.attendanceLog.create({
      data: {
        staffId,
        timestamp: date,
        type // "IN" or "OUT"
      }
    })

    // Recalculate daily records for this day
    await recalculateAttendance(startOfDay(date), endOfDay(date))

    return NextResponse.json(log)
  } catch (error: unknown) {
    console.error("POST Punch Error:", error)
    return NextResponse.json({ error: 'Failed to create punch' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN']);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing log ID' }, { status: 400 })
    }

    // First get the log to know what date to recalculate
    const log = await prisma.attendanceLog.findUnique({
      where: { id }
    })

    if (!log) {
      return NextResponse.json({ error: 'Log not found' }, { status: 404 })
    }

    const date = log.timestamp

    // Guardrail: Check if payroll is locked for this month before deleting
    const month = date.getMonth() + 1
    const year = date.getFullYear()

    const lockedPayroll = await prisma.monthlyPayroll.findUnique({
      where: {
        staffId_month_year: {
          staffId: log.staffId,
          month,
          year
        }
      }
    })

    if (lockedPayroll?.isLocked) {
      return NextResponse.json({ error: 'Cannot delete punches for a locked payroll month' }, { status: 400 })
    }

    await prisma.attendanceLog.delete({
      where: { id }
    })

    // Recalculate daily records for this day
    await recalculateAttendance(startOfDay(date), endOfDay(date))

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("DELETE Punch Error:", error)
    return NextResponse.json({ error: 'Failed to delete punch' }, { status: 500 })
  }
}
