import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole, canAccessStaff } from "@/lib/rbac"
import { jpegResponse } from '@/lib/photo-response'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN', 'APPROVER', 'EMPLOYEE'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { id } = await params
    if (!id || !id.trim()) return NextResponse.json({ error: 'Photo id required' }, { status: 400 })

    const photo = await prisma.punchPhoto.findUnique({ where: { id }, select: { data: true, staffId: true } })
    if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    if (!(await canAccessStaff(auth.user, photo.staffId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return jpegResponse(photo.data)
  } catch (error) {
    console.error('Photo load error:', error)
    return NextResponse.json({ error: 'Failed to load photo' }, { status: 500 })
  }
}
