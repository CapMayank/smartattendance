import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(departments)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await request.json()
    const dept = await prisma.department.create({ data })
    return NextResponse.json(dept, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    await prisma.department.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await request.json()
    const { id, name } = data
    if (!id || !name) return NextResponse.json({ error: 'ID and name required' }, { status: 400 })
    const dept = await prisma.department.update({
      where: { id },
      data: { name }
    })
    return NextResponse.json(dept)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 })
  }
}
