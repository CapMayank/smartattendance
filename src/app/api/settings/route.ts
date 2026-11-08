import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"

export async function GET() {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

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
