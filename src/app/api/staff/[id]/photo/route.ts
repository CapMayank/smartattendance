import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { jpegResponse } from '@/lib/photo-response'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN', 'APPROVER', 'EMPLOYEE'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { id } = await params
    if (!id || !id.trim()) return NextResponse.json({ error: 'Staff id required' }, { status: 400 })

    const userStaffId = auth.user.staffId ?? auth.user.staff?.id
    if (auth.user.role === 'EMPLOYEE' && userStaffId && userStaffId !== id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const staff = await prisma.staff.findUnique({ where: { id }, select: { profilePhotoId: true } })
    if (!staff?.profilePhotoId) return NextResponse.json({ error: 'No profile photo' }, { status: 404 })

    const photo = await prisma.punchPhoto.findFirst({
      where: { id: staff.profilePhotoId, staffId: id },
      select: { data: true },
    })
    if (!photo) return NextResponse.json({ error: 'No profile photo' }, { status: 404 })
    return jpegResponse(photo.data)
  } catch (error) {
    console.error('Profile photo load error:', error)
    return NextResponse.json({ error: 'Failed to load photo' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { id } = await params
    if (!id || !id.trim()) return NextResponse.json({ error: 'Staff id required' }, { status: 400 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      body = null
    }
    const photoId = (body as { photoId?: unknown } | null)?.photoId
    if (typeof photoId !== 'string' || !photoId.trim()) {
      return NextResponse.json({ error: 'photoId is required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const staff = await tx.staff.findUnique({ where: { id }, select: { id: true, profilePhotoId: true } })
      if (!staff) return { error: 'Staff not found' as const }
      const source = await tx.punchPhoto.findFirst({
        where: { id: photoId, staffId: id, isProfile: false },
        select: { takenAt: true, data: true },
      })
      if (!source) return { error: 'Photo not found' as const }

      const copy = await tx.punchPhoto.create({
        data: { staffId: id, takenAt: source.takenAt, data: source.data, isProfile: true },
        select: { id: true, takenAt: true },
      })
      await tx.staff.update({
        where: { id },
        data: { profilePhotoId: copy.id, profilePhotoPinned: true },
      })
      // Only after the pointer moved, and only the teacher's own previous profile copy
      if (staff.profilePhotoId) {
        await tx.punchPhoto.deleteMany({ where: { id: staff.profilePhotoId, staffId: id, isProfile: true } })
      }
      return { photo: copy }
    })

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 })
    return NextResponse.json({ photoId: result.photo.id, takenAt: result.photo.takenAt, pinned: true })
  } catch (error) {
    console.error('Pin photo error:', error)
    return NextResponse.json({ error: 'Failed to set profile photo' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { id } = await params
    if (!id || !id.trim()) return NextResponse.json({ error: 'Staff id required' }, { status: 400 })

    const found = await prisma.$transaction(async (tx) => {
      const staff = await tx.staff.findUnique({ where: { id }, select: { id: true, profilePhotoId: true } })
      if (!staff) return false
      await tx.staff.update({ where: { id }, data: { profilePhotoId: null, profilePhotoPinned: false } })
      if (staff.profilePhotoId) {
        await tx.punchPhoto.deleteMany({ where: { id: staff.profilePhotoId, staffId: id, isProfile: true } })
      }
      return true
    })
    if (!found) return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove photo error:', error)
    return NextResponse.json({ error: 'Failed to remove profile photo' }, { status: 500 })
  }
}
