import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    // Biometric gateways often send data in JSON or form-data
    // We'll support JSON for this implementation
    const body = await request.json()
    
    // Expected payload: { machineId, staffId, timestamp, type, name (optional) }
    const { machineId, staffId, timestamp, type, name } = body

    if (!staffId || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if staff exists, if not create one
    let staff = await prisma.staff.findUnique({
      where: { machineId: staffId }
    })

    if (!staff) {
      staff = await prisma.staff.create({
        data: {
          machineId: staffId,
          name: name || `Staff ${staffId}`,
        }
      })
    }

    // Update Device Status
    if (machineId) {
      await prisma.device.upsert({
        where: { id: machineId },
        update: { lastPing: new Date() },
        create: { id: machineId, name: `Device ${machineId}`, lastPing: new Date() }
      })
    }

    // Create attendance log
    const log = await prisma.attendanceLog.create({
      data: {
        staffId: staff.id,
        timestamp: new Date(timestamp),
        type: type ? type.toUpperCase() : "PUNCH",
      }
    })

    return NextResponse.json({ success: true, log }, { status: 201 })
  } catch (error) {
    console.error('Attendance Push Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
