import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/rbac'
import { listPendingSuggestions, runDetection } from '@/lib/shift-suggestions'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

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
