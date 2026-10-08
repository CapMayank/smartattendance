import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { startOfDay, endOfDay, parseISO } from 'date-fns'
import { recalculateAttendance } from '@/lib/attendance'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url)
    const staffId = searchParams.get('staffId')
    const dateStr = searchParams.get('date') // YYYY-MM-DD

    if (!staffId || !dateStr) {
      return NextResponse.json({ error: 'Missing staffId or date' }, { status: 400 })
    }

    const date = parseISO(dateStr)

    const logs = await prisma.attendanceLog.findMany({
      where: {
        staffId,
        timestamp: {
          gte: startOfDay(date),
          lte: endOfDay(date)
        }
      },
      orderBy: { timestamp: 'asc' }
    })

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
  } catch (error: any) {
    console.error("GET Punches Error:", error)
    return NextResponse.json({ error: 'Failed to fetch punches' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json()
    const { staffId, timestamp, type } = body

    if (!staffId || !timestamp || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const date = new Date(timestamp)

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
  } catch (error: any) {
    console.error("POST Punch Error:", error)
    return NextResponse.json({ error: 'Failed to create punch' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
  } catch (error: any) {
    console.error("DELETE Punch Error:", error)
    return NextResponse.json({ error: 'Failed to delete punch' }, { status: 500 })
  }
}
