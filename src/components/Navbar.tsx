'use client'

import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOut, Activity, Users, Clock, Settings, Building2, IdCard, FileText, Server, Calendar as CalendarIcon } from "lucide-react"

export default function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  const mainLinks = [
    { name: 'Dashboard', href: '/', icon: Activity },
    { name: 'Staff', href: '/staff', icon: Users },
    { name: 'Reports', href: '/reports', icon: FileText },
  ]

  const adminLinks = [
    { name: 'Shifts', href: '/shifts', icon: Clock },
    { name: 'Departments', href: '/departments', icon: Building2 },
    { name: 'Designations', href: '/designations', icon: IdCard },
    { name: 'Devices', href: '/devices', icon: Server },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Calendar', href: '/calendar', icon: CalendarIcon },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <nav className="border-b border-white/10 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Activity className="w-6 h-6 text-blue-400" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 hidden sm:block">
                SEHSS Lakhnadon
              </span>
              <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400 sm:hidden">
                SEHSS
              </span>
            </Link>

            {session && (
              <div className="hidden lg:flex items-center gap-1">
                {mainLinks.map((link) => {
                  const Icon = link.icon
                  const isActive = pathname === link.href
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive 
                          ? 'bg-white/10 text-white' 
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {link.name}
                    </Link>
                  )
                })}
                
                {/* Management Dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-slate-400 hover:text-slate-200 hover:bg-white/5">
                    <Settings className="w-4 h-4" />
                    Management
                  </button>
                  
                  {/* Invisible bridge to keep hover active when moving cursor down */}
                  <div className="absolute top-full left-0 h-4 w-full" />
                  
                  <div className="absolute top-[calc(100%+0.5rem)] left-0 w-48 bg-slate-900 border border-white/10 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden py-1">
                    {adminLinks.map((link) => {
                      const Icon = link.icon
                      const isActive = pathname === link.href
                      return (
                        <Link
                          key={link.name}
                          href={link.href}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                            isActive 
                              ? 'bg-blue-600/10 text-blue-400' 
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4 opacity-70" />
                          {link.name}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {session ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400 hidden sm:inline-block">
                  {session.user?.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-200 bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-[0_0_15px_rgba(37,99,235,0.5)]"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
