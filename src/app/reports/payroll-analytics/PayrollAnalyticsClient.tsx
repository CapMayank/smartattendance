'use client'

import React, { useMemo } from 'react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts'
import { Card, CardHeader } from '@/components/ui'
import { chartTheme, barGradient, ACCENT_HEX, CATEGORY_HEX } from '@/lib/chart-theme'
import { Wallet, TrendingUp, IndianRupee, ShieldAlert, ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react'

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

const COLORS = CATEGORY_HEX

interface KPICardProps {
  title: string
  value: number
  change: number
  icon: LucideIcon
  colorClass: string
}

const KPICard = ({ title, value, change, icon: Icon, colorClass }: KPICardProps) => {
  const isPositive = change >= 0
  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
          isPositive ? 'bg-present/10 text-present' : 'bg-absent/10 text-absent'
        }`}>
          {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      </div>
      <h3 className="text-muted text-sm font-medium">{title}</h3>
      <p className="num text-2xl font-semibold text-text mt-1">{formatCurrency(value)}</p>
    </Card>
  )
}

interface PayrollRow {
  year: number
  month: number
  grossWage?: number | null
  netPayment?: number | null
  employeeEpf?: number | null
  employerEpf?: number | null
  employerEps?: number | null
  actualCtc?: number | null
  staff?: { department?: { name?: string | null } | null } | null
}

export default function PayrollAnalyticsClient({ payrollData }: { payrollData: PayrollRow[] }) {
  
  const analytics = useMemo(() => {
    if (!payrollData || payrollData.length === 0) return null

    // Find unique months
    const monthKeys = Array.from(new Set(payrollData.map(p => `${p.year}-${String(p.month).padStart(2, '0')}`))).sort()
    
    const latestMonthKey = monthKeys[monthKeys.length - 1]
    const previousMonthKey = monthKeys.length > 1 ? monthKeys[monthKeys.length - 2] : null

    const latestMonthData = payrollData.filter(p => `${p.year}-${String(p.month).padStart(2, '0')}` === latestMonthKey)
    const previousMonthData = previousMonthKey ? payrollData.filter(p => `${p.year}-${String(p.month).padStart(2, '0')}` === previousMonthKey) : []

    // 1. KPI Calculations
    const calcKPIs = (data: PayrollRow[]) => ({
      gross: data.reduce((sum, p) => sum + (p.grossWage || 0), 0),
      net: data.reduce((sum, p) => sum + (p.netPayment || 0), 0),
      epf: data.reduce((sum, p) => sum + (p.employeeEpf || 0) + (p.employerEpf || 0) + (p.employerEps || 0), 0),
      avgSalary: data.length > 0 ? data.reduce((sum, p) => sum + (p.actualCtc || 0), 0) / data.length : 0
    })

    const latestKPIs = calcKPIs(latestMonthData)
    const prevKPIs = calcKPIs(previousMonthData)

    const calcChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0
      return ((curr - prev) / prev) * 100
    }

    const kpis = {
      gross: { value: latestKPIs.gross, change: calcChange(latestKPIs.gross, prevKPIs.gross) },
      net: { value: latestKPIs.net, change: calcChange(latestKPIs.net, prevKPIs.net) },
      epf: { value: latestKPIs.epf, change: calcChange(latestKPIs.epf, prevKPIs.epf) },
      avgSalary: { value: latestKPIs.avgSalary, change: calcChange(latestKPIs.avgSalary, prevKPIs.avgSalary) }
    }

    // 2. Trend Data (for Area Chart)
    const trendData = monthKeys.map(key => {
      const p = payrollData.filter(d => `${d.year}-${String(d.month).padStart(2, '0')}` === key)
      const [year, month] = key.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      const monthName = date.toLocaleString('default', { month: 'short' }) + " " + year.substring(2)
      
      return {
        name: monthName,
        Gross: p.reduce((sum, d) => sum + (d.grossWage || 0), 0),
        Net: p.reduce((sum, d) => sum + (d.netPayment || 0), 0)
      }
    })

    // 3. Department Data for latest month
    const deptMap = new Map<string, number>()
    latestMonthData.forEach(p => {
      const deptName = p.staff?.department?.name || 'Unassigned'
      deptMap.set(deptName, (deptMap.get(deptName) || 0) + (p.netPayment || 0))
    })
    
    const deptData = Array.from(deptMap.entries()).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // 4. Compliance/Deduction Data
    const complianceData = monthKeys.map(key => {
      const p = payrollData.filter(d => `${d.year}-${String(d.month).padStart(2, '0')}` === key)
      const [year, month] = key.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      const monthName = date.toLocaleString('default', { month: 'short' })
      
      return {
        name: monthName,
        'Employee EPF': p.reduce((sum, d) => sum + (d.employeeEpf || 0), 0),
        'Employer EPF': p.reduce((sum, d) => sum + (d.employerEpf || 0), 0),
        'Employer EPS': p.reduce((sum, d) => sum + (d.employerEps || 0), 0),
      }
    })

    const first = trendData[0]
    const last = trendData[trendData.length - 1]
    const trendSummary = first && last
      ? `Payroll trajectory, ${trendData.length} months, ${first.name} to ${last.name}. Gross ${formatCurrency(first.Gross)} to ${formatCurrency(last.Gross)}; net ${formatCurrency(first.Net)} to ${formatCurrency(last.Net)}.`
      : 'Payroll trajectory: no data.'
    const deptSummary = deptData.length
      ? `Net cost by department, ${latestMonthKey}: ${deptData.map(d => `${d.name} ${formatCurrency(d.value)}`).join(', ')}.`
      : 'Net cost by department: no data.'
    const lastC = complianceData[complianceData.length - 1]
    const complianceSummary = lastC
      ? `EPF contributions over ${complianceData.length} months. ${lastC.name}: employee EPF ${formatCurrency(lastC['Employee EPF'])}, employer EPF ${formatCurrency(lastC['Employer EPF'])}, employer EPS ${formatCurrency(lastC['Employer EPS'])}.`
      : 'EPF contributions: no data.'

    return { kpis, trendData, deptData, complianceData, latestMonthKey, trendSummary, deptSummary, complianceSummary }
  }, [payrollData])

  if (!analytics) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted">No payroll data available for analytics yet.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Total Gross Payroll" 
          value={analytics.kpis.gross.value} 
          change={analytics.kpis.gross.change} 
          icon={Wallet} 
          colorClass="bg-acc-3" 
        />
        <KPICard 
          title="Total Net Payout" 
          value={analytics.kpis.net.value} 
          change={analytics.kpis.net.change} 
          icon={IndianRupee} 
          colorClass="bg-acc-3/70" 
        />
        <KPICard 
          title="Total PF Liability" 
          value={analytics.kpis.epf.value} 
          change={analytics.kpis.epf.change} 
          icon={ShieldAlert} 
          colorClass="bg-line" 
        />
        <KPICard 
          title="Avg. CTC per Employee" 
          value={analytics.kpis.avgSalary.value} 
          change={analytics.kpis.avgSalary.change} 
          icon={TrendingUp} 
          colorClass="bg-card-hi border border-line" 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Trend Chart */}
        <Card className="xl:col-span-2">
          <CardHeader title="Payroll Trajectory" />
          <div role="figure" aria-label={analytics.trendSummary} className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT_HEX.a2} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={ACCENT_HEX.a2} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT_HEX.a1} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={ACCENT_HEX.a1} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid {...chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" tick={chartTheme.axisTick} axisLine={false} tickLine={false} />
                <YAxis 
                  tick={chartTheme.axisTick} 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`}
                />
                <Tooltip
                  {...chartTheme.tooltip}
                  formatter={(value) => formatCurrency(Number(value) || 0)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" isAnimationActive={false} dataKey="Gross" stroke={ACCENT_HEX.a2} strokeWidth={3} fillOpacity={1} fill="url(#colorGross)" />
                <Area type="monotone" isAnimationActive={false} dataKey="Net" stroke={ACCENT_HEX.a1} strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Department Pie Chart */}
        <Card className="flex flex-col">
          <CardHeader title="Cost by Department" caption={`Latest Month (${analytics.latestMonthKey})`} />
          
          <div role="figure" aria-label={analytics.deptSummary} className="h-[300px] w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.deptData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  {analytics.deptData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  {...chartTheme.tooltip}
                  formatter={(value) => formatCurrency(Number(value) || 0)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            {analytics.deptData.map((dept, i) => (
              <div key={dept.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-muted truncate" title={dept.name}>{dept.name}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Compliance Stacked Bar Chart */}
        <Card className="xl:col-span-3">
          <CardHeader title="EPF Compliance Contributions" />
          <div role="figure" aria-label={analytics.complianceSummary} className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.complianceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  {barGradient("gradEmployeeEpf", "accent")}
                  {barGradient("gradEmployerEpf", "accentLight")}
                  {barGradient("gradEmployerEps", "neutral")}
                </defs>
                <CartesianGrid {...chartTheme.grid} vertical={false} />
                <XAxis dataKey="name" tick={chartTheme.axisTick} axisLine={false} tickLine={false} />
                <YAxis 
                  tick={chartTheme.axisTick} 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`}
                />
                <Tooltip
                  {...chartTheme.tooltip}
                  formatter={(value) => formatCurrency(Number(value) || 0)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar isAnimationActive={false} dataKey="Employee EPF" stackId="a" fill="url(#gradEmployeeEpf)" radius={[0, 0, 4, 4]} />
                <Bar isAnimationActive={false} dataKey="Employer EPF" stackId="a" fill="url(#gradEmployerEpf)" />
                <Bar isAnimationActive={false} dataKey="Employer EPS" stackId="a" fill="url(#gradEmployerEps)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

      </div>
    </div>
  )
}
