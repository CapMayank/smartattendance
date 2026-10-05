'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type ChartData = {
  name: string
  value: number
  total: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b']

export default function DepartmentPieChart({ data }: { data: ChartData[] }) {
  const activeData = data.filter(d => d.value > 0)

  if (activeData.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center text-slate-500 font-medium">
        No attendance data yet today
      </div>
    )
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={activeData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={2}
          >
            {activeData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity" />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.95)', 
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              color: '#fff',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
            itemStyle={{ color: '#fff', fontWeight: 600 }}
            formatter={(value: any, name: any, props: any) => [
              `${value} / ${props.payload.total} Present`, 
              name
            ]}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
