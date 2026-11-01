import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

function calculatePayroll(
  monthlyCtc: number,
  presentDays: number,
  totalDays: number,
  refundOfAdvance: number = 0,
  bonusAmount: number = 0,
  bonusDays: number = 0,
  bonusType: string = "CUSTOM",
  isBonusPfApplicable: boolean = false
) {
  if (totalDays === 0) return null;

  // Base Total Wage (Gross) from CTC (CTC = Gross + 12% of Gross) -> Gross = CTC / 1.12
  const baseGrossWage = monthlyCtc / 1.12;
  const wagePerDay = Math.round(baseGrossWage / totalDays);
  
  // Cap presentDays to totalDays to keep attendance valid and prevent wage distortions
  const validPresentDays = Math.min(presentDays, totalDays);
  
  // Calculate Actual Basic Wage based on valid present days
  let basicWage = 0;
  if (validPresentDays === totalDays) {
    basicWage = baseGrossWage;
  } else {
    basicWage = wagePerDay * validPresentDays;
  }

  // Calculate bonus if bonusType is DAYS and bonusAmount is 0
  let finalBonus = Number(bonusAmount) || 0;
  if (bonusType === "DAYS" && bonusDays > 0 && finalBonus === 0) {
    finalBonus = Math.round(wagePerDay * bonusDays);
  }

  const grossWage = Math.round(basicWage + finalBonus);
  
  // EPF wage: basicWage (+ bonus only if isBonusPfApplicable is true)
  const epfWages = Math.round(isBonusPfApplicable ? basicWage + finalBonus : basicWage);
  const epsWages = Math.min(epfWages, 25000);
  const edliWages = Math.min(epfWages, 25000);
  
  const employeeEpf = Math.round(epfWages * 0.12);
  
  // EPFO ECR calculation for EPS (Account 10):
  // 8.33% on EPS wages (up to 25,000)
  // PLUS 1.16% on wages exceeding 15,000 for POHW cases (EPFO ECR rule RFE-25)
  const baseEps = Math.round(epsWages * 0.0833);
  const excessEpsWage = Math.max(0, epsWages - 15000);
  const pohwSurcharge = Math.round(excessEpsWage * 0.0116);
  const employerEps = baseEps + pohwSurcharge;
  
  // Employer PF contribution (Account 1): strictly Due EPF - Due EPS (EPFO ECR rule RFE-37)
  const employerEpf = Math.round(epfWages * 0.12) - employerEps;
  
  const ncpDays = Math.max(0, totalDays - validPresentDays);
  
  const netPayment = Math.round(grossWage - employeeEpf - refundOfAdvance);

  return {
    actualCtc: Math.round(grossWage + employeeEpf),
    grossWage,
    basicWage: Math.round(basicWage),
    bonusAmount: Math.round(finalBonus),
    bonusDays,
    bonusType,
    isBonusPfApplicable,
    epfWages: Math.round(epfWages),
    epsWages: Math.round(epsWages),
    edliWages: Math.round(edliWages),
    employeeEpf,
    employerEps,
    employerEpf,
    ncpDays,
    netPayment
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
            payrollInfo: true
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
      
      const doj = payroll.staff.payrollInfo?.doj || payroll.staff.createdAt;
      const normalizedDoj = new Date(doj.getFullYear(), doj.getMonth(), doj.getDate());
      
      for (let i = 0; i < attendanceRecords.length; i++) {
        const record = attendanceRecords[i];
        
        if (record.date >= startDate && record.date <= endDate) {
          
          if (record.date < normalizedDoj) {
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

      // If present days changed, update the payroll record
      if (presentDays !== payroll.presentDays) {
        const monthlyCtc = payroll.staff.payrollInfo?.monthlyCtc || 0;
        const calc = calculatePayroll(
          monthlyCtc,
          presentDays,
          totalDays,
          payroll.refundOfAdvance,
          payroll.bonusAmount || 0,
          payroll.bonusDays || 0,
          payroll.bonusType || "CUSTOM",
          payroll.isBonusPfApplicable || false
        );

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
