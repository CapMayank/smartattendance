import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"

export async function GET() {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  const devices = await prisma.device.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(devices)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const name = typeof data?.name === 'string' ? data.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Device name is required' }, { status: 400 })
    }

    const serialNumber =
      typeof data?.serialNumber === 'string' && data.serialNumber.trim()
        ? data.serialNumber.trim()
        : null
    const ipAddress =
      typeof data?.ipAddress === 'string' && data.ipAddress.trim()
        ? data.ipAddress.trim()
        : null
    const port =
      typeof data?.port === 'string' && data.port.trim()
        ? data.port.trim()
        : null

    const device = await prisma.device.create({
      data: {
        name,
        serialNumber,
        ipAddress,
        port,
      },
    })
    return NextResponse.json(device, { status: 201 })
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A device with this serial number already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Failed to create device' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const data = await request.json()
    const { id } = data
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const updateData: {
      name?: string
      serialNumber?: string | null
      ipAddress?: string | null
      port?: string | null
    } = {}

    if (typeof data.name === 'string') {
      const name = data.name.trim()
      if (!name) {
        return NextResponse.json({ error: 'Device name cannot be empty' }, { status: 400 })
      }
      updateData.name = name
    }

    if ('serialNumber' in data) {
      updateData.serialNumber =
        typeof data.serialNumber === 'string' && data.serialNumber.trim()
          ? data.serialNumber.trim()
          : null
    }

    if ('ipAddress' in data) {
      updateData.ipAddress =
        typeof data.ipAddress === 'string' && data.ipAddress.trim()
          ? data.ipAddress.trim()
          : null
    }

    if ('port' in data) {
      updateData.port =
        typeof data.port === 'string' && data.port.trim()
          ? data.port.trim()
          : null
    }

    const device = await prisma.device.update({
      where: { id },
      data: updateData,
    })
    return NextResponse.json(device)
  } catch (error: unknown) {
    const err = error as { code?: string }
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A device with this serial number already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: 'Failed to update device' }, { status: 500 })
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
    await prisma.device.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete device' }, { status: 500 })
  }
}
