import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { dismissSuggestion, SuggestionError } from '@/lib/shift-suggestions'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    if (!id || !id.trim()) return NextResponse.json({ error: 'Suggestion id required' }, { status: 400 })
    await dismissSuggestion(id, session.user?.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SuggestionError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Dismiss suggestion error:', error)
    return NextResponse.json({ error: 'Failed to dismiss suggestion' }, { status: 500 })
  }
}
