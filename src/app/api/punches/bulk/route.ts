import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { startOfDay, endOfDay, parseISO, eachDayOfInterval, format } from 'date-fns'
import { recalculateAttendance } from '@/lib/attendance'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN']);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await req.json()
    const { staffIds, startDate, endDate, time, type } = body

    if (!staffIds || !Array.isArray(staffIds) || staffIds.length === 0 || !startDate || !endDate || !time || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = parseISO(startDate)
    const end = parseISO(endDate)
    const now = new Date()

    // Guardrail: Cannot punch in the future
    if (start > now || end > now) {
      return NextResponse.json({ error: 'Cannot add punches for future dates' }, { status: 400 })
    }

    if (start > end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    const days = eachDayOfInterval({ start, end })

    for (const day of days) {
      const dayKey = format(day, 'yyyy-MM-dd')
      const candidate = new Date(`${dayKey}T${time}:00+05:30`)
      if (candidate > now) {
        return NextResponse.json({ error: 'Cannot add punches for future dates or times' }, { status: 400 })
      }
    }

    // Guardrail: Check if any payroll is locked for the selected staff and months involved
    const monthYears = new Set<string>()
    for (const day of days) {
      monthYears.add(`${day.getMonth() + 1}-${day.getFullYear()}`)
    }

    const lockedChecks = Array.from(monthYears).map(async (my) => {
      const [monthStr, yearStr] = my.split('-')
      const month = parseInt(monthStr, 10)
      const year = parseInt(yearStr, 10)

      const lockedPayrolls = await prisma.monthlyPayroll.findFirst({
        where: {
          staffId: { in: staffIds },
          month,
          year,
          isLocked: true
        }
      })
      return lockedPayrolls
    })

    const lockedResults = await Promise.all(lockedChecks)
    if (lockedResults.some(r => r !== null)) {
      return NextResponse.json({ error: 'Cannot modify punches for a locked payroll month for one or more selected staff' }, { status: 400 })
    }

    let createdCount = 0

    // Process sequentially in explicit IST (+05:30)
    for (const day of days) {
      const dayKey = format(day, 'yyyy-MM-dd')
      const punchDate = new Date(`${dayKey}T${time}:00+05:30`)
      
      const punchData = staffIds.map(staffId => ({
        staffId,
        timestamp: punchDate,
        type
      }))
      
      // Create many logs for this day
      await prisma.attendanceLog.createMany({
        data: punchData
      })
      
      createdCount += punchData.length
    }

    // Recalculate daily records for the entire range at once using explicit IST boundaries
    const startIst = new Date(`${format(start, 'yyyy-MM-dd')}T00:00:00+05:30`)
    const endIst = new Date(`${format(end, 'yyyy-MM-dd')}T23:59:59+05:30`)
    await recalculateAttendance(startIst, endIst)

    return NextResponse.json({ success: true, createdCount })
  } catch (error: unknown) {
    console.error("POST Bulk Punch Error:", error)
    return NextResponse.json({ error: 'Failed to create bulk punches' }, { status: 500 })
  }
}
