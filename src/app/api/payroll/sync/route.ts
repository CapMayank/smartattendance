import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/rbac";
import { calculateStaffPayroll, PayGroup } from "@/lib/payroll-calc";
import { format } from "date-fns";
import { isEmployedOnDate } from "@/lib/employment";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = await requireRole(session, ['ADMIN']);
    if (auth.errorResponse) return auth.errorResponse;

    const body = await request.json();
    const { month, year } = body;

    if (!month || !year) {
      return NextResponse.json({ error: "Month and year required" }, { status: 400 });
    }

    const totalDays = new Date(year, month, 0).getDate();

    // Fetch existing payrolls for the month
    const existingPayrolls = await prisma.monthlyPayroll.findMany({
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

    if (existingPayrolls.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0 });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const queryStartDate = new Date(year, month - 1, -6);
    const queryEndDate = new Date(year, month, 7, 23, 59, 59);

    const updates = await Promise.all(existingPayrolls.map(async (payroll) => {
      // Do not sync if the payroll is locked
      if (payroll.isLocked) {
        return false;
      }

      const attendanceRecords = await prisma.dailyRecord.findMany({
        where: {
          staffId: payroll.staffId,
          date: { gte: queryStartDate, lte: queryEndDate }
        },
        orderBy: { date: 'asc' }
      });

      let presentDays = 0;
      const staffRecord = payroll.staff;
      const hasPeriods = Array.isArray(staffRecord.employmentPeriods) && staffRecord.employmentPeriods.length > 0;
      const rawDoj = staffRecord.payrollInfo?.doj || (staffRecord.joiningDate ? new Date(`${staffRecord.joiningDate}T00:00:00`) : staffRecord.createdAt);
      const normalizedDoj = rawDoj ? new Date(new Date(rawDoj).getFullYear(), new Date(rawDoj).getMonth(), new Date(rawDoj).getDate()) : null;
      
      for (let i = 0; i < attendanceRecords.length; i++) {
        const record = attendanceRecords[i];
        
        if (record.date >= startDate && record.date <= endDate) {
          const dateStr = format(record.date, "yyyy-MM-dd");
          if (hasPeriods) {
            if (!isEmployedOnDate(staffRecord, dateStr)) continue;
          } else if (normalizedDoj && record.date < normalizedDoj) {
            continue;
          }
          
          if (record.status === "PRESENT") {
            presentDays += 1;
          } else if (record.status === "HALF_DAY") {
            presentDays += 0.5;
          } else if (record.status === "WEEKOFF" || record.status === "HOLIDAY") {
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

            if (prevWorkingDayStatus === "ABSENT" && nextWorkingDayStatus === "ABSENT") {
               // Sandwich! Deduct salary
            } else {
               presentDays += 1;
            }
          }
        }
      }

      const staffPayGroup = (payroll.staff.payrollInfo?.payGroup as PayGroup) || (payroll.payGroup as PayGroup) || "BANK_EPF";

      // If present days changed or pay group changed, update the payroll record
      if (presentDays !== payroll.presentDays || payroll.payGroup !== staffPayGroup) {
        const monthlyCtc = payroll.staff.payrollInfo?.monthlyCtc || 0;
        const targetMonthYear = `${year}-${String(month).padStart(2, '0')}`;
        const calc = calculateStaffPayroll({
          payGroup: staffPayGroup,
          monthlyCtc,
          presentDays,
          totalDays,
          refundOfAdvance: payroll.refundOfAdvance,
          bonusAmount: payroll.bonusAmount || 0,
          bonusDays: payroll.bonusDays || 0,
          bonusType: payroll.bonusType || "CUSTOM",
          isBonusPfApplicable: payroll.isBonusPfApplicable || false,
          targetMonthYear,
          isHigherPensionOpted: !!payroll.staff.payrollInfo?.isHigherPensionOpted,
        });

        if (calc) {
          await prisma.monthlyPayroll.update({
            where: { id: payroll.id },
            data: {
              presentDays: Math.min(presentDays, totalDays),
              ...calc
            }
          });
          return true; // marked as updated
        }
      }
      return false; // not updated
    }));

    const updatedCount = updates.filter(Boolean).length;

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error("Error syncing attendance to payroll:", error);
    return NextResponse.json(
      { error: "Failed to sync attendance to payroll" },
      { status: 500 }
    );
  }
}
