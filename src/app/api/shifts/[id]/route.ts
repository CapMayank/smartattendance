import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { shiftUsageCount, shiftInUseMessage } from '@/lib/shift-delete-guard'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { id } = await params
    const inUse = await shiftUsageCount(id)
    if (inUse > 0) return NextResponse.json({ error: shiftInUseMessage(inUse) }, { status: 409 })
    await prisma.shift.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete shift' }, { status: 500 })
  }
}
