import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireRole } from "@/lib/rbac"
import { prisma } from "@/lib/prisma"
import { generatePayslipPdf } from "@/lib/payslip-pdf"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const auth = await requireRole(session, ["ADMIN", "EMPLOYEE"])
    if (auth.errorResponse) return auth.errorResponse

    const payroll = await prisma.monthlyPayroll.findUnique({
      where: { id },
      include: {
        staff: {
          include: {
            department: true,
            designation: true,
            payrollInfo: true,
          },
        },
      },
    })

    if (!payroll) {
      return NextResponse.json(
        { error: "Payroll record not found" },
        { status: 404 }
      )
    }

    if (!payroll.isLocked) {
      return NextResponse.json(
        { error: "Draft payslips cannot be downloaded. Payroll must be finalized first." },
        { status: 400 }
      )
    }

    // Role-based record ownership check:
    // If the caller is an EMPLOYEE, they may only download their own payslip
    if (auth.user.role === "EMPLOYEE") {
      const callerStaffId = session?.user?.staffId || auth.user.staffId || auth.user.staff?.id
      if (payroll.staffId !== callerStaffId) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        )
      }
    }

    const pdfBytes = await generatePayslipPdf(payroll)
    const sanitizedName = (payroll.staff.name || "Employee").trim().replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `Payslip_${sanitizedName}_${payroll.month}_${payroll.year}.pdf`

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Error generating payslip PDF:", error)
    return NextResponse.json(
      { error: "Failed to generate payslip PDF" },
      { status: 500 }
    )
  }
}
