'use client'

import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LogOut, Activity, Users, Clock, Settings, Building2, 
  IdCard, FileText, Server, Calendar as CalendarIcon, 
  Menu, X, Wallet, UserCheck, ChevronDown 
} from "lucide-react"
import { useState } from 'react'

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // 1. Dashboard (Direct Link)
  const dashboardLink = { name: 'Dashboard', href: '/', icon: Activity }

  // 2. Organization
  const orgLinks = [
    { name: 'Staff Directory', href: '/staff', icon: Users },
    { name: 'Departments', href: '/departments', icon: Building2 },
    { name: 'Designations', href: '/designations', icon: IdCard },
    { name: 'Shifts', href: '/shifts', icon: Clock },
    { name: 'Calendar', href: '/calendar', icon: CalendarIcon },
  ]

  // 3. Attendance
  const attendanceLinks = [
    { name: 'Overall Reports', href: '/reports', icon: FileText },
    { name: 'Member Details', href: '/reports/member-attendance', icon: UserCheck },
  ]

  // 4. Payroll
  const payrollLinks = [
    { name: 'Monthly Generation', href: '/payroll/monthly', icon: FileText },
    { name: 'Member History', href: '/reports/member-payroll', icon: Wallet },
    { name: 'Staff Salary Setup', href: '/payroll/staff', icon: Wallet },
  ]

  // 5. System
  const systemLinks = [
    { name: 'Devices', href: '/devices', icon: Server },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const dropdowns = [
    { label: 'Organization', icon: Building2, links: orgLinks },
    { label: 'Attendance', icon: UserCheck, links: attendanceLinks },
    { label: 'Payroll', icon: Wallet, links: payrollLinks },
    { label: 'System', icon: Settings, links: systemLinks },
  ]

  return (
    <nav className="fixed top-4 inset-x-0 z-50 transition-all duration-300 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-auto">
        <div className="flex items-center justify-between h-14 px-2 sm:px-4 bg-black/50 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_16px_32px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-4 xl:gap-8">
            <Link href="/" className="flex items-center gap-2 pl-2">
              <div className="p-1.5 bg-blue-500/20 rounded-lg">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 hidden xl:block">
                SEHSS Lakhnadon
              </span>
              <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 xl:hidden">
                SEHSS
              </span>
            </Link>

            {session && (
              <div className="hidden lg:flex items-center gap-1">
                {/* Dashboard Link */}
                <Link
                  href={dashboardLink.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                    pathname === dashboardLink.href 
                      ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/[0.04]' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <dashboardLink.icon className="w-4 h-4" />
                  {dashboardLink.name}
                </Link>

                {/* Dropdowns */}
                {dropdowns.map((dropdown) => {
                  const DropdownIcon = dropdown.icon
                  const isActive = dropdown.links.some(link => pathname === link.href)
                  
                  return (
                    <div key={dropdown.label} className="relative group">
                      <button className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        isActive ? 'text-white bg-white/5 border border-white/[0.04]' : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}>
                        <DropdownIcon className="w-4 h-4" />
                        {dropdown.label}
                        <ChevronDown className="w-3 h-3 opacity-50 transition-transform group-hover:rotate-180" />
                      </button>
                      
                      <div className="absolute top-full left-0 h-4 w-full" />
                      
                      <div className="absolute top-[calc(100%+0.5rem)] left-0 w-56 bg-black/60 backdrop-blur-2xl border border-white/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 overflow-hidden py-1 transform origin-top group-hover:translate-y-0 translate-y-2">
                        {dropdown.links.map((link) => {
                          const Icon = link.icon
                          const isLinkActive = pathname === link.href
                          return (
                            <Link
                              key={link.name}
                              href={link.href}
                              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                                isLinkActive 
                                  ? 'bg-blue-500/15 text-blue-400 border-l-2 border-blue-400' 
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white border-l-2 border-transparent'
                              }`}
                            >
                              <Icon className="w-4 h-4 opacity-70" />
                              {link.name}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {session ? (
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/[0.04]">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white">
                    {session.user?.email?.[0].toUpperCase() || 'A'}
                  </div>
                  <span className="text-xs font-medium text-slate-300 hidden lg:block max-w-[120px] truncate">
                    {session.user?.email}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="hidden sm:flex items-center justify-center p-2 text-slate-400 bg-white/5 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all duration-300 border border-white/[0.04] active:scale-95"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600/80 hover:bg-blue-500 rounded-lg transition-all duration-300 border border-blue-500/50 shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] backdrop-blur-xl active:scale-95"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {session && isMobileMenuOpen && (
        <div className="lg:hidden fixed top-20 inset-x-4 border border-white/[0.08] rounded-2xl bg-black/80 backdrop-blur-2xl px-4 py-4 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar z-40">
          
          <Link
            href={dashboardLink.href}
            onClick={() => setIsMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === dashboardLink.href
                ? 'bg-blue-600/20 text-blue-400' 
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            <dashboardLink.icon className="w-4 h-4 opacity-70" />
            {dashboardLink.name}
          </Link>

          {dropdowns.map((dropdown) => (
            <div key={dropdown.label} className="flex flex-col space-y-1 pt-4 border-t border-white/[0.08]">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-2">
                <dropdown.icon className="w-3 h-3" />
                {dropdown.label}
              </span>
              {dropdown.links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-blue-600/20 text-blue-400' 
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 opacity-70" />
                    {link.name}
                  </Link>
                )
              })}
            </div>
          ))}

          <div className="pt-4 border-t border-white/[0.08]">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false)
                signOut()
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors w-full"
            >
              <LogOut className="w-4 h-4 opacity-70" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
