import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { listPendingSuggestions, runDetection } from '@/lib/shift-suggestions'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  // A detection failure must not break the list
  try {
    await runDetection({ force: searchParams.get('refresh') === '1' })
  } catch (error) {
    console.error('[shift-suggestions] detection failed:', error)
  }

  try {
    return NextResponse.json({ suggestions: await listPendingSuggestions() })
  } catch (error) {
    console.error('[shift-suggestions] list failed:', error)
    return NextResponse.json({ error: 'Failed to load suggestions' }, { status: 500 })
  }
}
