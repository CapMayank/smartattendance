import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PayrollAnalyticsClient from "./PayrollAnalyticsClient"
import { PageHeader } from "@/components/ui"

export default async function PayrollAnalyticsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect("/login")
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

  // Format data for the client component
  return (
    <div className="space-y-5">
      <PageHeader
        title="Payroll & financial analytics"
        subtitle="Deep dive into salary trends, department costs, and compliance liabilities."
      />

      <PayrollAnalyticsClient payrollData={allPayrolls} />
    </div>
  )
}
