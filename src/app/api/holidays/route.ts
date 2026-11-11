import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { startOfDay, eachDayOfInterval } from 'date-fns'
import { recalculateAttendance } from '@/lib/attendance'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN', 'APPROVER'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const startStr = searchParams.get('startDate')
    const endStr = searchParams.get('endDate')
    const month = searchParams.get('month')
    
    let where = {}
    
    if (startStr && endStr) {
      where = {
        date: {
          gte: new Date(startStr),
          lte: new Date(endStr)
        }
      }
    } else if (month) {
      const [year, m] = month.split('-').map(Number)
      const startDate = new Date(year, m - 1, 1)
      const endDate = new Date(year, m, 0, 23, 59, 59)
      
      where = {
        date: {
          gte: startDate,
          lte: endDate
        }
      }
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' }
    })

    return NextResponse.json(holidays)
  } catch (error) {
    console.error('Fetch Holidays Error:', error)
    return NextResponse.json({ error: 'Failed to fetch holidays' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const { date, startDate, endDate } = data
    const name = typeof data?.name === 'string' ? data.name.trim() : ''

    if (!name) {
      return NextResponse.json({ error: 'Holiday name is required' }, { status: 400 })
    }

    if (startDate || endDate) {
      if (!startDate || !endDate) {
        return NextResponse.json(
          { error: 'Both start date and end date are required for a holiday range' },
          { status: 400 }
        )
      }

      const start = startOfDay(new Date(startDate))
      const end = startOfDay(new Date(endDate))
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return NextResponse.json({ error: 'Start date and end date must be valid dates' }, { status: 400 })
      }

      if (end < start) {
        return NextResponse.json(
          { error: 'End date cannot be before start date' },
          { status: 400 }
        )
      }

      const days = eachDayOfInterval({ start, end })
      const createdHolidays = []

      for (const day of days) {
        const targetDate = startOfDay(day)
        const h = await prisma.holiday.upsert({
          where: { date: targetDate },
          update: { name },
          create: {
            name,
            date: targetDate,
          },
        })
        createdHolidays.push(h)
      }

      try {
        await recalculateAttendance(start, end)
      } catch (recalcErr) {
        console.error('Holiday recalculation error:', recalcErr)
      }

      return NextResponse.json({
        success: true,
        count: createdHolidays.length,
        holidays: createdHolidays,
      })
    }

    if (!date) {
      return NextResponse.json({ error: 'Name and Date are required' }, { status: 400 })
    }

    const targetDate = startOfDay(new Date(date))
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Date must be a valid date' }, { status: 400 })
    }

    const holiday = await prisma.holiday.upsert({
      where: { date: targetDate },
      update: { name },
      create: {
        name,
        date: targetDate,
      },
    })

    try {
      await recalculateAttendance(targetDate, targetDate)
    } catch (recalcErr) {
      console.error('Holiday recalculation error:', recalcErr)
    }

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Create Holiday Error:', error)
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    const existing = prisma.holiday.findUnique
      ? await prisma.holiday.findUnique({ where: { id } })
      : null

    await prisma.holiday.delete({
      where: { id },
    })

    if (existing?.date) {
      try {
        await recalculateAttendance(existing.date, existing.date)
      } catch (recalcErr) {
        console.error('Holiday delete recalculation error:', recalcErr)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete Holiday Error:', error)
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 })
  }
}
