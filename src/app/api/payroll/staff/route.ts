import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const staff = await prisma.staff.findMany({
      include: {
        department: true,
        designation: true,
        payrollInfo: true,
      },
    });

    // Sort numerically by machineId
    staff.sort((a, b) => a.machineId.localeCompare(b.machineId, undefined, { numeric: true }));

    return NextResponse.json(staff);
  } catch (error) {
    console.error("Error fetching staff payroll info:", error);
    return NextResponse.json(
      { error: "Failed to fetch staff payroll info" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { staffId, payrollInfo } = body;

    if (!staffId) {
      return NextResponse.json(
        { error: "Staff ID is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.staffPayrollInfo.upsert({
      where: { staffId },
      create: {
        staffId,
        ...payrollInfo
      },
      update: {
        ...payrollInfo
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating staff payroll info:", error);
    return NextResponse.json(
      { error: "Failed to update staff payroll info" },
      { status: 500 }
    );
  }
}
