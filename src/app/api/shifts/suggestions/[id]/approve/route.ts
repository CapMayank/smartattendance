import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/rbac'
import { isValidDayKey } from '@/lib/shift-change-service'
import { approveSuggestion, SuggestionError } from '@/lib/shift-suggestions'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const { id } = await params
    if (!id || !id.trim()) return NextResponse.json({ error: 'Suggestion id required' }, { status: 400 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    const { startDate, dryRun } = body as { startDate?: unknown; dryRun?: unknown }
    if (!isValidDayKey(startDate)) {
      return NextResponse.json({ error: 'startDate must be a valid YYYY-MM-DD date' }, { status: 400 })
    }
    if (dryRun !== undefined && typeof dryRun !== 'boolean') {
      return NextResponse.json({ error: 'dryRun must be a boolean' }, { status: 400 })
    }

    const result = await approveSuggestion(id, startDate, { dryRun: dryRun === true, userId: session!.user?.id })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof SuggestionError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Approve suggestion error:', error)
    return NextResponse.json({ error: 'Failed to approve suggestion' }, { status: 500 })
  }
}
