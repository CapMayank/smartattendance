import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    
    if (!staffId) {
      return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 })
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: {
        department: true,
        designation: true,
        payrollInfo: true,
      }
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    const payrolls = await prisma.monthlyPayroll.findMany({
      where: {
        staffId: staffId,
      },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });

    return NextResponse.json({
      staff,
      payrolls
    })

  } catch (error) {
    console.error('Member Payroll API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch member payroll records' }, { status: 500 })
  }
}
