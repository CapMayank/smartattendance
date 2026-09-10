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
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const newPayrolls = await Promise.all(staffWithoutPayroll.map(async (staff) => {
        // Count present days from DailyRecord
        const attendanceRecords = await prisma.dailyRecord.findMany({
          where: {
            staffId: staff.id,
            date: { gte: startDate, lte: endDate },
            status: { in: ["PRESENT", "HALF_DAY"] }
          }
        });

        let presentDays = 0;
        for (const record of attendanceRecords) {
          presentDays += record.status === "HALF_DAY" ? 0.5 : 1;
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
