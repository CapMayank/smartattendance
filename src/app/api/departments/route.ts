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

  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(departments)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const name = typeof data?.name === 'string' ? data.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 })
    }
    const dept = await prisma.department.create({ data: { name } })
    return NextResponse.json(dept, { status: 201 })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'A department with this name already exists' }, { status: 409 })
    }
    console.error('Create department error:', error)
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
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
      const assignedStaff = await prisma.staff.count({ where: { departmentId: id } })
      if (assignedStaff > 0) {
        return NextResponse.json(
          { error: `Cannot delete department while assigned to ${assignedStaff} staff member(s).` },
          { status: 409 }
        )
      }
    }

    if (prisma.approverDepartment?.deleteMany) {
      await prisma.approverDepartment.deleteMany({ where: { departmentId: id } })
    }

    await prisma.department.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
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
    const dept = await prisma.department.update({
      where: { id },
      data: { name }
    })
    return NextResponse.json(dept)
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ error: 'A department with this name already exists' }, { status: 409 })
    }
    console.error('Update department error:', error)
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}
