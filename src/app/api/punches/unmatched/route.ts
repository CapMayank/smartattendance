import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN']);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'PENDING';

    const where: { resolvedAt?: null; NOT?: { resolvedAt: null } } = {};
    if (status === 'PENDING') {
      where.resolvedAt = null;
    } else if (status === 'RESOLVED') {
      where.NOT = { resolvedAt: null };
    }

    const punches = await prisma.unmatchedPunch.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });

    return NextResponse.json(punches);
  } catch (error: any) {
    console.error('GET Unmatched Punches Error:', error);
    return NextResponse.json({ error: 'Failed to fetch unmatched punches' }, { status: 500 });
  }
}
