import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import PayrollAnalyticsClient from "./PayrollAnalyticsClient"

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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">Payroll & Financial Analytics</h1>
        <p className="text-slate-400 mt-1">Deep dive into salary trends, department costs, and compliance liabilities.</p>
      </div>

      <PayrollAnalyticsClient payrollData={allPayrolls} />
    </div>
  )
}
