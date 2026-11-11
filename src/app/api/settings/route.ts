import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { DEFAULT_STATUTORY_RULES } from "@/lib/statutory-config"
import { isTimeHHMM } from "@/lib/validators"

const POLICY_TIME_FIELDS = [
  'earlyArrivalAllow',
  'maxOtAllow',
  'otHalfCOffFrom',
  'otHalfCOffTo',
  'otFullCOffFrom',
  'otFullCOffTo',
  'lateArrivalAllow',
  'earlyDepartureAllow',
  'earlyArrivalIgnore',
  'lateDepartureIgnore',
  'overTimeIgnore',
  'halfDayIfLateHrsGreaterThan',
  'halfDayIfWorkHrsLessThan',
  'absentIfLateHrsGreaterThan',
  'absentIfWorkHrsLessThan',
  'shiftHrsForOtCalculation',
] as const
// 'All IN Last OUT' is what the settings screen stores for per-pair (every IN/OUT) calculation
const POLICY_IN_OUT_MODES = ['First IN Last OUT', 'All IN Last OUT', 'Every IN OUT']

const EDITABLE_SETTING_KEYS = new Set(['PUNCH_REQUEST_MAX_DAYS', 'STATUTORY_RULES'])

export async function GET(req?: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  if (req?.url) {
    try {
      const { searchParams } = new URL(req.url)
      const key = searchParams.get('key')
      if (key) {
        const setting = await prisma.systemSetting.findUnique({
          where: { key },
        })
        if (key === 'STATUTORY_RULES' && !setting?.value) {
          return NextResponse.json({
            key,
            value: JSON.stringify(DEFAULT_STATUTORY_RULES),
          })
        }
        return NextResponse.json(setting ?? { key, value: null })
      }
    } catch {
      // url parsing fallback
    }
  }

  let policy = await prisma.policy.findFirst()
  
  if (!policy) {
    policy = await prisma.policy.create({ data: {} })
  }

  return NextResponse.json(policy)
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const { id } = data
    if (!id) return NextResponse.json({ error: 'Policy id is required' }, { status: 400 })

    // Only known policy fields are written, and each one is checked: a malformed time or
    // week-off list would silently corrupt every attendance calculation that reads it.
    const updateData: Record<string, string | number> = {}
    for (const field of POLICY_TIME_FIELDS) {
      if (data[field] === undefined) continue
      if (!isTimeHHMM(data[field])) {
        return NextResponse.json({ error: `${field} must be HH:MM (24-hour)` }, { status: 400 })
      }
      updateData[field] = data[field]
    }
    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        return NextResponse.json({ error: 'Policy name cannot be empty' }, { status: 400 })
      }
      updateData.name = data.name.trim()
    }
    if (data.allInOut !== undefined) {
      if (!POLICY_IN_OUT_MODES.includes(data.allInOut)) {
        return NextResponse.json({ error: 'Unknown IN/OUT calculation mode' }, { status: 400 })
      }
      updateData.allInOut = data.allInOut
    }
    if (data.weekOffDays !== undefined) {
      const days = String(data.weekOffDays).split(',').map((d) => d.trim()).filter(Boolean)
      if (!days.every((d) => /^[0-6]$/.test(d))) {
        return NextResponse.json(
          { error: 'Week-off days must be numbers 0-6 separated by commas (0 = Sunday)' },
          { status: 400 }
        )
      }
      updateData.weekOffDays = Array.from(new Set(days)).join(',')
    }
    if (data.noOfLate !== undefined) {
      const n = Number(data.noOfLate)
      if (!Number.isInteger(n) || n < 0) {
        return NextResponse.json({ error: 'Number of late arrivals must be a whole number' }, { status: 400 })
      }
      updateData.noOfLate = n
    }
    if (data.overtimePaymentMultiplier !== undefined) {
      const n = Number(data.overtimePaymentMultiplier)
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: 'Overtime multiplier must be zero or more' }, { status: 400 })
      }
      updateData.overtimePaymentMultiplier = n
    }

    const updated = await prisma.policy.update({
      where: { id },
      data: updateData
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Settings Update Error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const { key, value } = data

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Key and value are required' }, { status: 400 })
    }

    // SystemSetting also holds internal state (e.g. SETUP_COMPLETED, which gates the
    // unauthenticated setup wizard). Only the settings this screen owns may be written here.
    if (!EDITABLE_SETTING_KEYS.has(String(key))) {
      return NextResponse.json({ error: 'This setting cannot be changed here' }, { status: 400 })
    }

    const setting = await prisma.systemSetting.upsert({
      where: { key: String(key) },
      update: { value: String(value) },
      create: { key: String(key), value: String(value) },
    })

    return NextResponse.json(setting)
  } catch (error) {
    console.error('Settings POST Error:', error)
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
  }
}
