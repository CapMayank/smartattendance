import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const designations = await prisma.designation.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(designations)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await request.json()
    const desig = await prisma.designation.create({ data })
    return NextResponse.json(desig, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create designation' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
    await prisma.designation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete designation' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const data = await request.json()
    const { id, name } = data
    if (!id || !name) return NextResponse.json({ error: 'ID and name required' }, { status: 400 })
    const desig = await prisma.designation.update({
      where: { id },
      data: { name }
    })
    return NextResponse.json(desig)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update designation' }, { status: 500 })
  }
}
