import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { calculateStaffPayroll, payrollColumns, PayGroup } from "@/lib/payroll-calc";
import { format } from "date-fns";
import { isEmployedOnDate } from "@/lib/employment";
import { parseMonthYear } from "@/lib/validators";

type StaffWithPayrollAndPeriods = Prisma.StaffGetPayload<{
  include: { payrollInfo: true; employmentPeriods: true };
}>;

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN']);
    if (auth.errorResponse) return auth.errorResponse;

    const { searchParams } = new URL(request.url);
    const period = parseMonthYear(searchParams.get("month"), searchParams.get("year"));
    if (!period) {
      return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
    }
    const { month, year } = period;

    const totalDays = new Date(year, month, 0).getDate();

    // Fetch existing payrolls for the month
    let existingPayrolls = await prisma.monthlyPayroll.findMany({
      where: { month, year },
      include: {
        staff: {
          include: {
            payrollInfo: true,
            employmentPeriods: true,
          }
        }
      }
    });

    const existingStaffIds = existingPayrolls.map(p => p.staffId);
    const isMonthAlreadyLocked = existingPayrolls.length > 0 && existingPayrolls.every(p => p.isLocked);

    // Fetch staff that don't have payroll generated yet
    let staffWithoutPayroll: StaffWithPayrollAndPeriods[] = [];
    if (!isMonthAlreadyLocked) {
      const candidateStaff = await prisma.staff.findMany({
        where: {
          id: { notIn: existingStaffIds },
          OR: [
            { payrollInfo: { isActiveForPayroll: true } },
            { payrollInfo: null }
          ]
        },
        include: { payrollInfo: true, employmentPeriods: true }
      });

      const monthStartStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEndStr = `${year}-${String(month).padStart(2, '0')}-${String(totalDays).padStart(2, '0')}`;

      // Filter out staff whose employment periods do not overlap the target month at all
      staffWithoutPayroll = candidateStaff.filter((s) => {
        const periods = s.employmentPeriods;
        if (!Array.isArray(periods) || periods.length === 0) return true;
        return periods.some((p) => {
          const startsBeforeEnd = p.startDate <= monthEndStr;
          const endsAfterStart = !p.endDate || p.endDate >= monthStartStr;
          return startsBeforeEnd && endsAfterStart;
        });
      });
    }

    if (staffWithoutPayroll.length > 0) {
      // Calculate present days from attendance for the staff
      // Fetch 7 days before and after to accurately calculate sandwich rules across month boundaries
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      
      const queryStartDate = new Date(year, month - 1, -6); // 7 days before
      const queryEndDate = new Date(year, month, 7, 23, 59, 59); // 7 days after

      const newPayrolls = await Promise.all(staffWithoutPayroll.map(async (staff) => {
        // Fetch all attendance records (including ABSENT) for sandwich logic
        const attendanceRecords = await prisma.dailyRecord.findMany({
          where: {
            staffId: staff.id,
            date: { gte: queryStartDate, lte: queryEndDate }
          },
          orderBy: { date: 'asc' }
        });

        let presentDays = 0;
        const hasPeriods = Array.isArray(staff.employmentPeriods) && staff.employmentPeriods.length > 0;
        const rawDoj = staff.payrollInfo?.doj || (staff.joiningDate ? new Date(`${staff.joiningDate}T00:00:00`) : staff.createdAt);
        const normalizedDoj = rawDoj ? new Date(new Date(rawDoj).getFullYear(), new Date(rawDoj).getMonth(), new Date(rawDoj).getDate()) : null;

        // We only care about adding present days that fall exactly within the current month
        for (let i = 0; i < attendanceRecords.length; i++) {
          const record = attendanceRecords[i];
          
          // Check if record belongs to the current month
          if (record.date >= startDate && record.date <= endDate) {
            const dateStr = format(record.date, "yyyy-MM-dd");
            if (hasPeriods) {
              if (!isEmployedOnDate(staff, dateStr)) continue;
            } else if (normalizedDoj && record.date < normalizedDoj) {
              continue;
            }
            
            if (record.status === "PRESENT") {
              presentDays += 1;
            } else if (record.status === "HALF_DAY") {
              presentDays += 0.5;
            } else if (record.status === "WEEKOFF" || record.status === "HOLIDAY") {
              // Apply Sandwich Rule
              let prevWorkingDayStatus = null;
              for (let j = i - 1; j >= 0; j--) {
                 if (attendanceRecords[j].status !== "WEEKOFF" && attendanceRecords[j].status !== "HOLIDAY") {
                    prevWorkingDayStatus = attendanceRecords[j].status;
                    break;
                 }
              }
              
              let nextWorkingDayStatus = null;
              for (let j = i + 1; j < attendanceRecords.length; j++) {
                 if (attendanceRecords[j].status !== "WEEKOFF" && attendanceRecords[j].status !== "HOLIDAY") {
                    nextWorkingDayStatus = attendanceRecords[j].status;
                    break;
                 }
              }

              // Sandwich logic: if both surrounding working days are ABSENT, then salary is deducted
              if (prevWorkingDayStatus === "ABSENT" && nextWorkingDayStatus === "ABSENT") {
                 // Sandwich! Deduct salary (do not add to presentDays)
              } else {
                 // Either one side is present, or it's the start/end of the data boundary (assume present)
                 presentDays += 1;
              }
            }
          }
        }

        const monthlyCtc = staff.payrollInfo?.monthlyCtc || 0;
        const payGroup = (staff.payrollInfo?.payGroup as PayGroup) || "BANK_EPF";
        const targetMonthYear = `${year}-${String(month).padStart(2, '0')}`;
        const calc = calculateStaffPayroll({
          payGroup,
          monthlyCtc,
          presentDays,
          totalDays,
          refundOfAdvance: 0,
          targetMonthYear,
          isHigherPensionOpted: !!staff.payrollInfo?.isHigherPensionOpted,
        });
        if (!calc) return null;

        return {
          staffId: staff.id,
          month,
          year,
          totalDays,
          presentDays,
          refundOfAdvance: 0,
          ...payrollColumns(calc),
        };
      }));

      // Bulk create new payrolls
      const createData: Prisma.MonthlyPayrollCreateManyInput[] = newPayrolls
        .filter((p): p is NonNullable<typeof p> => p !== null);

      // Two people opening the same month at once must not fail on the unique (staff, month, year)
      await prisma.monthlyPayroll.createMany({
        data: createData,
        skipDuplicates: true,
      });

      // Refetch
      existingPayrolls = await prisma.monthlyPayroll.findMany({
        where: { month, year },
        include: {
          staff: {
            include: {
              payrollInfo: true,
              employmentPeriods: true,
            }
          }
        }
      });
    }

    // Sort numerically by machineId
    existingPayrolls.sort((a, b) => a.staff.machineId.localeCompare(b.staff.machineId, undefined, { numeric: true }));

    return NextResponse.json(existingPayrolls);
  } catch (error) {
    console.error("Error fetching/generating monthly payroll:", error);
    return NextResponse.json(
      { error: "Failed to fetch/generate monthly payroll" },
      { status: 500 }
    );
  }
}

