import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const staff = await prisma.staff.findMany({
      include: {
        department: true,
        designation: true,
        payrollInfo: true,
      },
      orderBy: {
        name: 'asc'
      }
    });

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
