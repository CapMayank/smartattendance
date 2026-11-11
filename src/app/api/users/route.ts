import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import bcrypt from 'bcryptjs'

const isAppRole = (value: unknown): value is 'ADMIN' | 'APPROVER' | 'EMPLOYEE' =>
  value === 'ADMIN' || value === 'APPROVER' || value === 'EMPLOYEE'

export async function GET() {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  const users = await prisma.user.findMany({ 
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      staffId: true,
      mustChangePassword: true,
      disabledAt: true,
    }
  })
  return NextResponse.json(users)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { name, password, role, staffId, mustChangePassword, ...rest } = await request.json()
    // Sign-in looks emails up in lowercase, so they must be stored that way too
    const email = typeof rest.email === 'string' ? rest.email.trim().toLowerCase() : ''
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    if (role !== undefined && !isAppRole(role)) {
      return NextResponse.json({ error: 'Role must be ADMIN, APPROVER or EMPLOYEE' }, { status: 400 })
    }

    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({ 
      data: {
        name,
        email,
        password: hash,
        role: role || 'ADMIN',
        staffId: staffId || null,
        mustChangePassword: mustChangePassword ?? false,
      }
    })
    
    // Don't return password hash
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      staffId: user.staffId,
      mustChangePassword: user.mustChangePassword,
      disabledAt: user.disabledAt,
    }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
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
    
    // Prevent deleting oneself
    if (id === session!.user.id) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Prevent deletion of the last remaining active Admin user
    if (targetUser.role === 'ADMIN' && targetUser.disabledAt === null) {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'ADMIN', disabledAt: null }
      })
      if (activeAdminCount <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last remaining active Admin user' }, { status: 400 })
      }
    }

    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const { id, name, password, role, disabledAt, mustChangePassword, staffId } = data
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    const email =
      typeof data.email === 'string' ? data.email.trim().toLowerCase() || null : data.email === null ? null : undefined
    if (role !== undefined && !isAppRole(role)) {
      return NextResponse.json({ error: 'Role must be ADMIN, APPROVER or EMPLOYEE' }, { status: 400 })
    }
    if (password !== undefined && password !== '' && (typeof password !== 'string' || password.length < 8)) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id } })
    if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Prevent demotion or disabling of the last remaining active Admin user
    const willDemote = role !== undefined && role !== 'ADMIN' && targetUser.role === 'ADMIN'
    const willDisable = disabledAt !== undefined && disabledAt !== null && targetUser.disabledAt === null
    if (targetUser.role === 'ADMIN' && targetUser.disabledAt === null && (willDemote || willDisable)) {
      const activeAdminCount = await prisma.user.count({
        where: { role: 'ADMIN', disabledAt: null }
      })
      if (activeAdminCount <= 1) {
        return NextResponse.json({ error: 'Cannot demote or disable the last remaining active Admin user' }, { status: 400 })
      }
    }

    if (id === auth.user.id && disabledAt) {
      return NextResponse.json({ error: 'You cannot disable your own account' }, { status: 400 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (role !== undefined) updateData.role = role
    if (disabledAt !== undefined) updateData.disabledAt = disabledAt ? new Date(disabledAt) : null
    if (mustChangePassword !== undefined) updateData.mustChangePassword = mustChangePassword
    if (staffId !== undefined) updateData.staffId = staffId || null
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({ 
      where: { id },
      data: updateData
    })
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      staffId: user.staffId,
      mustChangePassword: user.mustChangePassword,
      disabledAt: user.disabledAt,
    })
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Email already exists' }, { status: 400 })
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}
