import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { startOfDay } from 'date-fns'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await request.json()
    const { name, date } = data
    
    if (!name || !date) {
      return NextResponse.json({ error: 'Name and Date are required' }, { status: 400 })
    }

    const targetDate = startOfDay(new Date(date))

    const holiday = await prisma.holiday.upsert({
      where: { date: targetDate },
      update: { name },
      create: {
        name,
        date: targetDate
      }
    })

    return NextResponse.json(holiday)
  } catch (error) {
    console.error('Create Holiday Error:', error)
    return NextResponse.json({ error: 'Failed to create holiday' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    await prisma.holiday.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete Holiday Error:', error)
    return NextResponse.json({ error: 'Failed to delete holiday' }, { status: 500 })
  }
}
