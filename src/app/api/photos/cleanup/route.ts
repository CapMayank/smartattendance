import { NextResponse } from 'next/server'
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runPhotoCleanup } from '@/lib/photo-retention'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return NextResponse.json(await runPhotoCleanup())
  } catch (error) {
    console.error('Photo cleanup error:', error)
    return NextResponse.json({ error: 'Failed to clean up photos' }, { status: 500 })
  }
}
