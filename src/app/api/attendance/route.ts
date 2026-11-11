import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { istDateKey, istDayStart } from '@/lib/dashboard-calc'
import { isEmployedOnDate } from '@/lib/employment'

/**
 * HTTP push endpoint for biometric gateways that cannot use the WebSocket server.
 *
 * This route is outside the session-auth proxy, so it authenticates the caller itself:
 * the gateway must send the shared secret from ATTENDANCE_PUSH_SECRET in the
 * `x-attendance-key` header. With no secret configured the endpoint is disabled.
 */
function isAuthorizedGateway(request: Request): boolean {
  const expected = process.env.ATTENDANCE_PUSH_SECRET
  if (!expected) return false
  const provided = request.headers.get('x-attendance-key') ?? ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!process.env.ATTENDANCE_PUSH_SECRET) {
    return NextResponse.json({ error: 'Attendance push is not enabled' }, { status: 403 })
  }
  if (!isAuthorizedGateway(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Expected payload: { machineId (device), staffId (ID on the machine), timestamp, type }
    const { machineId, staffId, timestamp, type } = body as Record<string, unknown>

    const machineUserId = staffId === undefined || staffId === null ? '' : String(staffId).trim()
    if (!machineUserId || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const punchDate = new Date(String(timestamp))
    if (Number.isNaN(punchDate.getTime())) {
      return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 })
    }

    if (machineId) {
      const deviceId = String(machineId)
      await prisma.device.upsert({
        where: { id: deviceId },
        update: { lastPing: new Date(), status: 'ONLINE' },
        create: { id: deviceId, name: `Device ${deviceId}`, lastPing: new Date(), status: 'ONLINE' },
      })
    }

    const requestedType = typeof type === 'string' ? type.toUpperCase() : ''
    const explicitType = requestedType === 'IN' || requestedType === 'OUT' ? requestedType : null

    const staff = await prisma.staff.findUnique({
      where: { machineId: machineUserId },
      include: { employmentPeriods: true },
    })

    // Unknown IDs and punches outside an employment period go to the unmatched queue for an
    // admin to resolve, exactly like the WebSocket ingest. Staff are never created from a punch.
    if (!staff || !isEmployedOnDate(staff, istDateKey(punchDate))) {
      const unmatched = await prisma.unmatchedPunch.create({
        data: {
          machineId: machineUserId,
          timestamp: punchDate,
          type: explicitType ?? 'IN',
          reason: staff ? 'NOT_EMPLOYED' : 'UNKNOWN_ID',
          ...(staff ? { attachedStaffId: staff.id } : {}),
        },
      })
      return NextResponse.json({ success: true, unmatched: true, id: unmatched.id }, { status: 202 })
    }

    let punchType = explicitType
    if (!punchType) {
      const dayStart = istDayStart(punchDate)
      const existingCount = await prisma.attendanceLog.count({
        where: {
          staffId: staff.id,
          timestamp: { gte: dayStart, lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) },
        },
      })
      punchType = existingCount % 2 === 1 ? 'OUT' : 'IN'
    }

    const log = await prisma.attendanceLog.create({
      data: { staffId: staff.id, timestamp: punchDate, type: punchType },
    })

    return NextResponse.json({ success: true, log }, { status: 201 })
  } catch (error) {
    console.error('Attendance Push Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
