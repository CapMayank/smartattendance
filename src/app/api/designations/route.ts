import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { isUniqueViolation } from "@/lib/validators"

export async function GET() {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN', 'APPROVER'])
  if (auth.errorResponse) return auth.errorResponse

  const designations = await prisma.designation.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(designations)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const name = typeof data?.name === 'string' ? data.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Designation name is required' }, { status: 400 })
    }
    const desig = await prisma.designation.create({ data: { name } })
    return NextResponse.json(desig, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'A designation with this name already exists' }, { status: 409 })
    }
    console.error('Create designation error:', error)
    return NextResponse.json({ error: 'Failed to create designation' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    if (prisma.staff?.count) {
      const assignedStaff = await prisma.staff.count({ where: { designationId: id } })
      if (assignedStaff > 0) {
        return NextResponse.json(
          { error: `Cannot delete designation while assigned to ${assignedStaff} staff member(s).` },
          { status: 409 }
        )
      }
    }

    await prisma.designation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete designation' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const id = data?.id
    const name = typeof data?.name === 'string' ? data.name.trim() : ''
    if (!id || !name) return NextResponse.json({ error: 'ID and name required' }, { status: 400 })
    const desig = await prisma.designation.update({
      where: { id },
      data: { name }
    })
    return NextResponse.json(desig)
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'A designation with this name already exists' }, { status: 409 })
    }
    console.error('Update designation error:', error)
    return NextResponse.json({ error: 'Failed to update designation' }, { status: 500 })
  }
}
