"use client"

import { useState } from 'react'
import { format } from 'date-fns'
import { Clock } from 'lucide-react'

type Staff = {
  name: string
  machineId: string
}

type Log = {
  id: string
  timestamp: Date | string
  type: string
  staff: Staff
}

export default function RecentActivity({ logs }: { logs: Log[] }) {
  const [limit, setLimit] = useState<number | 'all'>(5)

  const displayedLogs = limit === 'all' ? logs : logs.slice(0, limit)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-white">Recent Activity</h2>
        <select 
          className="bg-black/40 border border-white/[0.08] rounded-lg px-3 py-1 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer hover:bg-black/60 transition-colors"
          value={limit}
          onChange={(e) => setLimit(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value={5}>Recent 5</option>
          <option value={10}>Recent 10</option>
          <option value={20}>Recent 20</option>
          <option value="all">All Today</option>
        </select>
      </div>
      
      <div className="rounded-lg bg-black/20 border border-white/[0.08] overflow-hidden flex flex-col max-h-[600px]">
        {logs.length > 0 ? (
          <div className="divide-y divide-white/5 overflow-y-auto custom-scrollbar flex-1">
            {displayedLogs.map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-white/[0.08] shrink-0">
                    <span className="font-semibold text-sm">
                      {log.staff.name.substring(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{log.staff.name}</p>
                    <p className="text-sm text-muted truncate">Machine ID: {log.staff.machineId}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    log.type === 'IN' 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/20'
                  }`}>
                    {log.type}
                  </span>
                  <span className="text-sm text-muted whitespace-nowrap">
                    {format(new Date(log.timestamp), 'hh:mm:ss a')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 text-subtle mx-auto mb-4" />
            <p className="text-muted">No attendance logs yet for today.</p>
          </div>
        )}
      </div>
    </div>
  )
}
