import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function calculatePayroll(
  monthlyCtc: number,
  presentDays: number,
  totalDays: number,
  refundOfAdvance: number = 0
) {
  if (totalDays === 0) return null;

  // Base Total Wage (Gross) from CTC (CTC = Gross + 12% of Gross) -> Gross = CTC / 1.12
  const baseGrossWage = monthlyCtc / 1.12;
  const wagePerDay = Math.round(baseGrossWage / totalDays);
  
  // Calculate Actual Basic Wage based on present days
  let basicWage = 0;
  if (presentDays === totalDays) {
    basicWage = baseGrossWage;
  } else {
    basicWage = wagePerDay * presentDays;
  }
  
  const epfWages = basicWage;
  const epsWages = Math.min(epfWages, 15000);
  const edliWages = Math.min(epfWages, 15000);
  
  const employeeEpf = Math.round(epfWages * 0.12);
  const employerEps = Math.round(epsWages * 0.0833);
  const employerEpf = Math.round((epfWages * 0.12) - employerEps);
  
  const ncpDays = Math.max(0, totalDays - presentDays);
  
  const netPayment = Math.round(basicWage - employeeEpf - refundOfAdvance);

  return {
    actualCtc: Math.round(basicWage + employeeEpf), // Actual CTC consumed
    grossWage: Math.round(basicWage),
    basicWage: Math.round(basicWage),
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get("month") || "");
    const year = parseInt(searchParams.get("year") || "");

    if (isNaN(month) || isNaN(year)) {
      return NextResponse.json({ error: "Invalid month or year" }, { status: 400 });
    }

    const totalDays = new Date(year, month, 0).getDate();

    // Fetch existing payrolls for the month
    let existingPayrolls = await prisma.monthlyPayroll.findMany({
      where: { month, year },
      include: {
        staff: {
          include: {
            payrollInfo: true
          }
        }
      }
    });

    const existingStaffIds = existingPayrolls.map(p => p.staffId);

    // Fetch staff that don't have payroll generated yet
    const staffWithoutPayroll = await prisma.staff.findMany({
      where: {
        id: { notIn: existingStaffIds },
        OR: [
          { payrollInfo: { isActiveForPayroll: true } },
          { payrollInfo: null }
        ]
      },
      include: { payrollInfo: true }
    });

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
        
        // We only care about adding present days that fall exactly within the current month
        for (let i = 0; i < attendanceRecords.length; i++) {
          const record = attendanceRecords[i];
          
          // Check if record belongs to the current month
          if (record.date >= startDate && record.date <= endDate) {
            
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
        const calc = calculatePayroll(monthlyCtc, presentDays, totalDays, 0);

        return {
          staffId: staff.id,
          month,
          year,
          totalDays,
          presentDays,
          refundOfAdvance: 0,
          ...calc,
        };
      }));

      // Bulk create new payrolls
      await prisma.monthlyPayroll.createMany({
        data: newPayrolls.filter(p => p.actualCtc !== undefined) as any
      });

      // Refetch
      existingPayrolls = await prisma.monthlyPayroll.findMany({
        where: { month, year },
        include: {
          staff: {
            include: {
              payrollInfo: true
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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payrolls } = body; // Array of payroll updates
    
    if (!Array.isArray(payrolls)) {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    const updatedPayrolls = await Promise.all(payrolls.map(async (p: any) => {
      const { id, presentDays, refundOfAdvance, monthlyCtc, totalDays } = p;
      
      const calc = calculatePayroll(monthlyCtc, presentDays, totalDays, refundOfAdvance);

      if (calc) {
        return prisma.monthlyPayroll.update({
          where: { id },
          data: {
            presentDays,
            refundOfAdvance,
            ...calc
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
