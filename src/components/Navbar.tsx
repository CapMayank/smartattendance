'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity, Users, Clock, Settings, Building2, IdCard, FileText, Server,
  Calendar as CalendarIcon, Wallet, UserCheck, TrendingUp,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

type NavItem = { name: string; href: string; icon: LucideIcon }
type NavGroup = { label: string; links: NavItem[] }

export const NAV_GROUPS: NavGroup[] = [
  { label: 'Overview', links: [{ name: 'Dashboard', href: '/', icon: Activity }] },
  {
    label: 'Organization',
    links: [
      { name: 'Staff Directory', href: '/staff', icon: Users },
      { name: 'Departments', href: '/departments', icon: Building2 },
      { name: 'Designations', href: '/designations', icon: IdCard },
      { name: 'Shifts', href: '/shifts', icon: Clock },
      { name: 'Calendar', href: '/calendar', icon: CalendarIcon },
    ],
  },
  {
    label: 'Attendance',
    links: [
      { name: 'Manual Punch', href: '/attendance/manual', icon: Clock },
      { name: 'Overall Reports', href: '/reports', icon: FileText },
      { name: 'Member Details', href: '/reports/member-attendance', icon: UserCheck },
    ],
  },
  {
    label: 'Payroll',
    links: [
      { name: 'Monthly Generation', href: '/payroll/monthly', icon: FileText },
      { name: 'Member History', href: '/reports/member-payroll', icon: Wallet },
      { name: 'Staff Salary Setup', href: '/payroll/staff', icon: Wallet },
      { name: 'Payroll Analytics', href: '/reports/payroll-analytics', icon: TrendingUp },
    ],
  },
  {
    label: 'System',
    links: [
      { name: 'Devices', href: '/devices', icon: Server },
      { name: 'Users', href: '/users', icon: Users },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

/** Longest-prefix match so nested routes highlight their parent item. */
export function findActive(pathname: string): NavItem | undefined {
  let best: NavItem | undefined
  for (const g of NAV_GROUPS) {
    for (const l of g.links) {
      const match = l.href === '/' ? pathname === '/' : pathname === l.href || pathname.startsWith(l.href + '/')
      if (match && (!best || l.href.length > best.href.length)) best = l
    }
  }
  return best
}

export default function Navbar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const active = findActive(pathname)

  return (
    <nav aria-label="Primary" className="flex flex-col h-full">
      <Link
        href="/"
        onClick={onNavigate}
        className="flex items-center gap-2.5 h-14 px-4 border-b border-line shrink-0"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-md bg-accent text-white">
          <Activity className="w-4 h-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-fg leading-tight">SEHSS Lakhnadon</span>
          <span className="block text-[11px] text-subtle leading-tight">Attendance &amp; Payroll</span>
        </span>
      </Link>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-subtle">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.links.map((link) => {
                const Icon = link.icon
                const isActive = active?.href === link.href
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative flex items-center gap-3 h-10 px-3 rounded-md text-sm transition-colors duration-150 ${
                        isActive
                          ? 'bg-hover text-fg font-medium'
                          : 'text-muted hover:bg-hover hover:text-fg'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" aria-hidden />
                      )}
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : ''}`} aria-hidden />
                      <span className="truncate">{link.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
