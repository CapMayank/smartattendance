import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Users, Clock, Fingerprint, CalendarDays, Server, UserMinus } from "lucide-react"
import { format } from "date-fns"
import AttendanceChart from "@/components/AttendanceChart"
import AutoRefresh from "@/components/AutoRefresh"
import DashboardCards from "@/components/DashboardCards"
import RecentActivity from "@/components/RecentActivity"

export default async function Dashboard() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect("/login")
  }

  const policy = await prisma.policy.findFirst()
  const allInOutPolicy = policy?.allInOut || "First IN Last OUT"

  const staffCount = await prisma.staff.count()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  
  const todayLogs = await prisma.attendanceLog.findMany({
    where: { timestamp: { gte: todayStart } },
    include: { staff: true },
    orderBy: { timestamp: 'desc' }
  })

  // Group today's logs by staff
  const staffStatus = await prisma.staff.findMany({
    include: {
      department: true,
      designation: true,
      attendanceLogs: {
        where: { timestamp: { gte: todayStart } },
        orderBy: { timestamp: 'asc' }, // Ascending to know 1st vs last
      }
    }
  })

  const presentStaffData = staffStatus.filter(s => {
    const logs = s.attendanceLogs
    if (logs.length === 0) return false
    
    const lastLog = logs[logs.length - 1]
    if (lastLog.type === 'IN') return true
    if (lastLog.type === 'OUT') return false

    // Dynamic inference for PUNCH
    // Both policies treat a single punch as IN, and multiple punches as the last one being OUT.
    return logs.length === 1
  })
  
  const absentStaffData = staffStatus.filter(s => s.attendanceLogs.length === 0)

  const currentlyIn = presentStaffData.length
  const absentCount = absentStaffData.length

  const devices = await prisma.device.findMany()
  const now = new Date()
  const onlineDevices = devices.filter(d => (now.getTime() - new Date(d.lastPing).getTime()) < 5 * 60 * 1000).length

  // Generate Weekly Graph Data
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0,0,0,0)

  const weeklyLogs = await prisma.attendanceLog.findMany({
    where: { timestamp: { gte: sevenDaysAgo } },
    select: { timestamp: true, staffId: true }
  })

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = format(d, 'EEE')
    
    const dayStart = new Date(d)
    dayStart.setHours(0,0,0,0)
    const dayEnd = new Date(d)
    dayEnd.setHours(23,59,59,999)
    
    const logsForDay = weeklyLogs.filter(l => {
      const t = new Date(l.timestamp).getTime()
      return t >= dayStart.getTime() && t <= dayEnd.getTime()
    })
    const uniqueStaffPresent = new Set(logsForDay.map(l => l.staffId)).size
    
    return {
      date: dateStr,
      present: uniqueStaffPresent,
      absent: staffCount - uniqueStaffPresent
    }
  })

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AutoRefresh />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Sarvodaya English Higher Secondary School Lakhnadon</h1>
          <p className="text-slate-400 mt-1">Staff Attendance System Dashboard</p>
        </div>
        <div className="px-4 py-2 bg-slate-900/50 rounded-lg border border-white/10 flex items-center gap-2 backdrop-blur-md">
          <CalendarDays className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium">{format(new Date(), 'EEEE, MMMM do yyyy')}</span>
        </div>
      </div>

      {/* Stats Cards */}
      <DashboardCards
        staffCount={staffCount}
        currentlyIn={currentlyIn}
        absentCount={absentCount}
        logsCount={todayLogs.length}
        onlineDevices={onlineDevices}
        devicesCount={devices.length}
        allStaff={staffStatus}
        presentStaff={presentStaffData}
        absentStaff={absentStaffData}
      />

      {/* Graphs & Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (Chart & Logs) */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl p-6">
            <h2 className="text-xl font-bold text-white mb-6">Weekly Attendance</h2>
            <AttendanceChart data={chartData} />
          </div>

          <RecentActivity logs={todayLogs} />
        </div>

        {/* Right Column (Staff Status) */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Current Status</h2>
          <div className="rounded-2xl bg-slate-900/50 border border-white/10 backdrop-blur-xl overflow-hidden p-1">
            {/* Scrollable Container */}
            <div className="flex flex-col gap-1 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
              {(() => {
                const staffWithStatus = staffStatus.map(staff => {
                  const logs = staff.attendanceLogs
                  let isOut = true
                  
                  if (logs.length > 0) {
                    const lastLog = logs[logs.length - 1]
                    if (lastLog.type === 'IN') isOut = false
                    else if (lastLog.type === 'OUT') isOut = true
                    else {
                      // PUNCH fallback
                      isOut = logs.length > 1
                    }
                  }
                  return { ...staff, isOut }
                })

                // Sort: online (isOut=false) first
                staffWithStatus.sort((a, b) => {
                  if (a.isOut === b.isOut) return 0
                  return a.isOut ? 1 : -1
                })

                return staffWithStatus.map(staff => (
                  <div key={staff.id} className="p-3 rounded-xl hover:bg-white/5 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/10 text-xs font-bold text-white shrink-0">
                        {staff.name.substring(0,2).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-200 truncate">{staff.name}</span>
                    </div>
                    <span className="flex h-2.5 w-2.5 relative shrink-0">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${staff.isOut ? 'bg-rose-400' : 'bg-emerald-400'}`}></span>
                      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${staff.isOut ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                    </span>
                  </div>
                ))
              })()}
              {staffStatus.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-sm">
                  No staff registered yet.
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
