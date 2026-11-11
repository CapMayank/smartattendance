import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PayrollAnalyticsClient from "./PayrollAnalyticsClient"
import { PageHeader } from "@/components/ui"
import { selectSettledPayrolls } from "@/lib/payroll-analytics"

export default async function PayrollAnalyticsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect("/login")
  }
  if (session.user?.role !== "ADMIN") {
    redirect("/")
  }

  const allPayrolls = await prisma.monthlyPayroll.findMany({
    include: {
      staff: {
        include: {
          department: true,
        }
      }
    },
    orderBy: [
      { year: 'asc' },
      { month: 'asc' }
    ]
  })

  const { rows, pendingMonth } = selectSettledPayrolls(allPayrolls)
  const pendingLabel = pendingMonth
    ? new Date(pendingMonth.year, pendingMonth.month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll & financial analytics"
        subtitle="Deep dive into salary trends, department costs, and compliance liabilities."
      />

      {pendingLabel ? (
        <p className="text-[12.5px] text-subtle">
          {pendingLabel} is not included yet. Payroll is run at month end, so it appears here once the month is over or its payroll is locked.
        </p>
      ) : null}

      <PayrollAnalyticsClient payrollData={rows} />
    </div>
  )
}
