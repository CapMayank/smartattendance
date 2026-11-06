'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, Menu, X } from 'lucide-react'
import Navbar, { findActive } from './Navbar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const [prevPath, setPrevPath] = useState(pathname)
  const menuBtn = useRef<HTMLButtonElement>(null)

  // Close the drawer on route change (adjust state during render, no effect needed)
  if (prevPath !== pathname) {
    setPrevPath(pathname)
    setOpen(false)
  }

  // Esc closes the drawer; body scroll is locked while it is open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuBtn.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  // Public pages (login) and signed-out state render without the shell
  if (pathname === '/login' || status === 'unauthenticated') {
    return <main className="min-h-screen">{children}</main>
  }

  const title = findActive(pathname)?.name ?? 'Attendance'

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 bg-panel border-r border-line z-30">
        <Navbar />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-hidden />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-panel border-r border-line"
          >
            <Navbar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 sm:px-6 bg-bg/95 border-b border-line">
          <div className="flex items-center gap-3 min-w-0">
            <button
              ref={menuBtn}
              onClick={() => setOpen((o) => !o)}
              className="lg:hidden flex items-center justify-center w-10 h-10 -ml-2 rounded-md text-muted hover:bg-hover hover:text-fg transition-colors"
              aria-label={open ? 'Close navigation' : 'Open navigation'}
              aria-expanded={open}
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h1 className="text-sm font-medium text-fg truncate">{title}</h1>
          </div>

          {session && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-2.5 h-9 rounded-md border border-line bg-panel">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent-soft text-accent text-[11px] font-semibold">
                  {session.user?.email?.[0]?.toUpperCase() || 'A'}
                </span>
                <span className="text-xs text-muted max-w-[180px] truncate">{session.user?.email}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 h-10 sm:h-9 px-3 rounded-md text-sm text-muted hover:text-danger hover:bg-danger-soft transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
        </header>

        <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">{children}</main>
      </div>
    </div>
  )
}
