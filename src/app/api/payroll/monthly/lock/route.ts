import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { month, year, isLocked } = body;

    if (!month || !year || typeof isLocked !== 'boolean') {
      return NextResponse.json({ error: "Month, year, and isLocked boolean are required" }, { status: 400 });
    }

    // Update all monthly payroll records for the given month and year
    const updateResult = await prisma.monthlyPayroll.updateMany({
      where: { month, year },
      data: { isLocked }
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
