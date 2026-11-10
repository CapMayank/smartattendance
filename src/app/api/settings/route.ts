import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { DEFAULT_STATUTORY_RULES } from "@/lib/statutory-config"

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
    const { id, ...updateData } = data

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
