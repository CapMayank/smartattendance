'use client'

import React, { useMemo } from 'react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts'
import { Wallet, TrendingUp, IndianRupee, ShieldAlert, ArrowUpRight, ArrowDownRight } from 'lucide-react'

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#6366f1']

export default function PayrollAnalyticsClient({ payrollData }: { payrollData: any[] }) {
  
  const analytics = useMemo(() => {
    if (!payrollData || payrollData.length === 0) return null

    // Find unique months
    const monthKeys = Array.from(new Set(payrollData.map(p => `${p.year}-${String(p.month).padStart(2, '0')}`))).sort()
    
    const latestMonthKey = monthKeys[monthKeys.length - 1]
    const previousMonthKey = monthKeys.length > 1 ? monthKeys[monthKeys.length - 2] : null

    const latestMonthData = payrollData.filter(p => `${p.year}-${String(p.month).padStart(2, '0')}` === latestMonthKey)
    const previousMonthData = previousMonthKey ? payrollData.filter(p => `${p.year}-${String(p.month).padStart(2, '0')}` === previousMonthKey) : []

    // 1. KPI Calculations
    const calcKPIs = (data: any[]) => ({
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

    return { kpis, trendData, deptData, complianceData, latestMonthKey }
  }, [payrollData])

  if (!analytics) {
    return (
      <div className="p-8 text-center bg-black/20 backdrop-blur-2xl border border-white/[0.08] rounded-3xl">
        <p className="text-slate-400">No payroll data available for analytics yet.</p>
      </div>
    )
  }

  const KPICard = ({ title, value, change, icon: Icon, colorClass }: any) => {
    const isPositive = change >= 0
    return (
      <div className="bg-black/20 backdrop-blur-2xl border border-white/[0.08] p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorClass}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className={`flex items-center gap-1 text-sm font-medium px-2.5 py-1 rounded-full ${
            isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
          }`}>
            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        </div>
        <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
        <p className="text-2xl font-bold text-white mt-1">{formatCurrency(value)}</p>
      </div>
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
          colorClass="bg-blue-600" 
        />
        <KPICard 
          title="Total Net Payout" 
          value={analytics.kpis.net.value} 
          change={analytics.kpis.net.change} 
          icon={IndianRupee} 
          colorClass="bg-emerald-600" 
        />
        <KPICard 
          title="Total PF Liability" 
          value={analytics.kpis.epf.value} 
          change={analytics.kpis.epf.change} 
          icon={ShieldAlert} 
          colorClass="bg-rose-600" 
        />
        <KPICard 
          title="Avg. CTC per Employee" 
          value={analytics.kpis.avgSalary.value} 
          change={analytics.kpis.avgSalary.change} 
          icon={TrendingUp} 
          colorClass="bg-purple-600" 
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Trend Chart */}
        <div className="xl:col-span-2 bg-black/20 backdrop-blur-2xl border border-white/[0.08] p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <h3 className="text-xl font-bold text-white mb-6">Payroll Trajectory</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} axisLine={false} tickLine={false} />
                <YAxis 
                  stroke="rgba(255,255,255,0.5)" 
                  tick={{fill: 'rgba(255,255,255,0.5)'}} 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                  formatter={(value: any) => formatCurrency(Number(value) || 0)}
                />
                <Legend />
                <Area type="monotone" dataKey="Gross" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorGross)" />
                <Area type="monotone" dataKey="Net" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Pie Chart */}
        <div className="bg-black/20 backdrop-blur-2xl border border-white/[0.08] p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col">
          <h3 className="text-xl font-bold text-white mb-2">Cost by Department</h3>
          <p className="text-sm text-slate-400 mb-6">Latest Month ({analytics.latestMonthKey})</p>
          
          <div className="h-[300px] w-full flex-1">
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
                >
                  {analytics.deptData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                  formatter={(value: any) => formatCurrency(Number(value) || 0)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            {analytics.deptData.map((dept, i) => (
              <div key={dept.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs text-slate-300 truncate" title={dept.name}>{dept.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance Stacked Bar Chart */}
        <div className="xl:col-span-3 bg-black/20 backdrop-blur-2xl border border-white/[0.08] p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <h3 className="text-xl font-bold text-white mb-6">EPF Compliance Contributions</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.complianceData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} axisLine={false} tickLine={false} />
                <YAxis 
                  stroke="rgba(255,255,255,0.5)" 
                  tick={{fill: 'rgba(255,255,255,0.5)'}} 
                  axisLine={false} 
                  tickLine={false}
                  tickFormatter={(val) => `₹${(val/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                  formatter={(value: any) => formatCurrency(Number(value) || 0)}
                />
                <Legend />
                <Bar dataKey="Employee EPF" stackId="a" fill="#8b5cf6" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Employer EPF" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Employer EPS" stackId="a" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  )
}
