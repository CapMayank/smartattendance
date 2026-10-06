import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { startOfDay, endOfDay, parseISO, eachDayOfInterval, format } from 'date-fns'
import { recalculateAttendance } from '@/lib/attendance'

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json()
    const { staffIds, startDate, endDate, time, type } = body

    if (!staffIds || !Array.isArray(staffIds) || staffIds.length === 0 || !startDate || !endDate || !time || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = parseISO(startDate)
    const end = parseISO(endDate)

    if (start > end) {
      return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 })
    }

    const days = eachDayOfInterval({ start, end })
    
    // Parse the time (HH:MM)
    const [hours, minutes] = time.split(':').map(Number)

    let createdCount = 0

    // To prevent overwhelming the database or recalculation, we'll process sequentially
    for (const day of days) {
      // Set the specific time on the current day
      const punchDate = new Date(day)
      punchDate.setHours(hours, minutes, 0, 0)
      
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

    // Recalculate daily records for the entire range at once
    await recalculateAttendance(startOfDay(start), endOfDay(end))

    return NextResponse.json({ success: true, createdCount })
  } catch (error: any) {
    console.error("POST Bulk Punch Error:", error)
    return NextResponse.json({ error: 'Failed to create bulk punches' }, { status: 500 })
  }
}
