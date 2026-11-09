import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { requireRole } from '@/lib/rbac'

function getStaffStatus(s: {
  employeeCode?: string | null
  joiningDate?: string | null
  user?: { disabledAt?: Date | string | null } | null
  employmentPeriods?: { endDate?: string | null }[]
}): 'ACTIVE' | 'EXITED' | 'NEEDS_JOINING_DATE' {
  const periods = s.employmentPeriods ?? []
  if (periods.length > 0) {
    return periods.some((p) => !p.endDate) ? 'ACTIVE' : 'EXITED'
  }
  if (s.user?.disabledAt) return 'EXITED'
  if (s.employeeCode || s.joiningDate) return 'ACTIVE'
  return 'NEEDS_JOINING_DATE'
}

function calculateDaysBetween(startDateStr: string, endDateStr: string): number {
  const start = new Date(`${startDateStr}T00:00:00Z`).getTime()
  const end = new Date(`${endDateStr}T00:00:00Z`).getTime()
  if (isNaN(start) || isNaN(end) || end < start) return 0
  return Math.round((end - start) / (1000 * 60 * 60 * 24))
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const auth = await requireRole(session, ['ADMIN'])
  if (auth.errorResponse) return auth.errorResponse

  try {
    const [departments, staffList] = await Promise.all([
      prisma.department.findMany({ orderBy: { name: 'asc' } }),
      prisma.staff.findMany({
        include: {
          department: true,
          designation: true,
          user: true,
          payrollInfo: true,
          employmentPeriods: {
            orderBy: { startDate: 'desc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ])

    let activeCount = 0
    let exitedCount = 0
    let bankEpfCount = 0
    let cashCount = 0

    const members = []
    const exits = []
    const joinings = []

    for (const s of staffList) {
      const status = getStaffStatus(s)
      if (status === 'ACTIVE') activeCount++
      else if (status === 'EXITED') exitedCount++

      const isCash = s.payrollInfo?.payGroup === 'CASH'
      if (isCash) cashCount++
      else bankEpfCount++

      const periods = s.employmentPeriods ?? []

      members.push({
        id: s.id,
        name: s.name,
        machineId: s.machineId,
        employeeCode: s.employeeCode || null,
        status,
        joiningDate: s.joiningDate || (periods[0]?.startDate ?? null),
        department: s.department?.name ?? 'Unassigned',
        designation: s.designation?.name ?? 'Unassigned',
        payGroup: isCash ? 'CASH' : 'BANK_EPF',
        role: s.user?.role ?? 'EMPLOYEE',
        email: s.user?.email || s.payrollInfo?.email || null,
        mobileNumber: s.payrollInfo?.mobileNumber || null,
      })

      // Collect exits from ended periods
      for (const ep of periods) {
        if (ep.endDate) {
          exits.push({
            id: ep.id,
            staffId: s.id,
            name: s.name,
            employeeCode: s.employeeCode || null,
            machineId: s.machineId,
            department: s.department?.name ?? 'Unassigned',
            designation: s.designation?.name ?? 'Unassigned',
            startDate: ep.startDate,
            endDate: ep.endDate,
            exitReason: ep.exitReason || 'OTHER',
            notes: ep.notes || null,
            currentStatus: status,
            tenureDays: calculateDaysBetween(ep.startDate, ep.endDate),
          })
        }
      }

      // Collect joining events
      if (periods.length > 0) {
        // periods are sorted startDate desc; stint index is reverse of chronological index
        const chronological = [...periods].reverse()
        chronological.forEach((p, idx) => {
          const year = parseInt(p.startDate.slice(0, 4), 10)
          if (!isNaN(year)) {
            joinings.push({
              id: `${s.id}-${p.startDate}`,
              staffId: s.id,
              name: s.name,
              employeeCode: s.employeeCode || null,
              machineId: s.machineId,
              date: p.startDate,
              year,
              department: s.department?.name ?? 'Unassigned',
              designation: s.designation?.name ?? 'Unassigned',
              status,
              isRejoin: idx > 0,
            })
          }
        })
      } else if (s.joiningDate) {
        const year = parseInt(s.joiningDate.slice(0, 4), 10)
        if (!isNaN(year)) {
          joinings.push({
            id: `${s.id}-${s.joiningDate}`,
            staffId: s.id,
            name: s.name,
            employeeCode: s.employeeCode || null,
            machineId: s.machineId,
            date: s.joiningDate,
            year,
            department: s.department?.name ?? 'Unassigned',
            designation: s.designation?.name ?? 'Unassigned',
            status,
            isRejoin: false,
          })
        }
      }
    }

    // Sort exits by endDate desc
    exits.sort((a, b) => b.endDate.localeCompare(a.endDate))
    // Sort joinings by date desc
    joinings.sort((a, b) => b.date.localeCompare(a.date))

    // Department breakdown
    const deptStats = departments.map((d) => {
      const deptStaff = staffList.filter((s) => s.departmentId === d.id)
      const activeDeptStaff = deptStaff.filter((s) => getStaffStatus(s) === 'ACTIVE')

      // Breakdown by designation within department
      const desigMap: Record<string, number> = {}
      for (const s of activeDeptStaff) {
        const desig = s.designation?.name ?? 'Unassigned'
        desigMap[desig] = (desigMap[desig] || 0) + 1
      }
      const designations = Object.entries(desigMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      const sharePercent = activeCount > 0 ? Number(((activeDeptStaff.length / activeCount) * 100).toFixed(1)) : 0

      return {
        id: d.id,
        name: d.name,
        totalStaff: deptStaff.length,
        activeStaff: activeDeptStaff.length,
        sharePercent,
        designations,
      }
    })

    // Unassigned dept if any
    const unassignedStaff = staffList.filter((s) => !s.departmentId)
    if (unassignedStaff.length > 0) {
      const activeUnassigned = unassignedStaff.filter((s) => getStaffStatus(s) === 'ACTIVE')
      const desigMap: Record<string, number> = {}
      for (const s of activeUnassigned) {
        const desig = s.designation?.name ?? 'Unassigned'
        desigMap[desig] = (desigMap[desig] || 0) + 1
      }
      const designations = Object.entries(desigMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      deptStats.push({
        id: 'unassigned',
        name: 'Unassigned Department',
        totalStaff: unassignedStaff.length,
        activeStaff: activeUnassigned.length,
        sharePercent: activeCount > 0 ? Number(((activeUnassigned.length / activeCount) * 100).toFixed(1)) : 0,
        designations,
      })
    }

    return NextResponse.json({
      summary: {
        total: staffList.length,
        active: activeCount,
        exited: exitedCount,
        bankEpf: bankEpfCount,
        cash: cashCount,
      },
      members,
      exits,
      joinings,
      departments: deptStats,
    })
  } catch (error) {
    console.error('Failed to load staff reports:', error)
    return NextResponse.json({ error: 'Failed to generate staff report' }, { status: 500 })
  }
}
