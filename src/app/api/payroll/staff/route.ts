import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { calculateStaffPayroll, type PayGroup } from "@/lib/payroll-calc";
import { istDateKey } from "@/lib/dashboard-calc";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ["ADMIN"]);
    if (auth.errorResponse) return auth.errorResponse;

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
    const auth = await requireRole(session, ["ADMIN"]);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const { staffId, payrollInfo } = body;

    if (!staffId) {
      return NextResponse.json(
        { error: "Staff ID is required" },
        { status: 400 }
      );
    }

    const existingInfo = await prisma.staffPayrollInfo.findUnique({
      where: { staffId },
    });

    const updated = await prisma.staffPayrollInfo.upsert({
      where: { staffId },
      create: {
        staffId,
        ...payrollInfo,
      },
      update: {
        ...payrollInfo,
      },
    });

    // Record PayGroupChange if payGroup changed
    if (
      payrollInfo?.payGroup &&
      existingInfo?.payGroup !== payrollInfo.payGroup &&
      prisma.payGroupChange?.create
    ) {
      const currentMonthKey = istDateKey(new Date()).slice(0, 7);
      await prisma.payGroupChange.create({
        data: {
          staffPayrollInfoId: updated.id,
          payGroup: payrollInfo.payGroup,
          effectiveFromMonth: payrollInfo.effectiveFromMonth || currentMonthKey,
          createdByUserId: auth.user.id,
        },
      });
    }

    // Recalculate any unlocked MonthlyPayroll drafts for this staff member so payGroup/CTC changes take effect immediately
    if (prisma.monthlyPayroll?.findMany) {
      const unlockedRows = await prisma.monthlyPayroll.findMany({
        where: { staffId, isLocked: false },
      });
      const payGroup = ((updated.payGroup as PayGroup) || "BANK_EPF");
      const monthlyCtc = updated.monthlyCtc || 0;

      for (const row of unlockedRows) {
        const targetMonthYear = `${row.year}-${String(row.month).padStart(2, '0')}`;
        const calc = calculateStaffPayroll({
          payGroup,
          monthlyCtc,
          presentDays: row.presentDays,
          totalDays: row.totalDays,
          refundOfAdvance: row.refundOfAdvance,
          bonusAmount: row.bonusAmount,
          bonusDays: row.bonusDays ?? 0,
          bonusType: (row.bonusType as "DAYS" | "FLAT" | "CUSTOM") ?? "CUSTOM",
          isBonusPfApplicable: row.isBonusPfApplicable,
          targetMonthYear,
          isHigherPensionOpted: !!updated.isHigherPensionOpted,
        });
        if (calc) {
          await prisma.monthlyPayroll.update({
            where: { id: row.id },
            data: {
              ...calc,
            },
          });
        }
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating staff payroll info:", error);
    return NextResponse.json(
      { error: "Failed to update staff payroll info" },
      { status: 500 }
    );
  }
}
