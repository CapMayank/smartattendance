import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { parseMonthYear } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN']);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const { isLocked } = body;
    const period = parseMonthYear(body.month, body.year);

    if (!period || typeof isLocked !== 'boolean') {
      return NextResponse.json({ error: "Month, year, and isLocked boolean are required" }, { status: 400 });
    }
    const { month, year } = period;

    const existingCount = await prisma.monthlyPayroll.count({ where: { month, year } });
    if (existingCount === 0) {
      return NextResponse.json(
        { error: "No payroll has been generated for this month yet" },
        { status: 400 }
      );
    }

    // Update all monthly payroll records for the given month and year
    const updateResult = await prisma.monthlyPayroll.updateMany({
      where: { month, year },
      data: { isLocked }
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: auth.user.id,
        action: isLocked ? 'PAYROLL_LOCKED' : 'PAYROLL_UNLOCKED',
        targetType: 'Payroll',
        targetId: `${year}-${String(month).padStart(2, '0')}`,
        details: JSON.stringify({ month, year, count: updateResult.count }),
      },
    });

    return NextResponse.json({ success: true, count: updateResult.count });
  } catch (error) {
    console.error("Error locking/unlocking monthly payroll:", error);
    return NextResponse.json(
      { error: "Failed to lock/unlock monthly payroll" },
      { status: 500 }
    );
  }
}