/** Coerces client input to a finite number >= 0 (anything else becomes 0). */
function nonNegative(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type PayrollUpdateItem = {
  id: string;
  presentDays: number;
  refundOfAdvance: number;
  monthlyCtc: number;
  totalDays: number;
  payGroup?: PayGroup;
  bonusAmount?: number;
  bonusDays?: number;
  bonusType?: "DAYS" | "FLAT" | "CUSTOM";
  isBonusPfApplicable?: boolean;
};

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN']);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const { payrolls } = body; // Array of payroll updates
    
    if (!Array.isArray(payrolls)) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    const updatedPayrolls = await Promise.all((payrolls as PayrollUpdateItem[]).map(async (p) => {
      const { id, bonusType = "CUSTOM", isBonusPfApplicable = false } = p;
      if (typeof id !== "string" || !id) return null;

      // Check if the payroll exists and is not locked before updating
      const existing = await prisma.monthlyPayroll.findUnique({
        where: { id },
        include: { staff: { include: { payrollInfo: true } } },
      });
      if (!existing || existing.isLocked) {
        return null; // Unknown or locked payrolls are never modified
      }

      // The month length comes from the stored row; amounts and days can never be negative
      const totalDays = existing.totalDays;
      const presentDays = Math.min(nonNegative(p.presentDays), totalDays);
      const refundOfAdvance = nonNegative(p.refundOfAdvance);
      const monthlyCtc = nonNegative(p.monthlyCtc);
      const bonusAmount = nonNegative(p.bonusAmount);
      const bonusDays = nonNegative(p.bonusDays);

      const payGroup = (p.payGroup || existing?.payGroup || "BANK_EPF") as PayGroup;
      const targetMonthYear = existing ? `${existing.year}-${String(existing.month).padStart(2, '0')}` : undefined;
      const isHigherPensionOpted = !!existing?.staff?.payrollInfo?.isHigherPensionOpted;
      const calc = calculateStaffPayroll({
        payGroup,
        monthlyCtc,
        presentDays,
        totalDays,
        refundOfAdvance,
        bonusAmount,
        bonusDays,
        bonusType,
        isBonusPfApplicable,
        targetMonthYear,
        isHigherPensionOpted,
      });

      if (calc) {
        return prisma.monthlyPayroll.update({
          where: { id },
          data: {
            presentDays: Math.min(presentDays, totalDays),
            refundOfAdvance,
            ...payrollColumns(calc)
          }
        });
      }
      return null;
    }));

    return NextResponse.json(updatedPayrolls.filter(Boolean));
  } catch (error) {
    console.error("Error updating monthly payroll:", error);
    return NextResponse.json(
      { error: "Failed to update monthly payroll" },
      { status: 500 }
    );
  }
}
